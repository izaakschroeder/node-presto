
var 
	magic = require('magic'),
	fs = require('fs'),
	Path = require('path');

/**
 *
 *
 *
 */
function FileSystemStaticContentRoute(opts) {	
	this.magic = magic.create(magic.MAGIC_MIME);
	this.root = fs.realpathSync(opts.root || "./");
	this.prefix = opts.prefix || "";
	this.index = opts.index;
	this.expression = new RegExp("^"+this.prefix+"(.+)$");
	this.mimeMatches = FileSystemStaticContentRoute.defaultMimeMatches.slice();
	this.contentTypeCache = { };
	this.notFoundHandler = opts.notFound;
}

/**
 *
 *
 *
 */
FileSystemStaticContentRoute.prototype.execute = function(env) {
	
	var 
		self = this;
		response = env.response,
		path = env.parameters[0];
			
	function send(path) {
		Path.exists(path, function(exists) {
			
			//If the file does not exist
			if (!exists) {
				
				//Use has a not found handler setup
				if (self.notFoundHandler) {
					//Use that
					self.notFoundHandler(env);
				}
				//Otherwise
				else { 
					//Respond that the file does not exist
					response.writeHead(404);
					response.end();
				}
				
				return;
			}
			
			fs.realpath(path, function(error, path) {
				//File not found, etc
				if (error) {
					//Note the error
					console.log(error);
					response.writeHead(500);
					response.end();
					//We're done
					return;
				}
				
				//Make sure that the real path is within our root so that someone can't go
				//"/path/../../../etc/passwd" or similar; i.e. trying to escape root jail.
				if (path.substr(0, self.root.length) != self.root) {
					console.log("Attempt to escape jail!");
					//Respond that the file doesn't exist
					response.writeHead(404);
					response.end();
					//We're done
					return;
				}
				
				
				fs.stat(path, function(err, stat) {
					
					if (err) {
						response.writeHead(500);
						//End the response
						response.end();
					}
					
					if (stat.isDirectory()) {
						if (self.index) {
							send(path + '/' + self.index);
						}
						else {
							//Be overly protective
							response.writeHead(404);
							//End the response
							response.end();
						}
						return;
					}
					
					
					var 
						//Open a data stream for the file
						stream = fs.createReadStream(path);
						//We haven't sent any headers yet
						headersSent = false;
						
					
					//Handle stream events
					stream.on("data", function(data) {
						//If we haven't sent headers then this is the first chunk of data we have
						if (!headersSent) {
							
							
							var contentType = 
								//First attempt to fetch the data from cache
								self.contentTypeCache[path] || 
								//Next see if we have an explicit mime-match
								(function() { var x = self.mimeMatches.filter(function(i) { return i.expression.test(path); })[0]; return x && x.type })() ||
								//Lastly give libmagic a shot
								self.magic.buffer(data);
							
							self.contentTypeCache[path] = contentType;	
							
							//Since we have data the file exists and we can respond with 200 OK
							response.writeHead(200, {	
								//Add the content type
								'Content-Type': contentType  
							});
							//Note that we have now sent the headers and therefore shouldn't send them again
							headersSent = true;
						}
						//Write the chunk of data we got from the file
						response.write(data);
					}).on("end", function(){
						//We end the response when the file's read stream ends
						response.end();
					}).on("error", function() {
						//There was some kind of error and if we haven't sent any headers yet
						if (!headersSent)
							//Respond with an error
							response.writeHead(500);
						//End the response
						response.end();
					})
				})
				
			})
		})
		
	}
	
	send(self.root + '/' + path);
	
	//Attempt to get the path of the file based on our root plus requested path
	
}

FileSystemStaticContentRoute.defaultMimeMatches =  [
	{
		expression: /.css$/,
		type: "text/css"
	},
	{
		expression: /.js$/,
		type: "text/javascript"
	},
	{
		expression: /.html$/,
		type: "text/html"
	},
	{
		expression: /.xml$/,
		type: "application/xml"
	}
];


module.exports = FileSystemStaticContentRoute;