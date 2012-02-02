
var 
	http = require('http'),
	lingo = require('lingo'), 
	lang = lingo.en, 
	util = require('util'),
	Validator = require('validator'),
	uuid = require('uuid'),
	EventEmitter = require('events').EventEmitter;

function ModelInstance(model, properties, opts) {
	var self = this;
	this.__model = model;
	this.__dirty = { }
	this.__isDirty = false;
	this.__defaults = { }
	properties = properties || { };
	opts = opts || { };
	
	model.properties.forEach(function(property) {
		var name = property.name, propertyName = "_"+name;

		if (typeof property.default === "function")
			this.__defaults[name] = property.default();
		else if (typeof property.default !== "undefined")
			this.__defaults[name] = property.default;
		
		Object.defineProperty(this, name, {
			
			//True if and only if the type of this property descriptor may be changed and if the property may be deleted from the corresponding object.
			configurable: true, 
			
			//True if and only if this property shows up during enumeration of the properties on the corresponding object.
			enumerable: true, 
			
			get: function() {
				if (typeof property.get === "function")
					return property.get.call(self);

				if (!opts.noDefaults && typeof self[propertyName] === "undefined" && typeof this.__defaults[name] !== "undefined")
					return this.__defaults[name];
				
				return self[propertyName];
			},

			set: function(value) {
				property.emit("set", self, value);
				if (typeof property.get === "function")
					throw "Trying to set a read-only property!";
				if (typeof property.set === "function")
					value = property.set.call(self, value);
				if (self[propertyName] != value) {
					self.__isDirty = true;
					self.__dirty[name] = true;
					self[propertyName] = value;
				}
			}
		})
	}, this);

	for (var name in properties) 
		this[name] = properties[name];
	
	if (!model.properties[model.id])
		throw "No id property defined!";

}

ModelInstance.prototype.validate = function(callback) {
	this.__model.validator(this, this.__model.properties, callback);
}

ModelInstance.prototype.getId = function() {
	return this[this.__model.id];
}

ModelInstance.prototype.properties = function(opts) {
	var out = { };
	opts = opts || { }
	this.__model.properties.forEach(function(property) {
		var name = property.name;
		if ((!opts.stored || !this.__model.properties[name].unstored) && typeof this[name] !== "undefined")
			out[name] = this[name];
	}, this);
	return out;
}

ModelInstance.prototype.save = function(callback) {
	this.__model.save(this, callback)
}

ModelInstance.prototype.delete = function(callback) {
	this.__model.delete(this, callback)
}

ModelInstance.prototype.expire = function(duration, callback) {
	this.__model.expire(this, duration, callback)
}

function Property(model, name, opts) {
	EventEmitter.call(this);
	this.name = name;
	if (typeof opts === "function") {
		var type = opts;
		opts = { type: type };
	}
	else if (Array.isArray(opts)) {
		opts = { type: "enumeration", values: opts };
	}
	this.type = opts.type || String;
	this.unstored = opts.unstored || false;
	this.default = opts.default;
	this.model = model;

	this.validator = Validator.create(opts.requires, opts.recommends);
}
util.inherits(Property, EventEmitter);

function Model(name, properties, storage) {
	var model = this;
	this.id = "id";
	this.name = name;
	this.properties = [ ];

	for (var name in properties) 
		this.addProperty(name, properties[name])

	if (!storage)
		throw "No storage given for model "+name+"!";
	
	for(var name in properties)
		if (properties[name].id)
			this.id = name;
	
	if (!this.properties[this.id])
		this.addProperty(this.id, {
			type: "string",
			length: 38,
			default: function() {
				return uuid.generate();
			}
		});
	
	this.classFunction = function (properties, opts) { ModelInstance.call(this, model, properties, opts) };
	util.inherits(this.classFunction, ModelInstance);
	this.storage = storage.forModel(this);
	this.timeouts = { };
}

Model.prototype.__defineGetter__("validator", function() {
	if (this.validatorDirty)
		this.rebuildValidator();
	return this.internalValidator;
})

Model.prototype.rebuildValidator = function() {
	var validators = { };
	this.properties.forEach(function(p) {
		validators[p.name] = p.validator;
	})
	this.internalValidator = Validator.object(validators);
}

Model.prototype.addMethod = function(name, f) {
	this.classFunction.prototype[name] = f;
}

Model.prototype.addProperty = function(name, opts) {
	if (typeof name === "object")
		name = opts.name;
	var property = new Property(this, name, opts);
	if (this.hasProperty(name))
		throw "Property "+name+" already exists!";
	this.properties.push(property);
	this.properties[name] = property;
	this.validatorDirty = true;
	return property;
}

Model.prototype.hasProperty = function(name) {
	return typeof this.properties[name] !== "undefined";
}

Model.prototype.requiredProperties = function() {
	return this.properties.filter(function(i) { return i.required === true || i.name === this.__model.id; });
}

Model.prototype.instance = function(properties, opts) {
	return new this.classFunction(properties, opts);
}

Model.prototype.find = function(properties, callback) {
	return this.storage.find(properties, callback)
}

Model.prototype.all = function(callback) {
	return this.storage.documents(callback);
}

Model.prototype.get = function(id, callback) {
	return this.storage.get(id, callback);
}

Model.prototype.exists = function(id, callback) {
	this.storage.exists(id, callback);
}

Model.prototype.expire = function(object, duration, callback) {
	var storage = this.storage;
	if (typeof storage.expire === "undefined") {
		var timer = setTimeout(function(object) {
			storage.delete(object);
		}, duration, object);
		this.timeouts[object.getId()] = timer;
		callback();
	}
	else {
		storage.expire(object.getId(), callback);
	}
}

Model.prototype.preserve = function(object, callback) {
	var storage = this.storage;
	if (typeof storage.expire === "undefined") {
		if (typeof this.timeouts[object.getId()] !== "undefined") {
			clearTimeout(this.timeouts[object.getId()]);
			delete this.timeouts[object.getId()];
		}
		callback();
	}
	else {
		storage.preserve(object.getId(), callback);
	}
}

Model.prototype.save = function(object, callback) {
	var storage = this.storage;

	if (!object.__isDirty) {
		//FIXME: How to handle this case?
		//callback(true);
		//return;
	}

	if (typeof this.timeouts[object.getId()] !== "undefined")
		this.preserve(object);
	
	object.validate(function(results) {
		if (results.isOk()) {
			var id = object.getId();

			if (!id) 
				throw "Object to save has no ID!";

			storage.put(object, function() {
				object.__isDirty = false;
				object.__dirty = { };
				if (callback)
					callback(results);
			});
			
		}
		else {
			if (callback)
				callback(results);
		}
	})
}

Model.prototype.delete = function(object, callback) {
	this.storage.delete(object, function() {
		if (callback)
			callback();
	});
}

Model.create = function(name, properties, storage) {
	return new Model(name, properties, storage);
}

module.exports = Model;