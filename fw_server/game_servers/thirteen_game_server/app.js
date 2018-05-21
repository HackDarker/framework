//加载错误码
require('../../externals/utils/errcode');
require('../../externals/utils/sys');
var fibers = require('fibers');
//从配置文件获取服务器信息
var configs = require(process.argv[2]);
var config = configs.thirteen_game_server_conf();

//初始化加密key
global.HTTP_AES_KEY = configs.HTTP_AES_KEY;
global.GAME_AES_KEY = configs.GAME_AES_KEY;

var http_service = require("./http_service");
var socket_service = require("./socket_service");

var db = require('../../externals/utils/dbsync');
db.init(configs.mysql_conf());

//开启HTTP服务
http_service.start(config);

//开启外网SOCKET服务
socket_service.start(config);

var roomMgr = require('./roommgr');
roomMgr.setConfig({ gametype: config.GAME_TYPE, gamemode: config.GAME_MODE, serverid: config.SERVER_ID });

fibers(function () {
	roomMgr.init(config);
	while (true) {
		roomMgr.update();
		var dt = Date.now();
		sleep(1000);
	}
}).run();

process.on('uncaughtException', (err) => {
  console.error(`未捕获的异常: 阻止了一次服务器挂掉: ${err}`);
});