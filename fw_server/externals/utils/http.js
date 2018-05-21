var http = require('http');
var https = require('https');
var qs = require('querystring');
var fibers = require('fibers');
var crypto = require('./crypto');

String.prototype.format = function (args) {
	var result = this;
	if (arguments.length > 0) {
		if (arguments.length == 1 && typeof (args) == "object") {
			for (var key in args) {
				if (args[key] != undefined) {
					var reg = new RegExp("({" + key + "})", "g");
					result = result.replace(reg, args[key]);
				}
			}
		}
		else {
			for (var i = 0; i < arguments.length; i++) {
				if (arguments[i] != undefined) {
					//var reg = new RegExp("({[" + i + "]})", "g");//这个在索引大于9时会有问题，谢谢何以笙箫的指出
					var reg = new RegExp("({)" + i + "(})", "g");
					result = result.replace(reg, arguments[i]);
				}
			}
		}
	}
	return result;
};

String.prototype.trim = function () {
	return this.replace(/(^\s*)|(\s*$)/g, '');
}

exports.post = function (host, port, path, data, callback) {

	var content = qs.stringify(data);
	var options = {
		hostname: host,
		port: port,
		path: path + '?' + content,
		method: 'GET'
	};

	var req = http.request(options, function (res) {
		console.log('STATUS: ' + res.statusCode);
		console.log('HEADERS: ' + JSON.stringify(res.headers));
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			//console.log('BODY: ' + chunk);
			callback(chunk);
		});
	});

	req.on('error', function (e) {
		console.log('problem with post request: ' + e.message);
	});

	req.end();
};

exports.get2 = function (url, data, callback, safe) {
	var content = qs.stringify(data);
	var url = url + '?' + content;
	var proto = http;
	if (safe) {
		proto = https;
	}
	var req = proto.get(url, function (res) {
		//console.log('STATUS: ' + res.statusCode);  
		//console.log('HEADERS: ' + JSON.stringify(res.headers));  
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			//console.log('BODY: ' + chunk);
			var json = JSON.parse(chunk);
			callback(true, json);
		});
	});

	req.on('error', function (e) {
		console.log('problem with get2 request: ' + e.message);
		callback(false, e);
	});

	req.end();
};

exports.getSync = function (url, data, safe, encoding) {
	var content = qs.stringify(data);
	var url = url + '?' + content;
	var proto = http;

	if (safe) {
		proto = https;
	}

	if (!encoding) {
		encoding = 'utf8';
	}
	var ret = {
		err: null,
		data: null,
	};

	var f = fibers.current;
	var req = proto.get(url, function (res) {
		//console.log('STATUS: ' + res.statusCode);  
		//console.log('HEADERS: ' + JSON.stringify(res.headers));  
		res.setEncoding(encoding);
		var body = '';

		ret.type = res.headers["content-type"];
		res.on('data', function (chunk) {
			body += chunk;
		});

		res.on('end', function () {
			if (encoding != 'binary') {
				try {
					ret.data = JSON.parse(body);
					f.run();
				} catch (e) {
					console.log('JSON parse error: ' + e + ', url: ' + url);
				}
			}
			else {
				ret.data = body;
				f.run();
			}
		});
	});

	req.on('error', function (e) {
		console.log('problem with getSync request: ' + e.message);
		ret.err = e;
		f.run();
	});

	req.end();

	fibers.yield();
	return ret;
};
exports.getSync2 = function (url, data, safe, encoding) {
	var content = qs.stringify(data);
	var url = url + '?' + content;
	var proto = http;

	if (safe) {
		proto = https;
	}

	if (!encoding) {
		encoding = 'utf8';
	}
	var ret = {
		err: null,
		data: null,
	};
	
	var f = fibers.current;
	var req = proto.get(url, function (res) {
		//console.log('STATUS: ' + res.statusCode);  
		//console.log('HEADERS: ' + JSON.stringify(res.headers));  
		res.setEncoding(encoding);
		var body = '';

		ret.type = res.headers["content-type"];

		res.on('data', function (chunk) {
			body += chunk;
		});

		res.on('end', function () {
			if (encoding != 'binary') {
				try {
					//解密
					if (global.HTTP_AES_KEY != null) {
						body = crypto.AesDecrypt(body, global.HTTP_AES_KEY, 128);
					}

					ret.data = JSON.parse(body);
					f.run();
				} catch (e) {
					console.log('JSON parse error: ' + e + ', url: ' + url);
				}
			}
			else {
				ret.data = body;
				f.run();
			}
		});
	});

	req.on('error', function (e) {
		console.log('problem with getSync request: ' + e.message);
		ret.err = e;
		f.run();
	});

	req.end();

	fibers.yield();
	return ret;
};

exports.get = function (host, port, path, data, callback, safe) {
	var content = qs.stringify(data);
	var options = {
		hostname: host,
		path: path + '?' + content,
		method: 'GET'
	};
	if (port) {
		options.port = port;
	}
	var proto = http;
	if (safe) {
		proto = https;
	}
	var req = proto.request(options, function (res) {
		//console.log('STATUS: ' + res.statusCode);  
		//console.log('HEADERS: ' + JSON.stringify(res.headers));  
		var str = '';
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			// try {
			str += chunk;
			// 	console.log('BODY--Str: ' + str);
			// 	 var json = JSON.parse(str);
			// 	// callback(true, json);
			// } catch (error) {
			// 	console.error('BODY: ' + chunk);
			// 	callback(false);
			// 	console.error('EORRY: ' + error);
			// }
		});

		res.on('end', function () {
			try {
				var json = JSON.parse(str);
				callback(true, json);
			} catch (error) {
				console.error('BODY: ' + str);
				callback(false);
				console.error('EORRY: ' + error);
			}
		});
	});

	req.on('error', function (e) {
		console.log('problem with get request: ' + e.message);
		callback(false, e);
	});

	req.end();
};

exports.send = function (res, ret, data, nocrypt) {
	//nocrypt = true;
	try {
		data = data ? data : {};
		data.errcode = ret.code;
		data.errmsg = ret.msg;
		var jsonstr = JSON.stringify(data);
		//加密
		if (!nocrypt && global.HTTP_AES_KEY != null) {
			jsonstr = crypto.AesEncrypt(jsonstr, global.HTTP_AES_KEY, 128);
		}
		res.send(jsonstr);
	} catch (error) {
		console.error(error);
	}
};

///////////////////////////////////////////
//路由管理器，用于加密通信
function HttpRoutMgr() {
	this.getRoutMap = {};
	this.postRoutMap = {};
}

HttpRoutMgr.prototype.get = function (path, fn) {
	this.getRoutMap[path] = fn;
};

HttpRoutMgr.prototype.post = function (path, fn) {
	this.postRoutMap[path] = fn;
};

HttpRoutMgr.prototype.rout = function (method, path, req, res) {
	var routerDict = null;
	if (method == 'GET') {
		routerDict = this.getRoutMap;
	} else if (method == 'POST') {
		routerDict = this.postRoutMap;
	}

	if (routerDict) {
		var fn = routerDict[path];
		if (fn && typeof fn == 'function') {
			fn(req, res);
		}
	}
};

exports.HttpRoutMgr = HttpRoutMgr;