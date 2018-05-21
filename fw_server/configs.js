var consts = require('./externals/utils/consts');

//特殊偏移
var PORTOFFSET = 0;

//大厅服务器开放给客户端的地址
var HALL_FOR_CLIENT_IP = "yymj.dx1ydb.com";
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
exports.mysql_conf = function () {
	return {
		//数据库连接地址
		HOST: '127.0.0.1',
		//数据库连接端口
		PORT: 3306,
		//数据库连接账号
		USER: 'root',
		//数据库连接密码
		PSWD: '',
		//连接的数据库名称
		DB: 'db_baby',
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

		HALL_FOR_CLUB_IP: HALL_FOR_CLIENT_IP,
		CLUB_FOR_CLIENT_PORT:12121,

		HALL_FOR_MATCH_IP: HALL_FOR_CLIENT_IP,
		MATCH_FOR_CLIENT_PORT:7000,

		//账号服务私钥
		ACCOUNT_PRI_KEY: ACCOUNT_PRI_KEY,
		//房间服务私钥
		ROOM_PRI_KEY: ROOM_PRI_KEY,

		DEALDER_API_PORT: 12581,
		//服务器版本号
		VERSION: '20170317',
		//应用下载地址
		//APP_WEB:'http://47.96.41.207/download/',//http://fir.im/qfdu',
		APP_WEB:'http://yymj.dx1ydb.com/download',
		//微信的APP信息
		appInfo: {
			Android: {
				appid: "wxf9d581bd9195a94a",
				secret: "7afa69e1f658314143374b1084a0a67a",
			},
			iOS: {
				appid: "wxf9d581bd9195a94a",
				secret: "7afa69e1f658314143374b1084a0a67a",
			}
		},

		//支付相关
		// appKey: "c8985cecf8cd1d3439e0a9bd89e0c92f",
		// SH_KEY:'FQfQhwjNjvzyJZu69a2p6It35DxHc0QCxZsX70t8',
		// appKey: "d72aa4a413158dc35604a152524b1a51",
		// SH_KEY:'QNQO0P23PY611Usya1FEast8nvFdZGFpqtF3s1f1',
		// //商户号
		 SHOPID: 1923,
		// //密钥
		 SH_KEY: 'da2fcaa12259428885b2753b9947a048',

		PAY_CALL_BACK_URL: 'http://' + HALL_FOR_CLIENT_IP + ':' + (HALL_FOR_CLIENT_PORT) + '/pay_back',
		PAY_HREF_BACK_URL: 'http://' + HALL_FOR_CLIENT_IP + ':' + (HALL_FOR_CLIENT_PORT - 1) + '/over_pay.html',

		// 代理服务器地址
		DAILI_HOST: 'yymj.dx1ydb.com',
		DAILI_PORT: '8003',
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
	};
};

//比赛场服配置信息
exports.bsc_server_conf = function () {
	return {
		//用于接收客户端上报的消息
		//大厅服务器开放给客户端的地址
		BSC_FOR_CLIENT_IP: HALL_FOR_CLIENT_IP,
		//比赛场服务器开放给客户端的端口
		BSC_FOR_HALL_PORT: 8500,

		//用于大厅服务器接受游戏服务器上报的消息
		//比赛场服务器开放给游戏服务器的地址
		BSC_FOR_GAME_IP: LOCAL_IP,
		BSC_FOR_CLIENT_PORT:7000,

		//与大厅服协商好的通信加密KEY
		ROOM_PRI_KEY: ROOM_PRI_KEY,
	};
};


//余姚麻将游戏服务配置
exports.dht_game_server_conf = function () {
	return {
		SERVER_ID: "001",

		//游戏服务器type
		GAME_TYPE: consts.GameType.DHT,

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
	};
};

//普通斗地主游戏服配置
exports.ptddz_game_server_conf = function () {
	return {
		SERVER_ID: "001",

		//游戏服务器type
		GAME_TYPE: consts.GameType.PTDDZ,

		//游戏服务器模式
		GAME_MODE: consts.GameMode.NORM,

		//HTTP TICK的间隔时间，用于向大厅服汇报情况
		HTTP_TICK_TIME: 5000,

		//用于游戏服务器收取大厅服务器下发的消息
		//游戏服务器开放给大厅服务器的地址
		GAME_FOR_HALL_IP: LOCAL_IP,
		//游戏服务器开放给大厅服务器的端口
		GAME_FOR_HALL_PORT: 9004 + PORTOFFSET,

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
		GAME_FOR_CLIENT_PORT: 10002 + PORTOFFSET,
	};
};
//四人斗地主游戏服配置
exports.srddz_game_server_conf = function () {
	return {
		SERVER_ID: "001",

		//游戏服务器type
		GAME_TYPE: consts.GameType.SRDDZ,

		//游戏服务器模式
		GAME_MODE: consts.GameMode.NORM,

		//HTTP TICK的间隔时间，用于向大厅服汇报情况
		HTTP_TICK_TIME: 5000,

		//用于游戏服务器收取大厅服务器下发的消息
		//游戏服务器开放给大厅服务器的地址
		GAME_FOR_HALL_IP: LOCAL_IP,
		//游戏服务器开放给大厅服务器的端口
		GAME_FOR_HALL_PORT: 9006 + PORTOFFSET,

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
		GAME_FOR_CLIENT_PORT: 10004 + PORTOFFSET,
	};
};

//牛牛游戏服配置
exports.niuniu_game_server_conf = function () {
	return {
		SERVER_ID: "001",

		//游戏服务器type
		GAME_TYPE: consts.GameType.NIUNIU,

		//游戏服务器模式
		GAME_MODE: consts.GameMode.NORM,

		//HTTP TICK的间隔时间，用于向大厅服汇报情况
		HTTP_TICK_TIME: 5000,

		//用于游戏服务器收取大厅服务器下发的消息
		//游戏服务器开放给大厅服务器的地址
		GAME_FOR_HALL_IP: LOCAL_IP,
		//游戏服务器开放给大厅服务器的端口
		GAME_FOR_HALL_PORT: 9005 + PORTOFFSET + 1,

		//用于游戏服务器向大厅服务器上报消息
		//大厅服务器开放给游戏服务器的地址
		HALL_FOR_GAME_IP: LOCAL_IP,
		//大厅服务器开放给游戏服务器的端口
		//HALL_FOR_GAME_PORT: HALL_FOR_GAME_PORT,
		HALL_FOR_GAME_PORT: HALL_ROOM_PORT,

		//与大厅服协商好的通信加密KEY
		ROOM_PRI_KEY: ROOM_PRI_KEY,

		//游戏服务器开放给客户端的地址
		GAME_FOR_CLIENT_IP: HALL_FOR_CLIENT_IP,

		//游戏服务器开放给客户端的端口
		GAME_FOR_CLIENT_PORT: 10003 + PORTOFFSET,
	}
};

exports.manage_service_conf = function () {
	return {
		MANAGE_PORT: 12581,
		MANAGE_IP: LOCAL_IP,
		GAME_TYPES: [consts.GameType.DHT, consts.GameType.THIRTEEN, consts.GameType.PTDDZ],
		GAME_MODES: [consts.GameMode.NORM],
	}
}