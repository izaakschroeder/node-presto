

var 
	http = require('http'), 
	Router = require('./router'), 
	URL = require('url'), 
	DOM = require('dom'),
	Cookies = require('cookies');

function Presto(opts) {
	var presto = this;
	this.port = opts.port || 80;
	this.templateEngine = opts.templateEngine || require('template').engine();
	var router = this.router = new Router();
	var server = this.server = http.createServer(function (request, response) {
		var url = URL.parse(request.url, true);
		router.route(url, function(route, parameters) {
			
			//console.log(parameters);
			
			var document = new DOM.Document();
			document.appendChild(new DOM.ProcessingInstruction("xml", 'version="1.0" encoding="utf-8"'));
			document.appendChild(new DOM.DocumentType("html"));
			document.appendChild(new DOM.Element("html"));
			
			
			var env = {
				request: request,
				response: response,
				cookies: new Cookies(request, response),
				herp: parameters,
				url: url,
				document: document,
				templateEngine: presto.templateEngine
			}			
			
			//env.session = sessionManager.get(env);
		
			route.execute.apply(route, [env]);
		}, function() {
			console.log("No route was available to handle the request!");
			response.writeHead(404);
			response.end();
		});
	});
}


Presto.prototype.route = function(route) {
	if (typeof arguments[0] === "string" && typeof arguments[1] === "function") {
		this.route({
			expression: new RegExp(arguments[0]),
			execute: arguments[1]
		});
	} else if (typeof route === "object") {
		this.router.add(route);
	} else {
		throw "WTF?";
	}
}

Presto.prototype.listen = function() {
	this.server.listen(this.port);
}

exports.create = function(opts) {
	return new Presto(opts);
}

exports.Presto = Presto;
