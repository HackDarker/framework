var fibers = require('fibers');
var crypto = require('../../externals/utils/crypto');
var roomMgr = require('./roommgr');
var tokenMgr = (require("../../externals/game_utils/tokenmgr")).getTokenMgr('ptddz');
var userMgr = (require('../../externals/game_utils/usermgr')).getUserMgr('ptddz');


var http = require('../../externals/utils/http');
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

handlers.login = function (socket, data) {
	data = JSON.parse(data);
	if (socket.userId != null) {
		//已经登陆过的就忽略
		return;
	}
	var token = data.token;
	var roomId = data.roomid;
	var time = data.time;
	var sign = data.sign;

	console.log(roomId);
	console.log(token);
	console.log(time);
	console.log(sign);


	//检查参数合法性
	if (token == null || roomId == null || sign == null || time == null) {
		console.log(1);
		emitSocketEvent(socket, 'login_result', { errcode: 1, errmsg: "invalid parameters" });
		return;
	}

	//检查参数是否被篡改
	var md5 = crypto.md5(roomId + token + time + config.ROOM_PRI_KEY);
	if (md5 != sign) {
		console.log(2);
		emitSocketEvent(socket, 'login_result', { errcode: 2, errmsg: "login failed. invalid sign!" });
		return;
	}

	//检查token是否有效
	if (tokenMgr.isTokenValid(token) == false) {
		console.log(3);
		emitSocketEvent(socket, 'login_result', { errcode: 3, errmsg: "token out of time." });
		return;
	}

	//检查房间合法性
	var userId = tokenMgr.getUserID(token);
	var roomId = roomMgr.getUserRoom(userId);

	userMgr.bind(userId, socket);
	socket.userId = userId;

	//返回房间信息
	var roomInfo = roomMgr.getRoom(roomId);

	var seatIndex = roomMgr.getUserSeat(userId);

	var ip = socket.handshake.address;
	if (ip && ip.indexOf("::ffff:") != -1) {
		ip = ip.substr(7);
	}
	roomInfo.seats[seatIndex].ip = ip;

	var userData = null;
	var seats = [];
	for (var i = 0; i < roomInfo.seats.length; ++i) {
		var rs = roomInfo.seats[i];
		var online = false;
		if (rs.userId > 0) {
			online = userMgr.isOnline(rs.userId);
		}

		seats.push({
			userid: rs.userId,
			ip: rs.ip,
			score: rs.score,
			name: rs.name,
			online: online,
			ready: rs.ready,
			seatindex: i,
		});

		if (userId == rs.userId) {
			userData = seats[i];
		}
	}

	//通知前端
	var ret = {
		errcode: 0,
		errmsg: "ok",
		data: {
			roomid: roomInfo.id,
			conf: roomInfo.conf,
			numofgames: roomInfo.numOfGames,
			seats: seats
		}
	};
	emitSocketEvent(socket, 'login_result', ret);

	console.log("===打印soket===", roomInfo.conf.type);

	//通知其它客户端
	userMgr.broacastInRoom('new_user_comes_push', userData, roomInfo, userId);

	socket.roomInfo = roomInfo;
	socket.gameMgr = roomInfo.gameMgr;
	/**notice 2018.2.3 余姚 改为手动准备 */
	// socket.gameMgr.setReady(userId, true);
	
	// userMgr.broacastInRoom('user_ready_push', { userid: userId, ready: userData.ready }, roomInfo, userId, true);
	emitSocketEvent(socket, 'login_finished');
	
	socket.gameMgr.gameSync(userId, true);
	userMgr.broacastInRoom('ddz_tuoguan_push', {
		userId: socket.userId,
		tuoguan: false
	}, roomInfo, userId, true);
	roomInfo.gameMgr.setUserTuoGuanState(userId,false)

	console.log('roomInfo', roomInfo.dr);
	if (roomInfo.dr != null) {
		var dr = roomInfo.dr;
		var ramaingTime = (dr.endTime - Date.now()) / 1000;
		var data = {
			time: ramaingTime,
			states: dr.states
		}
		userMgr.sendMsg(userId, 'dissolve_notice_push', data);
	}
};

