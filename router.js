
var 
	Component = require('./component'), 
	uuid = require('uuid'), 
	util = require('util'),
	Loader = require('./loader');

/**
 *
 *
 *
 */
function Router(opts, app) {
	Component.call(this, opts, app);
	this.routes = [ ];
}
util.inherits(Router, Component);



function Dependency() {
	
}

/**
 * Depends on a specific aspect which can be provided
 * by any number of routes.
 *
 */
function AspectDependency(name) {
	Dependency.call(this);
	this.aspect = name;
}
util.inherits(AspectDependency, Dependency);

AspectDependency.prototype.routeDependencies = function(context) {
	var aspect = this.aspect;

	function checkProvides(object) {
		return object.provides && object.provides.indexOf(aspect) !== -1;
	}

	return context.routes.filter(function(route) {
		return checkProvides(route.controller) || (route.action && checkProvides(route.controller[route.action]));
	}).map(function(route) {
		return new RouteDependency(route);
	})
}

AspectDependency.prototype.syntheticRouteDependencies = function(context, route) {
	return [ ];
}

function ConfigurationDependency(configurator) {
	Dependency.call(this);
	this.configurator = configurator;
}
util.inherits(ConfigurationDependency, Dependency);

ConfigurationDependency.prototype.routeDependencies = function(context) {
	//var configurator = this.configurator;
	//return context.routes.filter(function(route) {
	//	return configurator.references(route);
	//}).map(function(route) {
	//	return new RouteDependency(route);
	//})
	return [ ];
}

ConfigurationDependency.prototype.syntheticRouteDependencies = function(context, route) {
	return this.configurator.references(route) ? [ new RouteDependency(this.configurator.route, true) ] : [ ];
}

/**
 * Depends on a specific route.
 *
 *
 */
function RouteDependency(route, weak) {
	Dependency.call(this);
	route = Route.normalize(route);
	this.route = route;
	this.weak = weak || false;
}
util.inherits(RouteDependency, Dependency);

RouteDependency.prototype.routeDependencies = function(context) {
	return context.find(this.route).map(function(route) {
		return new RouteDependency(route, this.weak);
	}, this);
}

RouteDependency.prototype.syntheticRouteDependencies = function(context, route) {
	return [ ];
}

RouteDependency.prototype.toString = function() {
	return this.route.toString() + (this.weak ? " *" : "");
}



Router.Dependency = {
	
	Aspect: function(name) {
		return new AspectDependency(name);
	},
	
	
	Route: function(controller, action) {
		return new RouteDependency(Route.normalize(controller, action));
	}
}

Dependency.normalizeList = function(list) {
	
	if (Array.isArray(list)) {
		return list.map(Route.normalize);
	}
	else if (list instanceof Dependency) {
		return [ list ];
	}
	else if (list instanceof Route) {
		return [ new RouteDependency(list) ];
	}
	else if (typeof list === "object" && list.constructor === Object) {
		var out = [ ];
		//Key is a list of components to configure
		for (var key in list) {
			out.push({
				key: key,
				data: list[key],
				controller: Loader.require(key),
			})
		}
		return out;
	}
	else if (typeof list === "function" || typeof list === "string") {
		return [ new RouteDependency(Route.normalize(list)) ];
	}
	else if (typeof list === "undefined") {
		return [ ];
	}
	else {
		throw new TypeError("Dependency is neither an array nor an object that can be turned into one (got "+(typeof list)+"): "+list+".");
	}
}

/**
 *
 *
 *
 */
Router.configure = function(controller, action, configuration) {
	//2 arguments, just a controller given
	if (typeof configuration === "undefined") {
		configuration = action;
		action = undefined;
	}

	//If no action is given we assume the global scope,
	//in this case represented by a dot.
	action = action || ".";

	//Ensure that configuration storage is available
	if (typeof controller.configures === "undefined")
		controller.configures = { }; 
	
	//Set the properties
	controller.configures[action] = configuration;
}


/**
 * Class for storing routing configuration data.
 *
 *
 */
