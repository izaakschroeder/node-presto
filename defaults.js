
var fs = require('fs');

exports.register = function(app) {
	app.route("^/favicon.ico$", function(env, next) {
		fs.readFile(__dirname+"/www/images/logo.ico", function(err, data){
			if (!err) {
				env.response.writeHead(200, {
					"Content-type": "image/vnd.microsoft.icon",
					"Cache-Control": "max-age=86400"
				});
				env.response.write(data);
				env.response.end();
			}
			else {
				next();
			}
		})
	})

	app.route("^/logo.png$", function(env, next) {
		fs.readFile(__dirname+"/www/images/logo.png", function(err, data) {
			if (!err) {
				env.response.writeHead(200, {
					"Content-type": "image/png",
					"Cache-Control": "max-age=86400"
				});
				env.response.write(data);
				env.response.end();
			}
			else {
				next();
			}
		})
	})
}