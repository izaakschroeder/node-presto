
var URL = require('url');

var Router = function() {
	
}

Router.prototype.routes = [ ];

Router.prototype.add = function(r) {
	this.routes.push(r);
}

Router.prototype.route = function(url, cb, notFound) {
	if (typeof url !== "object")
		url = URL.parse(url);
	for(var i = 0; i < this.routes.length; ++i) {
		var route = this.routes[i];
		if (result = route.expression.exec(url.pathname)) {
			result.shift();
			cb(route, result);
			return;
		}
	}
	
	if (notFound)
		notFound();
}

module.exports = Router;