//gps
handlers.getLocation = function (socket, data) {
	var userId = socket.userId;
	if (userId == null) return;
	try {
		data = JSON.parse(data);
		// console.log("===gps===", data);
		socket.gameMgr.setLocation(userId, data.location, data);
	} catch (e) {
		console.error(new Date(), "GPS报错" + e);
	}
};

handlers.ready = function (socket, data) {
	var userId = socket.userId;
	if (userId == null) {
		return;
	}
	var roomId = roomMgr.getUserRoom(userId);
	var room = roomMgr.getRoom(roomId);
	socket.gameMgr.setReady(userId);
	userMgr.broacastInRoom('user_ready_push', { userid: userId, ready: true }, room, userId, true);
};

handlers.huanpai = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	if (data == null) {
		return;
	}

	if (typeof (data) == "string") {
		data = JSON.parse(data);
	}

	var p1 = data.p1;
	var p2 = data.p2;
	var p3 = data.p3;
	if (p1 == null || p2 == null || p3 == null) {
		console.log("invalid data");
		return;
	}
	socket.gameMgr.huanSanZhang(socket.userId, p1, p2, p3);
};

/**
         * data = {op : true} // true:自动托管,false:取消自动托管
         */
handlers.autoplay = function (socket, data) {//余姚
	console.log("autoplay", data);
	if (socket.userId == null) {
		return;
	}
	if (data == null) {
		return;
	}
	data = JSON.parse(data);
	socket.gameMgr.autoPlay(socket.userId, data.op);
	var roomId = roomMgr.getUserRoom(socket.userId);
	var room = roomMgr.getRoom(roomId);
	userMgr.broacastInRoom('user_autoplay_push', {
		userid: socket.userId,
		isAutoPlay: data.op
	}, room, socket.userId, true);
};

//吃
handlers.chi = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	if (data == null) {
		return;
	}
	data = JSON.parse(data);
	if (!data || data.p1 == null || data.p2 == null) {
		return;
	}
	socket.gameMgr.chi(socket.userId, data.p1, data.p2);
};

handlers.dingque = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	var que = data;
	socket.gameMgr.dingQue(socket.userId, que);
}

handlers.chupai = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	var pai = data;
	socket.gameMgr.chuPai(socket.userId, pai);
}

handlers.peng = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	socket.gameMgr.peng(socket.userId);
}

handlers.gang = function (socket, data) {
	if (socket.userId == null || data == null) {
		return;
	}
	var pai = -1;
	if (typeof (data) == "number") {
		pai = data;
	}
	else if (typeof (data) == "string") {
		pai = parseInt(data);
	}
	else {
		console.log("gang:invalid param");
		return;
	}
	socket.gameMgr.gang(socket.userId, pai);
}
handlers.hu = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	socket.gameMgr.hu(socket.userId);
}
handlers.guo = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	socket.gameMgr.guo(socket.userId);
}
handlers.chat = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	var chatContent = data;

	var roomId = roomMgr.getUserRoom(socket.userId);
	var room = roomMgr.getRoom(roomId);
	userMgr.broacastInRoom('chat_push', { sender: socket.userId, content: chatContent }, room, socket.userId, true);
}
handlers.quick_chat = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	var chatId = data;

	var roomId = roomMgr.getUserRoom(socket.userId);
	var room = roomMgr.getRoom(roomId);
	userMgr.broacastInRoom('quick_chat_push', { sender: socket.userId, content: chatId }, room, socket.userId, true);
}
handlers.voice_msg = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	console.log(data.length);
	var roomId = roomMgr.getUserRoom(socket.userId);
	var room = roomMgr.getRoom(roomId);
	userMgr.broacastInRoom('voice_msg_push', { sender: socket.userId, content: data }, room, socket.userId, true);
}
handlers.emoji = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	var phizId = data;
	var roomId = roomMgr.getUserRoom(socket.userId);
	var room = roomMgr.getRoom(roomId);
	userMgr.broacastInRoom('emoji_push', { sender: socket.userId, content: phizId }, room, socket.userId, true);
}

