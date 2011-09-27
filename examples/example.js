
var Presto = require('presto');

var FileSystemStaticContentRoute = require('presto/routes/static'),
	DynamicContentRoute = require('presto/routes/dynamic');

var p = Presto.create({
	port: 8888
});

p.route(new FileSystemStaticContentRoute({
	prefix: "/files",
	root: "./"
}));

p.route("^/$", function(env) {
	env.response.writeHead(200);
	env.response.write("Hello World", "utf8");
	env.response.end();
});



p.route(new DynamicContentRoute({
	
	expression: "^/domain/([^/]+)(/record/(A|NS|CNAME|AAAA)(/([0-9]+))?)?",
	
	api: function(domain, hasRecordType, recordType, hasRecord, record, done) {
				
		if (hasRecord) {
			
			//return record data
			return done({
				id: record,
				value: "10.0.3.3"
			});
			
		}
		
		if (hasRecordType) {
			//return record type data
			return done({
				type: recordType
			});
		}
		
		//return domain data
		return done({
			domain: domain
		});
	},
	
	map: function(domain, hasRecordType, recordType, hasRecord, record) {
		var mapping = [];
		
		mapping.push({
			selector: "html",
			template: "index",
			bindings: {
				title: function() {
					return domain + (hasRecordType ? " - "+recordType : "") + (hasRecord ? " - "+record : "");
				}
			}
		});
		
		mapping.push({
			selector: "#Content",
			template: "domain-template",
			bindings: {
				h1: function() {
					return domain;
				}
			}
		});
		
		if (hasRecordType)
			mapping.push({
				selector: "#Content .RecordType", 
				template: "record-type-template"
			});
		
		if (hasRecord)
			mapping.push({
				selector: "#Content .Record", 
				template: "record-template",
				bindings: {
					
				}
			});
			
		return mapping;
		
	}
}));


p.route(".*", function(env) {
	env.response.writeHead(404);
	env.response.write("We're  not sure what you're looking for.");
	env.response.end();
});


p.listen();