function Configurator(target, configuration, router) {
	if (target instanceof Route === false)
		throw new TypeError("Target must be a route!")
	this.target = target;
	this.configuration = configuration;
	this.router = router;
}

/**
 * Normalize some input configuration data to the format the configurator
 * expects, assuming the input is normalizable.
 *
 */
Configurator.normalize = function(configuration) {
	var routes = Route.normalizeList(configuration);
	routes.forEach(function(route, i) {
		route.configuration = configuration[route.key];
	})
	return routes;
}



/**
 * Check to see whether this object's configuration settings make a reference
 * to some other existing route.
 *
 */
Configurator.prototype.references = function(route) {
	return Route.references(route, this.target);
}

/**
 *
 *
 *
 */
Configurator.prototype.toString = function() {
	return ""+this.target.toString()+": "+util.inspect(this.configuration);
}

/**
 * Apply the configurator. This will be called before any of the routes it
 * configures are ran through, therefore giving it time to setup any needed
 * information.
 */
Configurator.prototype.apply = function(context, options, next) {
	context.routingOptions.push({target: this.target, options: this.configuration });
	this.router.log.debug("Applied configuration: "+this.toString()+".")
	next();
}

/**
 *
 *
 *
 */
function Route(opts) {
	this.ordering = opts.ordering;
	this.controller = opts.controller;
	this.action = opts.action;
	this.check = opts.check;
	this.id = uuid.generate();
	this.filter = opts.filter;
	this.depends = [ ];

	(Array.isArray(opts.depends) ? opts.depends : opts.depends ? [ opts.depends ] : [ ] ).forEach(function(dependency) {
		this.addDependency(dependency);
	}, this);
}

/**
 *
 *
 *
 */
Route.normalize = function(item, action) {
	switch(typeof item) {
	case "string":
		return {
			key: item,
			controller: Loader.require(item),
			action: action
		}
	case "function":
	case "object":
		if (typeof item.controller !== "undefined")
			return item;
		


		return {
			controller: item,
			action: action
		}
	default:
		throw new TypeError("Unable to normalize route: "+item);
	}
}

/**
 *
 *
 *
 */
Route.normalizeList = function(list) {
	if (Array.isArray(list)) {
		return list.map(Route.normalize);
	}
	else if (typeof list === "object") {
		var out = [ ];
		//Key is a list of components to configure
		for (var key in list) {
			out.push({
				key: key,
				data: list[key],
				controller: Loader.require(key),
			})
		}
		return out;
	}
	else if (typeof list === "function" || typeof list === "string") {
		return [ Route.normalize(list) ];
	}
	else if (typeof list === "undefined") {
		return [ ];
	}
	else {
		throw new TypeError("Configuration is neither an array nor an object (got "+(typeof list)+"): "+list+".");
	}
}

/**
 *
 *
 *
 */
Route.references = function(a, b) {

	var types = typeof a.controller + "/" + typeof b.controller;

	//Actions are always strings, if present; easy to check them first. If not equal,
	if (typeof b.action !== "undefined" && b.action !== a.action)
		//then no reference.
		return false;

	//Check the typing data
	switch(types) {
	//Both are instances
	case "object/object":
	//Both are functions, there is no concept of action here
	case "function/function":
		return a.controller === b.controller;
	//One is an instance, the other is either a function or constructor
	case "object/function":
		return a.controller instanceof b.controller;
	//Route is a function, setting is for an instance
	case "function/object":
		return false;
	default:
		throw new Error("A configuration/route type pair was: "+types);
	}
	
}


/**
 *
 *
 *
 */
Route.prototype.addDependency = function(item) {
	if (item instanceof Dependency === false)
		throw new TypeError("Object must be a dependency (got "+typeof item+": "+util.inspect(item)+").");
	this.depends.push(item);
	return this;
}

/**
 *
 *
 *
 */
Route.prototype.toString = function() {
	//util.inspect(this.filter)+" -> "+
	return (this.controller.name || this.controller.constructor.name)+( this.action ? "."+this.action : "");
}

/**
 * Add a route object to the list of routes.
 *
 *
 */
