var express = require('express');
var path = require('path');

var app = express();
var config = null;

//设置跨域访问
app.all('*', function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
	res.header("X-Powered-By", '3.2.1');
	//res.header("Content-Type", "application/json;charset=utf-8");
    //res.header("Content-Type", "text/html");
    next();
});

app.use(express.static(path.join(__dirname, 'public')));


var configs = require(process.argv[2]);
var config = configs.hall_server_conf();
app.listen(config.HALL_FOR_CLIENT_PORT - 1);
console.log("page service is listening on " + (config.HALL_FOR_CLIENT_PORT - 1));