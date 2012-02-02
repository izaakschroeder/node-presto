

var 
	fs = require('fs'),
	http = require('http'),
	https = require('https'), 
	URL = require('url'), 
	EventEmitter = require('events').EventEmitter,
	util = require('util'),
	Defaults = require('./defaults'),
	Controller = require('./controller'),
	Router = require('./router'),
	Component = require('./component'),
	Model = require('./model'),
	Log = require('log'),
	Loader = require('./loader');

/**
 *
 *
 *
 */
function Presto(opts) {
	EventEmitter.call(this);
	
	//Basic info
	this.name = opts.name;
	this.log = new Log(this, opts.logging, Log.All)

	//Welcome message.
	this.log.info("Welcome to Presto.");

	this.componentsByType = { };
	this.components = [ ];
	this.use(Router);
	this.router = this.component("Router");
	this.models = [ ];
	this.stores = { };
	this.listenAddresses = opts.listen ? (Array.isArray(opts.listen) ? opts.listen : [ opts.listen ] ) : [":"+ (opts.port || 80) ];	
	
	//Create a server to handle the requests.
	this.createServer(opts);

	
	var presto = this;
	this.on("error", function(data) {
		if (data && data.response) {
			data.response.writeHead(data.code || 503, {
				"Content-Type": "text/plain"
			});
			data.response.end("Presto encountered a "+data.code+" error!");
		}
		presto.log.error((new Error("Presto encountered a "+(data.code || "non-coded")+" error!")).stack);
	})

	Defaults.register(this);

	this.emit("ready");


}
util.inherits(Presto, EventEmitter)

Presto.Component = Component;
Presto.Controller = Controller;
Presto.Router = Router;

/**
 *
 *
 *
 */
Presto.app = function(opts) {
	return new Presto(opts);
}

/**
 *
 *
 *
 */
Presto.require = Loader.require;

/**
 *
 *
 *
 */
Presto.prototype.createServer = function(opts) {
	this.log.debug("Creating HTTP server...");
	this.server = http.createServer(this.serverHandler.bind(this));
	
	if (opts.cert) {
		var isFile = opts.key.substring(0, 4) != "----", ca, key, cert;
		
		if (isFile) {
			ca = fs.readFileSync(opts.ca);
			key = fs.readFileSync(opts.key);
			cert = fs.readFileSync(opts.cert);
		}
		else {
			ca = opts.ca;
			key = opts.key;
			cert = opts.cert;
		}

		this.log.debug("Creating HTTPS server...");
		this.secureServer = https.createServer({
			ca:   ca,
			key:  key,
			cert: cert
		}, this.serverHandler.bind(this));
	}
}


/**
 *
 *
 *
 */
Presto.prototype.serverHandler = function(request, response) {
	var presto = this;

	var oldEnd = response.end, oldWriteHead = response.writeHead;

	response.writeHead = function() {
		this.emit("head");
		oldWriteHead.apply(this, arguments);
		presto.log.debug("Wrote HTTP headers.");
	}

	response.end = function(data) {
		if (data)
			this.write.apply(this, arguments);
		this.emit("end");
		oldEnd.call(this);
		presto.log.debug("Request ended.");
	}
	
	this.router.handleRoute({
		request: request,
		response: response,
		url: URL.parse(request.url, true),
		app: presto
	});
}


/**
 *
 *
 *
 */
Presto.prototype.store = function(name, type, opts) {
	if (arguments.length === 1)
		return this.stores[name];
	this.log.debug("Creating store \""+name+"\"; type is "+type+"...");
	var cls = Presto.require(type);
	this.stores[name] = new cls(opts, this);
	this.log.debug("Created store \""+name+"\".");
	return this.stores[name];
}

/**
 *
 *
 *
 */
Presto.prototype.model = function(name, props, store) {
	if (arguments.length === 1)
		return this.models[name];
	this.log.debug("Creating model \""+name+"\"...");
	if (typeof this.models[name] !== "undefined")
		throw "Model with name "+name+" already exists!";
	var model = Model.create(name, props, this.store(store));
	this.models[name] = model;
	this.models.push(model);
	this.emit("model", model);
	this.log.debug("Created model \""+name+"\".");
	return model;
}

/**
 *
 *
 *
 */
Presto.prototype.use = function(component, opts) {

	if (component instanceof Component) {
		if (typeof this.components[component.name] !== "undefined")
			throw new Error("Component with name "+component.name+" already exists!");
		var self = this;
		this.components.push(component);
		this.components[component.name] = component;
		component.on("error", function(data) {
			data = data || { };
			data.component = component;
			self.emit("error", data);
		})
	}
	else if (typeof component === "function") {
		this.use(new component(opts || { }, this));
	}
	else if (typeof component === "string") {
		this.use(Presto.require(component), opts);
	}
	else {
		throw new Error("Gave some kind of object that wasn't a component!");
	}
	return this;
}

/**
 *
 *
 *
 */
Presto.prototype.component = function(name) {
	return this.components[name];
}

/**
 *
 *
 *
 */
Presto.prototype.route = function(controller, action, route) {
	return this.router.addRoute(controller, action, route);
}

Presto.prototype.when = function(condition) {
	return this.router.when(condition);
}



/**
 *
 *
 *
 */
Presto.prototype.run = function(env) {
	var presto = this;
	presto.environment = env || "development";
	this.router.commit();
	presto.listenAddresses.forEach(function(address) {
		if (typeof address === "string") {
			parts = address.split(":");
			address = {
				host: parts[0],
				port: parts[1] || 80,
				secure: false
			}
		} else if (typeof address === "number") {
			address = {
				port: address,
				secure: address === 443
			}
		}

		if (address.secure)
			presto.secureServer.listen(address.port, address.host);
		else
			presto.server.listen(address.port, address.host);
			
		presto.log.debug("Listening on "+(address.host || "")+":"+address.port);
	});
	presto.log.info("Presto ready.")
	
}

module.exports = Presto;