Router.prototype.addRawRoute = function(route) {
	if (route instanceof Route === false)
		throw new Error("Route must be a route object!");
	this.routes.push(route);
	this.dirty = true;
	//Inform the user
	this.log.info("Registered route: "+route);
	return route;
}

/**
 * Create the check function which loops through all the filters 
 * seeing if a route matches. Callback is called with two parameters,
 * match and data; match is true or false based on if the route filters
 * all pass, and data is any data related to the filters.
 */
Router.createCheckFunction = function(functions) {
	
	return function(context, callback) {

		var remaining = functions.length;
		//If there are no checks left
		if (remaining === 0) {
			//We match!
			callback(true);
		}
		//Otherwise there are checks left
		else {
			//Create a new routing context
			var routingContext = { };
			//Loop through all the filter functions
			for (var i = 0; i < functions.length && remaining > 0; ++i) {
				//Call the filter
				functions[i].callback(context, (function(name, pass, result) {
					//If the filter fails
					if (!pass) {
						//We're done
						remaining = 0;
						callback(false);
					}
					//The filter succeeds
					else {
						//If the filter supplied us with some data back
						if (typeof result !== "undefined")
							//Add it to the routing context
							routingContext[name] = result;
						//If that was the last filter and we've reached here
						//it means all filters have passed
						if (--remaining === 0)
							//So return success to the caller
							callback(true, routingContext);
					}
				}).bind(undefined, functions[i].name));
			}
		}
	}
}

/**
 *
 *
 *
 */
Router.prototype.generateDependencies = function() {

	var self = this;

	this.dependencies = { };

	this.log.debug("Generating dependencies...");

	//Loop through all the routes
	this.routes.forEach(function(route) {
		
		var newDependencies = [ ];
		
		route.depends.forEach(function(dependency) {
			Array.prototype.push.apply(newDependencies, dependency.routeDependencies(self));
		});

		self.dependencies[route.id] = newDependencies;
	})	
	
	this.routes.forEach(function(route) {
		route.depends.forEach(function(dependency) {
			self.routes.forEach(function(other) {
				if (other !== route)
					Array.prototype.push.apply(self.dependencies[other.id], dependency.syntheticRouteDependencies(self, other));
			})	
		});
	})

	console.log(self.routes.map(function(r) { return r.toString() + "\n" + "[ " + self.dependencies[r.id] + " ]"; }).join("\n\n"));
	console.log("\n\n\n\n");
	require('fs').writeFileSync("test.dot", this.graph());
}

Router.prototype.graph = function() {
	var self = this, out = "";

	out += "\tgraph [truecolor=\"true\",bgcolor=\"transparent\", rankdir=\"LR\"];\n";
	out += "\tnode [shape=box];\n";
	self.routes.forEach(function(route) {
		out +=  "\t\t\""+route.id+"\" [label = \""+route.toString()+"\"];\n";
		self.dependencies[route.id].forEach(function(dependency) {
			out += "\t\t\""+dependency.route.id+"\" -> \""+route.id+"\"";
			out +=  " [ label = \""+(dependency.weak ? "weak" : "")+"\" ]\n"
		})
		
	})

	return "digraph G {\n " + out + " }";
}

Router.prototype.find = function(k,a) {
	k = Route.normalize(k,a);
	return this.routes.filter(function(route) {
		return Route.references(route, k);
	});
}

function PartialRoute(condition, router, parent) {
	this.router = router;
	this.conditions = Array.isArray(condition) ? condition : [ condition ] ;
	this.parent = parent || null;
}

PartialRoute.prototype.when = function(condition) {
	return new PartialRoute(condition, this.router);
}

PartialRoute.prototype.and = function(condition) {
	var newConditions = this.conditions.map(function(oldCondition) {
		var c = { };
		for (var k in oldCondition)
			c[k] = oldCondition[k];
		for (var k in condition)
			c[k] = condition[k];
		return c;
	})
	
	return new PartialRoute(newConditions, this.router, this);
}

