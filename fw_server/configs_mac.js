var consts = require('./externals/utils/consts');

//特殊偏移
var PORTOFFSET = 20;

//大厅服务器开放给客户端的地址
var HALL_FOR_CLIENT_IP = "192.168.0.33";
//大厅服务器开放给客户端的端口
var HALL_FOR_CLIENT_PORT = 9000 + PORTOFFSET;

//大厅服务器开放给游戏服务器的内部端口
var HALL_FOR_GAME_PORT = 9001 + PORTOFFSET;

var ACCOUNT_PRI_KEY = "^&*#$%()@";
var ROOM_PRI_KEY = "~!@#$(*&^%$&";

var LOCAL_IP = 'localhost';

//HTTP加密key
exports.HTTP_AES_KEY = "hTtp^@AES&*kEy";
//Socket加密key
exports.GAME_AES_KEY = "GaMe;$AES#!KeY";

//数据库配置信息
exports.mysql_conf = function() {
	return {
		//数据库连接地址
		HOST: '127.0.0.1',
		//数据库连接端口
		PORT: 3306,
		//数据库连接账号
		USER: 'root',
		//数据库连接密码
		PSWD: '123456',
		//连接的数据库名称
		DB: 'db_babykylin',
	};
};

//大厅服配置信息
exports.hall_server_conf = function () {
	return {
		//用于接收客户端上报的消息
		//大厅服务器开放给客户端的地址
		HALL_FOR_CLIENT_IP: HALL_FOR_CLIENT_IP,
		//大厅服务器开放给客户端的端口
		HALL_FOR_CLIENT_PORT: HALL_FOR_CLIENT_PORT,

		//用于大厅服务器接受游戏服务器上报的消息
		//大厅服务器开放给游戏服务器的地址
		HALL_FOR_GAME_IP: LOCAL_IP,
		//大厅服务器开放给游戏服务器的端口
		HALL_FOR_GAME_PORT: HALL_FOR_GAME_PORT,

		//账号服务私钥
		ACCOUNT_PRI_KEY: ACCOUNT_PRI_KEY,
		//房间服务私钥
		ROOM_PRI_KEY: ROOM_PRI_KEY,
		//服务器版本号
		VERSION: '20170711',
		//应用下载地址
		APP_WEB: 'http://fir.im/2f17',
		//微信的APP信息
		appInfo: {
			Android: {
				appid: "wx1a1693e8d96d141b",
				secret: "1fe96f2fea3d60878cf4ccfd890512b3",
			},
			iOS: {
				appid: "wx1a1693e8d96d141b",
				secret: "1fe96f2fea3d60878cf4ccfd890512b3",
			}
		},

		//支付相关
		PAY_CALL_BACK_URL:'http://babykylin.com:9600/pay_back',
		PAY_HREF_BACK_URL:'http://' + HALL_FOR_CLIENT_IP + ':' + (HALL_FOR_CLIENT_PORT-1) + '/over_pay.html',

	};
};

//13张游戏服配置
exports.thirteen_game_server_conf = function () {
	return {
		SERVER_ID: "001",

		//游戏服务器type
		GAME_TYPE: consts.GameType.THIRTEEN,

		//游戏服务器模式
		GAME_MODE: consts.GameMode.NORM,

		//HTTP TICK的间隔时间，用于向大厅服汇报情况
		HTTP_TICK_TIME: 5000,

		//用于游戏服务器收取大厅服务器下发的消息
		//游戏服务器开放给大厅服务器的地址
		GAME_FOR_HALL_IP: LOCAL_IP,
		//游戏服务器开放给大厅服务器的端口
		GAME_FOR_HALL_PORT: 9002 + PORTOFFSET,

		//用于游戏服务器向大厅服务器上报消息
		//大厅服务器开放给游戏服务器的地址
		HALL_FOR_GAME_IP: LOCAL_IP,
		//大厅服务器开放给游戏服务器的端口
		HALL_FOR_GAME_PORT: HALL_FOR_GAME_PORT,

		//与大厅服协商好的通信加密KEY
		ROOM_PRI_KEY: ROOM_PRI_KEY,

		//游戏服务器开放给客户端的地址
		GAME_FOR_CLIENT_IP: HALL_FOR_CLIENT_IP,

		//游戏服务器开放给客户端的端口
		GAME_FOR_CLIENT_PORT: 10000 + PORTOFFSET,
	}
};

//泉州麻将游戏服配置
exports.qzmj_game_server_conf = function () {
	return {
		SERVER_ID: "001",

		//游戏服务器type
		GAME_TYPE: consts.GameType.QZMJ,

		//游戏服务器模式
		GAME_MODE: consts.GameMode.NORM,

		//HTTP TICK的间隔时间，用于向大厅服汇报情况
		HTTP_TICK_TIME: 5000,

		//用于游戏服务器收取大厅服务器下发的消息
		//游戏服务器开放给大厅服务器的地址
		GAME_FOR_HALL_IP: LOCAL_IP,
		//游戏服务器开放给大厅服务器的端口
		GAME_FOR_HALL_PORT: 9003 + PORTOFFSET,

		//用于游戏服务器向大厅服务器上报消息
		//大厅服务器开放给游戏服务器的地址
		HALL_FOR_GAME_IP: LOCAL_IP,
		//大厅服务器开放给游戏服务器的端口
		HALL_FOR_GAME_PORT: HALL_FOR_GAME_PORT,

		//与大厅服协商好的通信加密KEY
		ROOM_PRI_KEY: ROOM_PRI_KEY,

		//游戏服务器开放给客户端的地址
		GAME_FOR_CLIENT_IP: HALL_FOR_CLIENT_IP,

		//游戏服务器开放给客户端的端口
		GAME_FOR_CLIENT_PORT: 10001 + PORTOFFSET,
	}
};