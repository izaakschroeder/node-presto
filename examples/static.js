

var Presto = require('presto');

var FileSystemStaticContentRoute = require('presto/routes/static');

var p = Presto.create({
	port: 8888
});


p.route(new FileSystemStaticContentRoute({
	prefix: "/styles",
	root: "./css"
}));

p.route(new FileSystemStaticContentRoute({
	index: "index.txt",
	notFound: function(env) {
		env.response.writeHead(404, {
			"Content-Type": "text-plain"
		})
		env.response.end("Looks like we couldn't find "+env.parameters[0]);
	}
}));

p.listen();