PartialRoute.prototype.or = function(condition) {
	var out = this.conditions.slice();
	
	this.parent.conditions.forEach(function(item) {
		var c = { }
		for (var k in item)
			c[k] = item[k];
		for (var k in condition)
			c[k] = condition[k];
		out.push(c);
	})
	
	return new PartialRoute(out, this.router, this.parent);
}

PartialRoute.prototype.use = function(controller, action) {
	this.conditions.forEach(function(condition) {
		this.router.addRoute(controller, action, condition);
	}, this);
	
	
	var res = this;
	while (res.parent !== null)
		res = res.parent;
	return res;
}



Router.prototype.when = function(condition) {
	return new PartialRoute(condition, this);
}

/**
 *
 *
 *
 */
Router.prototype.addRoute = function(controller, action, filter) {

	var self = this;

	if (typeof controller === "string") {
		var tmp = controller;
		controller = action;
		filter = tmp;
		action = undefined;
	}

	if (filter === undefined && typeof action === "object") {

		filter = action;
		action = undefined;
	}

	

	if (typeof controller !== "object" && typeof controller !== "function")
		throw new TypeError("Must pass a valid controller (got " + (typeof controller) + ")!");
	
	if (typeof filter === "string")
		filter = { pathname: new RegExp(filter) };
	else if (typeof filter === "undefined")
		filter = { };

	if (typeof filter !== "object")
		throw new TypeError("Filter must be an object or an array (got " + (typeof filter) + ")!");

	//Type check the action parameter
	if (action && typeof action !== "string")
		throw new TypeError("Action, if given, must be a string!");
	
	//See if the controller has the action function within it
	if (action && typeof controller[action] !== "function")
		//If not issue a warning (the action might be added at runtime)
		this.log.warn("The given controller does not seem to support the action "+action);

	var functions = [ ], ordering = { }, realFilter = { },  depends = [ ], routingDepends = [ ];
	

	//Loop through all filter properties
	for (var type in filter) {
		//If it's a function
		var f = Router.filters[type];
		if (f) {
			Array.prototype.push.apply(depends, f.depends || [ ]);
			Array.prototype.push.apply(routingDepends, f.depends || [ ]);
			//Add to functions
			functions.push({name: type, callback: f.bind(undefined, filter[type])});		
		}
		//Don't know what it is, maybe user supplied data?
		else 
			//Issue a warning about it
			this.log.warn("Unknown route filter: "+type);
	}

	var check = Router.createCheckFunction(functions);

	if ((typeof controller === "object" && controller.constructor.configures) || controller.configures) {
		
		var configurator = undefined, configuration = { }, checkDependencyOrdering = { };

		function installConfiguration(name, object, key) {
			if (object.configures && object.configures[key]) 
				for (var opt in object.configures[key])
					configuration[opt] = object.configures[key][opt];
		}

		installConfiguration("default controller", controller.constructor, ".");
		installConfiguration("default action", controller.constructor, action);
		installConfiguration("controller instance", controller, ".");
		installConfiguration("action instance", controller, action);

		for (var key in configuration) {
			var options = configuration[key];

			self.find(key, options.action).forEach(function(route) {
				var configurator = new Configurator(route, options, self);
				depends.push(new ConfigurationDependency(configurator));
				configurator.route = new Route({
					//The configurator is applied under the same conditions
					check: check, 
					filter: filter,
					//The configurator is the controller
					controller: configurator,
					//Run the apply function
					action: "apply",
					//The configurator's dependencies should be the same as the route's
					//filter dependencies
					depends: routingDepends
				})

				//The associated configurator route
				self.addRawRoute(configurator.route);
			})
		}

		

		
	}



	//Create the route
	var route = this.addRawRoute(new Route({
		check: check,
		controller: controller,
		action: action,
		ordering: ordering,
		configurator: configurator,
		filter: filter,
		depends: depends
	}));
	console.log("Depends on: "+util.inspect(route.depends));
	return route;
}


/**
 *
 *
 *
 */
Router.prototype.addOrdering = function(o) {
	this.orderings.push(o);
}

/**
 * If the current list of routes is unsorted, then sort them according
 * to the various sorting options available.
 *
 */
