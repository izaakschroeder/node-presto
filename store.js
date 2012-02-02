
var 
	util = require('util'),
	EventEmitter = require('events').EventEmitter;

function Store() {
	EventEmitter.call(this);
}
util.inherits(Store, EventEmitter);

module.exports = Store;