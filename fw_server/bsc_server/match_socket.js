var fibers = require('fibers');
var crypto = require('../externals/utils/crypto');
//比赛场
var matchMgr = require('./matchmgr');
//var userMgr = (require('../../externals/game_utils/usermgr')).getUserMgr('match');
var userMgr = require('./bsc_usermgr');

var http = require('../externals/utils/http');
var express = require('express');
var app = express();


//设置跨域访问
app.all('*', function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
	res.header("X-Powered-By", ' 3.2.1')
	res.header("Content-Type", "application/json;charset=utf-8");
	http.send(res, { code: 0, msg: 'ok' }, null, true);
});

var io = null;
var config = null;
var handlers = {};

// function registerHandlers(socket) {
// 	socket.on('game_ping', function () {
// 		let userId = socket.userId;
//         if (!userId) {
//             return;
//         }
//         socket.emit('game_pong');
// 	});

// 	socket.on('disconnect', function () {
//         console.log('----socket！！！！')
// 		let userId = socket.userId;
//         if (!userId) {
//             return;
//         }
//         if (userMgr.get(userId) != socket) {
//             return;
//         }
//         //清除玩家的在线信息
//         userMgr.del(userId);
//         socket.userId = null;
//     });
    
//     socket.on('login', function (data) {
//         console.log('有没有注册比赛场socket！！！！')
//         data = JSON.parse(data);
//         if (socket.userId != null) {
//             //已经登陆过的就忽略
//             return;
//         }
//         var userId = data.userId;
//         userMgr.bind(userId, socket);
//         socket.userId = userId;
//         socket.emit('bisai_succeed_push');
//     });

//     //比赛服接入后获取报名信息(待改名)
//     socket.on('get_baoming_details', function (data) {
//         data = JSON.parse(data);
//         let userId = data.userId;
//         let matchData = matchMgr.getMatchData(userId)
//         socket.emit('bisai_baoming_details_push', matchData);
//     });
// }

handlers.login = function (socket, data) {
    console.log('注册比赛场socket！login',data)
	data = JSON.parse(data);
	if (socket.userId != null) {
		//已经登陆过的就忽略
		return;
    }
    
    var userId = data.userId;
    userMgr.bind(userId, socket);
    socket.userId = userId;


	// var ip = socket.handshake.address;
	// if (ip && ip.indexOf("::ffff:") != -1) {
	// 	ip = ip.substr(7);
	// }

	emitSocketEvent(socket, 'bisai_succeed_push');
};

handlers.get_baoming_details = function (socket, data) {
    console.log('get_baoming_details',data)
    data = JSON.parse(data);
    let userId = data.userId;
    let matchData = matchMgr.getMatchData(userId)
    emitSocketEvent(socket, 'bisai_baoming_details_push', matchData);
};


function emitSocketEvent(socket, event, data) {
	if (!socket) {
		return;
	}
	console.log('emit socket event [' + event + ']');

	var senddata = { event: event, data: data };
	var sendstr = JSON.stringify(senddata);
	if (global.GAME_AES_KEY != null) {
		sendstr = crypto.AesEncrypt(sendstr, global.GAME_AES_KEY, 128);
	}
	socket.emit('gamemsg', { msg: sendstr });
}

function handleGameMsg(socket, param) {
	console.log('[Debug] - handleGameMsg called. param:' + param);
	try {
		var isStr = (typeof param === 'string');
		if (isStr === true) {
			param = JSON.parse(param);
		}

		var gamemsg = param.msg;
		if (global.GAME_AES_KEY) {
			gamemsg = crypto.AesDecrypt(param.msg, global.GAME_AES_KEY, 128);
		}
		var msgobj = JSON.parse(gamemsg);
		if (!msgobj) {
			return;
		}
	} catch (e) {
		console.log('[Error] - handle game msg error:' + e);
	}

	var event = msgobj.event;
	var data = msgobj.data;
	// console.log("handle game msg:" + event);
	var handler = handlers[event];
	if (!handler) {
		console.log("Can't find handler for event:" + event);
		return;
	}
	//强制检查socket的合法性
	if (msgobj.event != 'login') {
		if (!socket.userId) {
			return;
		}
	}

	handler(socket, data);
}

function handleDisconnect(socket) {
    console.log('新进程------socket！！！！'+socket.userId)
    let userId = socket.userId;
    if (!userId) {
        return;
    }
    if (userMgr.get(userId) != socket) {
        return;
    }
    //清除玩家的在线信息
    userMgr.del(userId);
    socket.userId = null;
}

function handleGamePing(socket) {
	var userId = socket.userId;
	if (!userId) {
		return;
	}
	//console.log('game_ping');
	socket.emit('game_pong');
}


function registerHandlers(socket) {
	socket.on('gamemsg', function (param) {
		fibers(function () {
			handleGameMsg(socket, param);
		}).run();
	});

	socket.on('game_ping', function () {
		fibers(function () {
			handleGamePing(socket);
		}).run();
	});

	socket.on('disconnect', function () {
		fibers(function () {
			handleDisconnect(socket);
		}).run();
	});
}

exports.start = function (conf) {
	config = conf;
	var httpServer = require('http').createServer(app);
	io = require('socket.io')(httpServer);
	httpServer.listen(config.BSC_FOR_CLIENT_PORT);

	io.sockets.on('connection', registerHandlers);//BSC_FOR_CLIENT_PORT
	console.log("socket service is listening on " + config.BSC_FOR_CLIENT_PORT);
};