Router.prototype.sort = function() {
	if (this.sorted)
		return;	
	var routes = this.routes, dependencies = this.dependencies;
	
	this.log.debug("Ordering the routes.");
	
	var Dependency = require('dependency');
	
	this.routes = Dependency.sort(routes, function(route, dependency) {
		return Route.references(route, dependency.route);
	}, function(route, i) {
		return dependencies[route.id];
	})

	this.log.info("Ordered the routes.");

	console.log(this.routes.map(function(r, i) { return "#"+i+": "+r.toString(); }).join("\n"))
	
}

/**
 * Ensure that the router is ready for use by making sure all the routes
 * contain the necessary data and are in the proper order.
 *
 */
Router.prototype.commit = function() {
	if (this.dirty) {
		this.generateDependencies();
		this.sort();
		this.buildResponders();
		this.dirty = false;
	}

}

/**
 *
 *
 *
 */
Router.prototype.buildResponders = function() {
	var self = this;
	
	var dependencyCount = this.routes.map(function() { return 0; });
	var postRouting = this.routes.map(function() { return []; });
	var firstResponders = [ ];

	//Start at the last route
	for (var i = this.routes.length-1; i > 0; --i) {
		var route = this.routes[i], hasDependencies = false, dependencies = this.dependencies[route.id];
		console.log("Check deps for route #"+i+": "+route);
		//Loop through all the routes before it
		for (var j = i - 1; j >= 0; --j) {
			var dependencyRoute = this.routes[j];
			
			//Loop through all the dependencies
			dependencies.forEach(function(dependency) {

				//console.log(dependency.route.toString() + " vs  "+dependencyRoute)

				if (!Route.references(dependency.route, dependencyRoute))
					return;

				console.log(route.toString() + " depends "+(dependency.weak ? "weakly" : "strongly")+" on "+dependencyRoute.toString());
				
				//Note that dependencies exist
				hasDependencies = true;

				//If the dependency is weak then it doesn't matter if the check passes
				//or not the dependency is strong, the route must execute
				postRouting[j].push({ weak: dependency.weak, route: i});

				//Increase the dependency count
				++dependencyCount[i];
			});

			

		}

		//If the route has no dependencies
		if (!hasDependencies)
			//Add it to the list of first routes to be executed
			firstResponders.unshift(i);
	}

	firstResponders.unshift(0);

	this.log.debug("First responders: "+firstResponders.map(function(i) { return this.routes[i].toString(); }, this).join("\n"));

	this.firstResponders = firstResponders;
	this.postRouting = postRouting;
	this.dependencyCount = dependencyCount;

	
}

/**
 *
 *
 *
 */
Router.prototype.emitRoute = function(context, item, data, next) {
	var controller = item.controller, action = item.action, options = this.buildOptions(context, item);

	//this.log.debug("Using route: "+item+" with routing context: "+util.inspect(data));

	if (typeof data !== "undefined")
		for (var key in data)
			context.routing[key] = data[key];

	if (typeof controller === "function") {
		controller(context, options, next);
	}
	else if (typeof controller === "undefined") {
		this.log.warn("Controller is undefined!");
		next();
	}
	else if (typeof action === "undefined") {
		action = context.request.method.toLowerCase();
		if (typeof controller[action] === "function") {
			controller[action](context, options, next);
		}
		else {
			//405 method not allowed
			this.log.error("Controller had no method matching "+action+".");
			this.emit("error", { code: 405, response: context.response });
		}
	}
	else {
		if (typeof controller[action] === "function") {
			controller[action](context, options, next);
		}
		else {
			this.log.error("Controller had no method matching "+action+".");
			//501 error not implemented
			this.emit("error", { code: 501, response: context.response });
		}
	}
}

/**
 *
 *
 *
 */
Router.prototype.buildOptions = function(context, route) {
	var options = { }, router = this;
	context.routingOptions.forEach(function(group) {
		if (group.target === route)
			for (var key in group.options)
				options[key] = group.options[key];	
	});
	return options;
}

/**
 *
 *
 *
 */
