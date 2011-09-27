
var 
	magic = require('magic'),
	fs = require('fs');

function FileSystemStaticContentRoute(opts) {	
	this.magic = magic.create(magic.MAGIC_MIME);
	this.root = fs.realpathSync(opts.root);
	this.prefix = opts.prefix;
	this.expression = new RegExp("^"+this.prefix+"(/.+)$");
}


FileSystemStaticContentRoute.prototype.execute = function(env, path) {
	
	var self = this;
	var response = env.response;
	
	fs.realpath(self.root + path, function(error, path) {
		if (error) {
			console.log(error);
			//File not found, etc
			response.writeHead(404);
			response.end();
			return;
		}
		
		
		if (path.substr(0, self.root.length) != self.root) {
			console.log("Attempt to escape jail!");
			//Someone trying to escape root jail.. maybe
			response.writeHead(404);
			response.end();
			return;
		}
		
		var stream = fs.createReadStream(path);
		var headersSent = false;
		
		stream.on("data", function(data) {
			if (!headersSent) {
				response.writeHead(200, {
					'Content-Type': self.magic.buffer(data)
				});
				headersSent = true;
			}
			response.write(data);
		}).on("end", function(){
			response.end();
		}).on("error", function() {
			if (!headersSent)
				response.writeHead(500);
			response.end();
		})
		
	})
}

module.exports = FileSystemStaticContentRoute;