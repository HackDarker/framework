var fibers = require('fibers');
var crypto = require('../../externals/utils/crypto');
var roomMgr = require('./roommgr');
var tokenMgr = (require("../../externals/game_utils/tokenmgr")).getTokenMgr('thirteen');
var userMgr = (require('../../externals/game_utils/usermgr')).getUserMgr('thirteen');

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
	if (!roomInfo) {
		emitSocketEvent(socket, 'login_result', { errcode: 4, errmsg: "room is not exist." });
		return
	}

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
			gps_data: rs.gpsData,
			score: rs.score,
			name: rs.name,
			online: online,
			ready: rs.ready,
			seatindex: i
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

	//通知其它客户端
	userMgr.broacastInRoom('new_user_comes_push', userData, roomInfo, userId);

	socket.roomInfo = roomInfo;
	socket.gameMgr = roomInfo.gameMgr;

	//玩家上线，强制设置为TRUE
	// roomMgr.setReady(userId, true);

	emitSocketEvent(socket, 'login_finished');

	if (roomInfo.dr != null) {
		var dr = roomInfo.dr;
		var ramaingTime = (dr.endTime - Date.now()) / 1000;
		var data = {
			time: ramaingTime,
			states: dr.states
		}
		userMgr.sendMsg(userId, 'dissolve_notice_push', data);
	}

	//通知投票踢人
	if (roomInfo.kick != null) {
		//设置定时器的问题原因是 客户端初始刷监听接口比较慢
		let kick = roomInfo.kick
		setTimeout(() => {
			userMgr.sendMsg(userId, 'kickout_notice_push', kick);
		}, 2000);
	}

	roomMgr.checkRoomState(roomId, userId);
	roomMgr.computeOnlineCnt(roomInfo);
};

handlers.room_ready = function (socket, data) {
	var userId = socket.userId;
	if (userId == null) {
		return;
	}
	roomMgr.setReady(userId, true);

	//托管自动准备
	var roomId = roomMgr.getUserRoom(userId);
	var room = roomMgr.getRoom(roomId);

	if (room && room.gameMgr) {
		room.gameMgr.autoReadyHostingUsers(roomId);
	}
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

//道具互动表情
handlers.daoju = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	var roomId = roomMgr.getUserRoom(socket.userId);
	if (roomId == null) {
		return;
	}
	console.log("道具", data);
	var data = JSON.parse(data);
	var phizId = data.daojuname;
	var target = data.target;
	var room = roomMgr.getRoom(roomId);
	userMgr.broacastInRoom('daoju_push', { sender: socket.userId, target: target, content: phizId }, room, socket.userId, true);
}

//13水踢人接口 
handlers.kick = function (socket, data) {
	var userId = data;
	if (userId == null) {
		return;
	}

	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}

	//如果游戏已经开始，则不可以
	if (roomMgr.hasBegan(roomId)) {
		return;
	}

	//如果是房主，则只能走解散房间
	if (roomMgr.isCreator(userId)) {//俱乐部走投票踢人
		return;
	}

	var room = roomMgr.getRoom(roomId);
	//特别处理  预防出现一个玩家 有多个房间数据没清除的, 该玩家已经在另一个房间则给该玩家id清楚,以免影响到他所在的房间
	if (room) {
		for (var i = 0; i < room.seats.length; i++) {
			var checkRoomid = roomMgr.getUserRoom(room.seats[i].userId);
			if (checkRoomid) {
				if (checkRoomid != roomId) {
					room.seats[i].userId = 0;
					console.error('[SOCKETBUG] ---kick- roomId != checkRoomid  -[userid]:' + room.seats[i].userId + '[roomid]:' + roomId + '[roomid2]:' + checkRoomid);
				}
			}
		}
	}
	//通知其它玩家，有人退出了房间
	userMgr.broacastInRoom('exit_notify_push', userId, room, userId, false);
	userMgr.broacastInRoom('Tiren_push', userId, room, userId, true);

	userMgr.kickOne(userId);
	roomMgr.exitRoom(userId, roomId);
}