Router.prototype.handleRoute = function(context) {
	this.commit();

	this.log.debug("Routing " + context.request.method + " " + context.request.url+"; checking "+this.routes.length+" routes.");

	var self = this, left = this.dependencyCount.slice(), remainingRoutes = this.routes.length;

	context.routingOptions = [ ];
	context.routing = { };
	
	function postRouting(i, success) {
		for (var j = 0; j < self.postRouting[i].length; ++j) {
			var item = self.postRouting[i][j];
			if (item.weak || success) {
				var k = item.route;
				//self.log.debug("Route #"+k+" now has "+(left[k]-1)+" unresolved dependencies after executing route #"+i+".");
				if (--left[k] === 0)
					execute(self.routes[k], k, function() { });
			}
		}

		if (--remainingRoutes === 0)
			self.log.info("All routes covered!");

	}

	function execute(route, i) {
		self.log.debug("Checking #"+i+": "+route+"...");
		route.check(context, function(success, data) {
			if (success) {
				//self.log.debug("Executing #"+i+": "+route+"...");
				self.emitRoute(context, route, data, function() {
					//self.log.debug("Route #"+i+" "+route+" finished executing.");
					postRouting(i, true);
				});
			}
			else {
				postRouting(i, false);
			}
		})
		
	}

	for (var j = 0; j < self.firstResponders.length; ++j)
		execute(self.routes[self.firstResponders[j]], self.firstResponders[j]);

}

/**
 *
 *
 *
 */
Router.registerFilter = function(f, x, depends) {
	if (typeof f === "object") {
		for (var name in f) {
				if (typeof f[name] !== "function")
					throw new TypeError();
			registerFilter(name, f[name], x);
		}
	}
	else if (typeof f === "string") {
		if (typeof x !== "function")
			throw new TypeError();
		Router.filters[f] = x;
		Router.filters[f].depends = Dependency.normalizeList(depends);
	}
	else {
		throw new TypeError("Filter was not a name/function pair or set of functions!");
	}
}

Router.filters = {

	/**
	 * Filter on the method of the HTTP request.
	 * e.g. "GET", [ "POST", "PUT" ]
	 */
	method: function(config, context, callback) {
		if (Array.isArray(config))
			callback(config.indexOf(context.request.method) !== -1)
		else
			callback(context.request.method === config);
	},

	/**
	 * Filter on the HTTP Host: header.
	 * @config Either a string to check equality against, or a regular
	 * expression to match against.
	 * e.g. "test.com", /.+\.test\.com/ 
	 */
	host: function(config, context, callback) {
		if (!context.request.headers['Host'])
			callback(true);
		else if (typeof config === "object")
			callback(context.request.headers['Host'].match(config))
		else
			callback(context.request.headers['Host'] === config);
	},

	/**
	 * Filter on the path component of the request URL.
	 * @config Either a regular expression or string to be converted
	 * to a regular expression for matching against. 
	 * e.g. "^/index.html$"
	 */
	pathname: function(config, context, callback) {
		if (typeof config === "string")
			config = new RegExp(config);
		
		if (result = config.exec(context.url.pathname)) {
			result.shift();
			callback(true, result);
		}
		else {
			callback(false);
		}
		
	},
	
	/**
	 * Filter against elements of the query components of 
	 * the request URL.
	 * @config An object or array with keys to test against. The
	 * keys are either strings which are checked for equality, 
	 * regular expressions which are matched against, or booleans
	 * representing whether or not a parameter is present.
	 * e.g. { "query": true, "type": "search", "count": /[0-9]+/ }
	 */
	query: function(config, context, callback) {
		for (var name in config) {
			var value = config[name], query = context.url.query, result = true;
			switch(typeof value) {
			
			//Value present
			case "boolean":
				if (!(value === typeof query[name] !== "undefined")) {
					result = false;
					break;
				}
			
			//Value equality
			case "string":
				if (value !== query[name]) {
					result = false;
					break;
				}
			
			//Value match
			case "object":
				if (!value.match(query[name])) {
					result = false;
					break;
				}
			}
			
			if (result === false)
				break;
		}
		callback(result);
	}
}



module.exports = Router;