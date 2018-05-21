var fibers = require('fibers');
var crypto = require('../../externals/utils/crypto');
var roomMgr = require('./roommgr');
var tokenMgr = (require("../../externals/game_utils/tokenmgr")).getTokenMgr('niuniu');
var userMgr = (require('../../externals/game_utils/usermgr')).getUserMgr('niuniu');
var adapter = require("./games/niuniu_msg_adapter").NetAdapter;

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
	http.send(res, {
		code: 0,
		msg: 'ok'
	}, null, true);
});

var io = null;
var config = null;
var handlers = {};
var userOnline = 0;
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
		emitSocketEvent(socket, 'login_result', {
			errcode: 1,
			errmsg: "invalid parameters"
		});
		return;
	}

	//检查参数是否被篡改
	var md5 = crypto.md5(roomId + token + time + config.ROOM_PRI_KEY);
	if (md5 != sign) {
		console.log(2);
		emitSocketEvent(socket, 'login_result', {
			errcode: 2,
			errmsg: "login failed. invalid sign!"
		});
		return;
	}

	//检查token是否有效
	if (tokenMgr.isTokenValid(token) == false) {
		console.log(3);
		emitSocketEvent(socket, 'login_result', {
			errcode: 3,
			errmsg: "token out of time."
		});
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

	roomMgr.checkRoomState(roomId, userId);
	userOnline++;
};

handlers.room_ready = function (socket, data) {
	var userId = socket.userId;
	if (userId == null) {
		return;
	}
	roomMgr.setReady(userId, true);
};
//获取牌池的牌
handlers.get_tempcard = function (socket, data){
	var tempdata=JSON.parse(data);
	 var userId = socket.userId;
	
	var roomid = tempdata.roomid;
	console.log(roomid)
	console.log(userId)
	if (roomid == null||userId==null) {
		return;
	}
	var ret = roomMgr.getcard(roomid);
	console.log("-----------")
	console.log(ret)
	emitSocketEvent(socket, "get_tempcard", ret);
	return ;

};

//选择了那些牌//需要roomid.type为0.表示没有找到这个数据。返回一个空的集合
//type为1成功换牌。返回一个空的集合
//type为2表示数据和其他翻牌玩家重复。重新返回一个新的牌池重新选择
handlers.del_tempcard = function (socket, data){
	var tempdata=JSON.parse(data);
	var roomid = tempdata.roomid;
	var number = tempdata.number;
	var userId = socket.userId;
	
	if (roomid == null || number == null||userId==null) {
		return;
	}
	var ret = roomMgr.delcard(roomid,number,userId);

	if (ret.code = 0) {
		var data = {
			type: 0,
			list: new Array()
		}
		emitSocketEvent(socket, "del_tempcard", data);

	} else if (ret.code = 1) {
		var data = {
			type: 1,
			list: ret.list
		}
		emitSocketEvent(socket, "del_tempcard",data);

	} else {

		var data = {
			type: 2,
			list:ret.list

		}
		emitSocketEvent(socket, "del_tempcard", data);
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
	} else if (typeof (data) == "string") {
		pai = parseInt(data);
	} else {
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
	userMgr.broacastInRoom('chat_push', {
		sender: socket.userId,
		content: chatContent
	}, room, socket.userId, true);
}
handlers.quick_chat = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	var chatId = data;

	var roomId = roomMgr.getUserRoom(socket.userId);
	var room = roomMgr.getRoom(roomId);
	userMgr.broacastInRoom('quick_chat_push', {
		sender: socket.userId,
		content: chatId
	}, room, socket.userId, true);
}
handlers.voice_msg = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	console.log(data.length);

	var roomId = roomMgr.getUserRoom(socket.userId);
	var room = roomMgr.getRoom(roomId);
	userMgr.broacastInRoom('voice_msg_push', {
		sender: socket.userId,
		content: data
	}, room, socket.userId, true);
}
handlers.emoji = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	var phizId = data;

	var roomId = roomMgr.getUserRoom(socket.userId);
	var room = roomMgr.getRoom(roomId);
	userMgr.broacastInRoom('emoji_push', {
		sender: socket.userId,
		content: phizId
	}, room, socket.userId, true);
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
	if (roomMgr.isCreator(userId)) {
		return;
	}

	//通知其它玩家，有人退出了房间
	userMgr.broacastInRoom('exit_notify_push', userId, roomMgr.getRoom(roomId), userId, false);
	emitSocketEvent(socket, 'exit_result');

	roomMgr.exitRoom(userId);
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

		var maxCount = 0;
		for (var i = 0; i < room.seats.length; ++i) {
			if (room.seats[i].userId > 0) {
				++maxCount;
			}
		}

		var half = Math.floor(maxCount / 2);
		//过半就同意
		if (doAllAgreeCnt > half) {
			roomMgr.doDissolve(roomId);
			// roomMgr.destroy(roomId);
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
}