//解散的用户退出
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
	if (roomMgr.hasBegan(roomId)) {
		return;
	}

	//如果是房主，则只能走解散房间
	if (roomMgr.isCreator(userId) && !room.conf.club_id) {
		return;
	}

	//通知其它玩家，有人退出了房间
	var room = roomMgr.getRoom(roomId);
	//特别处理  预防出现一个玩家 有多个房间数据没清除的, 该玩家已经在另一个房间则给该玩家id清楚,以免影响到他所在的房间
	if (room) {
		for (var i = 0; i < room.seats.length; i++) {
			var checkRoomid = roomMgr.getUserRoom(room.seats[i].userId);
			if (checkRoomid) {
				if (checkRoomid != roomId) {
					room.seats[i].userId = 0;
					console.error('[SOCKETBUG] ---exit- roomId != checkRoomid  -[userid]:' + room.seats[i].userId + '[roomid]:' + roomId + '[roomid2]:' + checkRoomid);
				}
			}
		}
	}
	userMgr.broacastInRoom('exit_notify_push', userId, room, userId, false);
	emitSocketEvent(socket, 'exit_result');

	roomMgr.exitRoom(userId,roomId);
	userMgr.del(userId);

	socket.disconnect();
}

//房主解散
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
	if (roomMgr.hasBegan(roomId)) {
		return;
	}

	//如果不是房主，则不能解散房间
	if (roomMgr.isCreator(roomId, userId) == false) {
		return;
	}
	
	var room = roomMgr.getRoom(roomId);
	//特别处理  预防出现一个玩家 有多个房间数据没清除的, 该玩家已经在另一个房间则给该玩家id清楚,以免影响到他所在的房间
	if (room) {
		for (var i = 0; i < room.seats.length; i++) {
			var checkRoomid = roomMgr.getUserRoom(room.seats[i].userId);
			if (checkRoomid) {
				if (checkRoomid != roomId) {
					room.seats[i].userId = 0;
					console.error('[SOCKETBUG] ---dispress- roomId != checkRoomid  -[userid]:' + room.seats[i].userId + '[roomid]:' + roomId + '[roomid2]:' + checkRoomid);
				}
			}
		}
	}
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
	if (roomMgr.hasBegan(roomId) == false) {
		console.log(4);
		return;
	}

	var ret = roomMgr.dissolveRequest(roomId, userId);
	if (ret != null) {
		var dr = ret.dr;
		var ramaingTime = (dr.endTime - Date.now()) / 1000;
		var data = {
			time: ramaingTime,
			states: dr.states
		}
		console.log(5);

		var room = roomMgr.getRoom(roomId);
		//特别处理  预防出现一个玩家 有多个房间数据没清除的, 该玩家已经在另一个房间则给该玩家id清楚,以免影响到他所在的房间
		if (room) {
			for (var i = 0; i < room.seats.length; i++) {
				var checkRoomid = roomMgr.getUserRoom(room.seats[i].userId);
				if (checkRoomid) {
					if (checkRoomid != roomId) {
						room.seats[i].userId = 0;
						console.error('[SOCKETBUG] ---dissolve_request- roomId != checkRoomid  -[userid]:' + room.seats[i].userId + '[roomid]:' + roomId + '[roomid2]:' + checkRoomid);
					}
				}
			}
		}
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
		for (var i = 0; i < dr.states.length; ++i) {
			if (dr.states[i]) {
				doAllAgreeCnt++;
			}
		}

		var half = dr.states.length / 2;
		//过半就同意
		// if(doAllAgreeCnt > half){
		//全部玩家同意才能解散房间
		if (doAllAgreeCnt == dr.states.length) {
			roomMgr.doDissolve(roomId);
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
		//特别处理  预防出现一个玩家 有多个房间数据没清除的, 该玩家已经在另一个房间则给该玩家id清楚,以免影响到他所在的房间
		if (room) {
			for (var i = 0; i < room.seats.length; i++) {
				var checkRoomid = roomMgr.getUserRoom(room.seats[i].userId);
				if (checkRoomid) {
					if (checkRoomid != roomId) {
						room.seats[i].userId = 0;
						console.error('[SOCKETBUG] ---dissolve_reject- roomId != checkRoomid  -[userid]:' + room.seats[i].userId + '[roomid]:' + roomId + '[roomid2]:' + checkRoomid);
					}
				}
			}
		}
		userMgr.broacastInRoom('dissolve_cancel_push', {}, room, userId, true);
	}
}
//俱乐部投票踢人
handlers.kickout_request = function (socket, data) {
	console.log('kickout_request', data);
	var userId = socket.userId;//发起人
	var target = JSON.parse(data).target;//被踢人
	if (userId == null || target == null) {
		return;
	}

	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		console.log(3);
		return;
	}

	//如果游戏已经开始，则不可以发起踢人请求
	if (roomMgr.hasBegan(roomId)) {
		console.log('游戏已经开始，不可以发起踢人请求');
		return;
	}

	var ret = roomMgr.kickOutRequest(roomId, userId, target);
	if (ret != null) {
		var data = ret.kick;
		console.log('kickrequest', data);

		var room = roomMgr.getRoom(roomId);
		//特别处理  预防出现一个玩家 有多个房间数据没清除的, 该玩家已经在另一个房间则给该玩家id清楚,以免影响到他所在的房间
		if (room) {
			for (var i = 0; i < room.seats.length; i++) {
				var checkRoomid = roomMgr.getUserRoom(room.seats[i].userId);
				if (checkRoomid) {
					if (checkRoomid != roomId) {
						room.seats[i].userId = 0;
						console.error('[SOCKETBUG] ---kickout_request- roomId != checkRoomid  -[userid]:' + room.seats[i].userId + '[roomid]:' + roomId + '[roomid2]:' + checkRoomid);
					}
				}
			}
		}
		userMgr.broacastInRoom('kickout_notice_push', data, room, userId, true);
	}
}