//踢人接口 
handlers.kick = function (socket, data) {//余姚
	var userId = data;
	if (userId == null) {
		return;
	}

	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}

	//如果游戏已经开始，则不可以
	if (socket.gameMgr.hasBegan(userId)) {
		return;
	}

	var room = roomMgr.getRoom(roomId);
	//通知其它玩家，有人退出了房间
	userMgr.broacastInRoom('exit_notify_push', userId, room, userId, false);
	userMgr.broacastInRoom('Tiren_push', userId, room, userId, true);

	userMgr.kickOne(userId);
	roomMgr.exitRoom(userId);
	userMgr.del(userId);
};

handlers.exit = function (socket, data) {
	var userId = socket.userId;
	if (userId == null) {
		return;
	}

	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}

	//如果游戏已经开始，则不可以
	if (socket.gameMgr.hasBegan(roomId)) {
		return;
	}

	//如果是房主，则只能走解散房间
	if (roomMgr.isCreator(userId)) {
		return;
	}

	var roomId = roomMgr.getUserRoom(userId);
	var room = roomMgr.getRoom(roomId);
	//通知其它玩家，有人退出了房间
	userMgr.broacastInRoom('exit_notify_push', userId, room, userId, false);
	emitSocketEvent(socket, 'exit_result');

	roomMgr.exitRoom(userId);
	userMgr.del(userId);


	socket.disconnect();
}

handlers.baoting = function (socket, data) {
	var userId = socket.userId;
	if (userId == null) {
		return;
	}
	socket.gameMgr.baoTing(userId, data);
}

handlers.dispress = function (socket, data) {
	var userId = socket.userId;
	if (userId == null) {
		return;
	}

	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}

	//如果游戏已经开始，则不可以
	if (socket.gameMgr.hasBegan(roomId)) {
		return;
	}

	//如果不是房主，则不能解散房间
	if (roomMgr.isCreator(roomId, userId) == false) {
		return;
	}

	var room = roomMgr.getRoom(roomId);
	userMgr.broacastInRoom('dispress_push', {}, room, userId, true);
	userMgr.kickAllInRoom(room);
	roomMgr.destroy(roomId);
	socket.disconnect();
}

handlers.dissolve_request = function (socket, data) {
	var userId = socket.userId;
	console.log(1);
	if (userId == null) {
		console.log(2);
		return;
	}

	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		console.log(3);
		return;
	}

	//如果游戏未开始，则不可以
	if (socket.gameMgr.hasBegan(roomId) == false) {
		console.log(4);
		return;
	}

	var ret = socket.gameMgr.dissolveRequest(roomId, userId);
	if (ret != null) {
		var dr = ret.dr;
		var ramaingTime = (dr.endTime - Date.now()) / 1000;
		var data = {
			time: ramaingTime,
			states: dr.states
		}
		console.log(5);
		var room = roomMgr.getRoom(roomId);
		userMgr.broacastInRoom('dissolve_notice_push', data, room, userId, true);
	}
	console.log(6);
}

handlers.dissolve_agree = function (socket, data) {
	var userId = socket.userId;

	if (userId == null) {
		return;
	}

	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}

	var ret = roomMgr.dissolveAgree(roomId, userId, true);
	if (ret != null) {
		var dr = ret.dr;
		var ramaingTime = (dr.endTime - Date.now()) / 1000;
		var data = {
			time: ramaingTime,
			states: dr.states
		}

		var room = roomMgr.getRoom(roomId);
		userMgr.broacastInRoom('dissolve_notice_push', data, room, userId, true);

		var doAllAgreeCnt = 0;
		var doAllAgree = true;
		console.log('dr.states', dr.states);
		for (var i = 0; i < dr.states.length; ++i) {
			if (dr.states[i] == false) {
				//doAllAgreeCnt++;
				doAllAgree = false;
			}
		}

		var half = dr.states.length / 2;
		//全部玩家同意才能解散房间
		if (doAllAgree) {
			socket.gameMgr.doDissolve(roomId);
		}
	}
}

