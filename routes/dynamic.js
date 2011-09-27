
var DynamicContentRoute = function(opts) {
	this.expression = opts.expression instanceof RegExp ? opts.expression : new RegExp(opts.expression);
	this.api = opts.api;
	this.map = opts.map;
	this.template = opts.template;
}


DynamicContentRoute.prototype.execute = function(env) {
	
	
	var route = this;
	var format = env.url.query.format || "application/xhtml+xml";
	
	switch(format) {
		case "application/json":
		case "application/xml":
		case "application/xhtml+xml":
		case "text/html":
			env.response.setHeader("Content-Type", format);
			break;
		default:
			env.response.writeHead(400, { "Content-Type": "text/plain" });
			env.response.end("Unknown format supplied.");
			break;
	}
		
	
	
	function process(data) {
		//Just get a part of the page
		switch(format) {
		case "application/json":
			env.response.write(JSON.stringify(data));
			break;
		case "application/xml":
			//TODO: Add this (XML serialize data)
			break;
		case "application/xhtml+xml":
		case "text/html":
			
			var mappings = route.map.apply(route, env.herp);
			
			
			var engine = env.templateEngine;
			
			var bindings = { }, data = { };
			var remaining = mappings.length;
			mappings.forEach(function(properties, index) {
				engine.template(properties.template, properties.bindings, data, function(result) {
					bindings[properties.selector] = index;
					data[index] = result.getDocumentElement();
					if (--remaining === 0) {
						engine.execute(env.document, bindings, data, function(result) {
							
							env.response.write(env.document.toString(), "utf8");
							env.response.end();
							
						})
					}
				})
			})
				
			break;
		}
	}
	
	
	var arguments = env.herp.slice();
	arguments.push(process);
	var data = this.api.apply(this, arguments);
	if (typeof data !== "undefined")
		process(data);
}

/**
 * clientApi
 * Browser-side code
 *
 */
DynamicContentRoute.prototype.clientApi = function() {
	var 
		callback = arguments.splice(-1, 1),
		request = new XMLHttpRequest();
	
	env.url.query.format = "json";
	request.open(method || 'GET', URL.format(env.url));
	request.onload = function() {
		if (request.readyState == 4 && request.status === 200) {
			var data = JSON.parse(request.responseText);
			callback(data);
		}
		else {
			alert('Something went wrong!');
		}
	}
	request.send(data);
}

module.exports = DynamicContentRoute;