handlers.kickout_Agree = function (socket, data) {
	var userId = socket.userId;
	var agree = JSON.parse(data).agree;
	// console.log('kickout_Agree', data);
	// console.log('userId', userId);
	if (userId == null || agree == null) {
		return;
	}

	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}

	var ret = roomMgr.kickOutAgree(roomId, userId, agree);
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

	//清除玩家的在线信息
	userMgr.del(userId);

	var roomId = roomMgr.getUserRoom(userId);
	var room = roomMgr.getRoom(roomId);
	//通知房间内其它玩家
	userMgr.broacastInRoom('user_state_push', data, room, userId);

	if (room) {
		var seatIndex = roomMgr.getUserSeat(userId);
		var seat = null;
		if (seatIndex >= 0) {
			seat = room.seats[seatIndex];
			seat.ip = null;
		}
		roomMgr.computeOnlineCnt(room);

		// if (room.gameMgr && room.playing == false && seat) {
		// 	roomMgr.setReady(userId, true);
		// 	//托管自动准备
		// 	if (room && room.gameMgr) {
		// 		room.gameMgr.autoReadyHostingUsers(roomId);
		// 	}
		// }
	}
	socket.userId = null;
}

handlers.jiaoDiZhu = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	socket.gameMgr.jiaoDiZhu(socket.userId);
}

handlers.buJiao = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	socket.gameMgr.buJiao(socket.userId);
}

handlers.mingPai = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	socket.gameMgr.mingPai(socket.userId);
}

handlers.qiangDiZhu = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	socket.gameMgr.qiangDiZhu(socket.userId);
}

handlers.buQiang = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	socket.gameMgr.buQiang(socket.userId);
}

handlers.ddzChuPai = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	data = JSON.parse(data);
	socket.gameMgr.ddzChuPai(socket.userId, data);
}

handlers.ddzBuChu = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	socket.gameMgr.ddzBuChu(socket.userId);
};

handlers.thirteenCommitPutCards = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	data = JSON.parse(data);

	var userId = socket.userId;

	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}
	var roomInfo = roomMgr.getRoom(roomId);
	if (roomInfo == null) {
		return;
	}
	var game = roomInfo.game;
	if (game) {

		game.thirteenCommitPutCards(userId, data);
	}
};

//强制出牌
handlers.force_put_cards = function (socket, data) {
	if (socket.userId == null) {
		return;
	}

	var userId = socket.userId;
	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}
	var room = roomMgr.getRoom(roomId);
	if (room == null) {
		return;
	}
	var game = room.game;
	if (game) {
		game.force_put_cards(userId);
	}
};

//取消托管
handlers.cancel_hosting = function (socket, data) {
	if (socket.userId == null) {
		return;
	}

	var userId = socket.userId;
	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}
	var room = roomMgr.getRoom(roomId);
	if (room == null) {
		return;
	}
	var game = room.game;
	if (game) {
		game.cancel_hosting(userId);
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