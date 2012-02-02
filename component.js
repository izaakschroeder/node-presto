
var
	EventEmitter = require('events').EventEmitter,
	util = require('util');

/**
 * FIXME: Component should also be considered a controller!
 *
 *
 */
function Component(opts, app) {
	EventEmitter.call(this);
	opts = opts || { };
	this.name = opts.name || this.constructor.name;
	this.log = app.log.instance(this);
	this.log.info("Component created.");
	this.app = app;
	this.route = app.route.bind(app, this);

	//FIXME: Should this be in here? Breaks modular design a little
	if (opts.configures) {
		this.configures = { };
		this.configures["."] = opts.configures;
	}
}
util.inherits(Component, EventEmitter)

/**
 *
 *
 *
 */
Component.prototype.toString = function() {
	return this.name;
}

module.exports = Component;