handlers.callZhuang = function (socket, data) {
	var info = getSocketInfo(socket);
	if (!info) {
		return;
	}
	if (data) {
		data = JSON.parse(data);
	}
	adapter.sendMsg(info.game, info.chairId, "callZhuang", data)
}

handlers.setStake = function (socket, data) {
	var info = getSocketInfo(socket);
	if (!info) {
		return;
	}
	if (data) {
		data = JSON.parse(data);
	}
	adapter.sendMsg(info.game, info.chairId, "setStake", data)
}

handlers.look_at_cards = function (socket, data) {
	var info = getSocketInfo(socket);
	if (!info) {
		return;
	}
	if (data) {
		data = JSON.parse(data);
	}
	adapter.sendMsg(info.game, info.chairId, "look_at_cards", data)
}

handlers.send_cuo_pai = function (socket, data) {
	var info = getSocketInfo(socket);
	if (!info) {
		return;
	}
	adapter.sendMsg(info.game, info.chairId, "send_cuo_pai");
}

handlers.send_anima = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	var userId = socket.userId;
	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}
	var roomInfo = roomMgr.getRoom(roomId);
	if (roomInfo == null) {
		return;
	}
	var chairId = -1;
	for (var i = 0; i < roomInfo.seats.length; ++i) {
		var s = roomInfo.seats[i];
		if (s.userId == userId) {
			chairId = i;
		}
	}
	if (chairId < 0) {
		return;
	}

	if (data) {
		data = JSON.parse(data);
	}

	var seats = roomInfo.seats;
	var msgData = {
		chairId1: chairId,
		chairId2: data.chairId,
		animation: data.animation
	}
	for (var i = 0; i < seats.length; ++i) {
		var s = seats[i];
		if (s.userId > 0) {
			userMgr.sendMsg(s.userId, 'push_anima', msgData);
		}
	}
	// adapter.sendMsg(info.game, info.chairId, "send_anima", data);
}

handlers.confirm_players = function (socket, data) {
	var userId = socket.userId;
	if (userId == null) {
		return;
	}
	roomMgr.startGame(userId);
}

const ALLOW_GIVE_GEMS = 2;
//相互送钻石功能
handlers.give_gems = function (socket, data) {
	var senderId = socket.userId;
	if (senderId == null || data == null) {
		return;
	}

	data = JSON.parse(data);

	var recverId = data.receiver;
	var gems = data.gems;
	if (recverId == null || gems == null || gems != ALLOW_GIVE_GEMS) {
		return;
	}

	var senderRoomId = roomMgr.getUserRoom(senderId);
	var recverRoomId = roomMgr.getUserRoom(recverId);
	if (senderRoomId != recverRoomId) {
		return;
	}

	var ret = roomMgr.giveGems(senderRoomId, senderId, recverId, gems);

	var data = {
		errcode: ret.code,
		errmsg: ret.msg,
	}
	emitSocketEvent(socket, 'give_gems_result', data);
}

function getSocketInfo(socket) {
	if (socket.userId == null) {
		return;
	}
	var userId = socket.userId;
	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}
	var roomInfo = roomMgr.getRoom(roomId);
	if (roomInfo == null) {
		return;
	}
	var chairId = -1;
	for (var i = 0; i < roomInfo.seats.length; ++i) {
		var s = roomInfo.seats[i];
		if (s.userId == userId) {
			chairId = i;
		}
	}
	if (chairId < 0) {
		return;
	}
	if (!roomInfo.game) {
		return;
	}
	return {
		game: roomInfo.game,
		chairId: chairId
	}
}

function emitSocketEvent(socket, event, data) {
	if (!socket) {
		return;
	}
	console.log('emit socket event [' + event + ']');

	var senddata = {
		event: event,
		data: data
	};
	var sendstr = JSON.stringify(senddata);
	if (global.GAME_AES_KEY != null) {
		sendstr = crypto.AesEncrypt(sendstr, global.GAME_AES_KEY, 128);
	}
	socket.emit('gamemsg', {
		msg: sendstr
	});
}

function handleGameMsg(socket, param) {
	console.log('handleGameMsg called. param:' + param);
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
	var handler = handlers[event];
	console.log('[Debug] - handle game msg:' + event);
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

	socket.emit('game_pong');
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

	if (room) {
		var seatIndex = roomMgr.getUserSeat(userId);
		if (seatIndex >= 0) {
			room.seats[seatIndex].ip = null;
		}
		roomMgr.computeOnlineCnt(room);
	}
	userOnline--;
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
/**
 * 后台管理添加获取在线人数
 */
exports.getOnlinePlayers = function () {
	return userOnline;
};

exports.start = function (conf) {
	config = conf;

	var httpServer = require('http').createServer(app);
	io = require('socket.io')(httpServer);
	httpServer.listen(config.GAME_FOR_CLIENT_PORT);

	io.sockets.on('connection', registerHandlers);
	console.log("socket service is listening on " + config.GAME_FOR_CLIENT_PORT);


};