handlers.dissolve_reject = function (socket, data) {
	var userId = socket.userId;

	if (userId == null) {
		return;
	}

	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}

	var ret = roomMgr.dissolveAgree(roomId, userId, false);
	if (ret != null) {
		var room = roomMgr.getRoom(roomId);
		userMgr.broacastInRoom('dissolve_cancel_push', {}, room, userId, true);
	}
}

handlers.ddz_jiaofen = function (socket, data) {
	var userId = socket.userId;
	if (!userId) {
		return;
	}
	data = JSON.parse(data);
	socket.gameMgr.jiaofen(userId, data);
}

handlers.ddz_chupai = function (socket, data) {
	var userId = socket.userId;
	if (!userId) {
		return;
	}
	data = JSON.parse(data);
	console.log('ddz_chupai');
	socket.gameMgr.chuPai(userId, data);
}

handlers.daoju = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	var roomId = roomMgr.getUserRoom(socket.userId);
	if (roomId == null) {
		return;
	}
	console.log("Log_daojudata", data);
	var data = JSON.parse(data);
	var phizId = data.daojuname;
	var target = data.target;
	var room = roomMgr.getRoom(roomId);
	userMgr.broacastInRoom('daoju_push', { sender: socket.userId, target: target, content: phizId }, room, socket.userId, true);
}

handlers.tuoguan = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	// console.log("Log_tuoguan_push", data);
	var roomId = roomMgr.getUserRoom(socket.userId);
	if (roomId == null) {
		return;
	}
	var room = roomMgr.getRoom(roomId);

	socket.gameMgr.setUserTuoGuanState(socket.userId, true);
	userMgr.broacastInRoom('ddz_tuoguan_push', { userId: socket.userId, tuoguan: true }, room, socket.userId, true);
}

handlers.distuoguan = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	// console.log("Log_distuoguan_push", data);
	var roomId = roomMgr.getUserRoom(socket.userId);
	if (roomId == null) {
		return;
	}
	var room = roomMgr.getRoom(roomId);

	socket.gameMgr.setUserTuoGuanState(socket.userId, false);
	userMgr.broacastInRoom('ddz_tuoguan_push', { userId: socket.userId, tuoguan: false }, room, socket.userId, true);
}

function handleDisconnect(socket) {
	var userId = socket.userId;
	if (!userId) {
		return;
	}

	if (userMgr.get(userId) != socket) {
		return;
	}

	var data = {
		userid: userId,
		online: false
	};

	var roomId = roomMgr.getUserRoom(socket.userId);
	var room = roomMgr.getRoom(roomId);
	//通知房间内其它玩家
	userMgr.broacastInRoom('user_state_push', data, room, userId);

	//清除玩家的在线信息
	userMgr.del(userId);
	socket.userId = null;

	var roomId = roomMgr.getUserRoom(userId);
	var roomInfo = roomMgr.getRoom(roomId);
	if (roomInfo) {
		var seatIndex = roomMgr.getUserSeat(userId);
		if (seatIndex >= 0) {
			roomInfo.seats[seatIndex].ip = null;
		}
	}
	if (roomInfo == null) {
		return;
	}
}

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
	// console.log('handleGameMsg called. param:' + param);
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
	httpServer.listen(config.GAME_FOR_CLIENT_PORT);

	io.sockets.on('connection', registerHandlers);
	console.log("socket service is listening on " + config.GAME_FOR_CLIENT_PORT);
};