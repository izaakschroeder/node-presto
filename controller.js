
var 
	fs = require('fs'), 
	path = require('path');

function Controller() {
	
}

Controller.method = function(uses, f) {
	if (typeof uses === "function") {
		f = uses;
		uses = { };
	}

	if (typeof f === "undefined") {
		f = function(context, options, next) {
			next();
		}
	}
	f.uses = uses;
	return f;
}

Controller.prototype.use = function(name, opts) {
	
}

Controller.types = { };

module.exports = Controller;