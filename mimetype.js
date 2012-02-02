function MimeType(type, subType, parameters) {
	this.type = type;
	this.subType = subType;
	this.parameters = parameters || { };
	this.regex = new RegExp((type + "/" + subType).replace(/\*/g, ".*?"));
}

MimeType.fromString = function(str) {
	var 
		parts = str.split(";", 1), 
		types = parts[0].split("/"),
		type = types[0],
		subType = types[1],
		parameters = { };
	var params = str.split(";");
	params.shift();
	params.forEach(function(part) {
		var parts = part.split("=", 2),
			key = parts[0].trim(),
			value = parts[1];
		parameters[key] = value;
	});
	
	return new MimeType(type, subType, parameters);
}

MimeType.prototype.matches = function(string) {
	return string.matches(this.regex);
}

MimeType.prototype.__defineGetter__("name", function(){
	return this.type + "/" + this.subType;
})

MimeType.prototype.toString = function() {
	var p = "";
	for (var key in this.parameters)
		p += "; "+key + "=" + this.parameters[key]
	return this.type + "/" + this.subType + p;
}

module.exports = MimeType;