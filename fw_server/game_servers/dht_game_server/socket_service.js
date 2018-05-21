var fibers = require('fibers');
var crypto = require('../../externals/utils/crypto');
var roomMgr = require('./roommgr');
var tokenMgr = (require("../../externals/game_utils/tokenmgr")).getTokenMgr('dht');
var userMgr = (require('../../externals/game_utils/usermgr')).getUserMgr('dht');


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

	function getMatchRoomScore() {
		return new Promise((resolve, reject) => {
			if (roomInfo.conf.bsc) {
				roomMgr.get_match_room_info(roomInfo.conf.matchData.matchId, roomInfo.id, (res) => {
					resolve(res)
				})
			} else {
				resolve({})
			}
		})
	}
	getMatchRoomScore().then((res) => {
		var match_room = res.match_room;

		var userData = null;
		var seats = [];
		for (var i = 0; i < roomInfo.seats.length; ++i) {
			var rs = roomInfo.seats[i];
			var online = false;
			if (rs.userId > 0) {
				online = userMgr.isOnline(rs.userId);
			}
			//比赛场分数
			var match_score = 0;
			if (match_room && match_room[rs.userId]) {
				match_score = match_room[rs.userId].match_score
			}
			if(roomInfo.conf.bsc){
				//同步玩家之前牌局分数,即玩家总分
				rs.score = match_score;
			}

			seats.push({
				userid: rs.userId,
				ip: rs.ip,
				gps_data: rs.gpsData,
				//score: rs.score,
				score: roomInfo.conf.bsc ? match_score : rs.score,//比赛场分数 和不比赛分数
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
				seats: seats,
				matchData: roomInfo.conf.bsc ? roomInfo.conf.matchData : null //比赛场参数
			}
		};
		console.log('====通知玩家进入房间=====[userid]', userId);
		emitSocketEvent(socket, 'login_result', ret);

		socket.roomInfo = roomInfo;
		socket.gameMgr = roomInfo.gameMgr;

		//玩家上线，强制设置为TRUE
		if (userData && userData.ready || socket.roomInfo.conf.bsc) {//
			socket.gameMgr.setReady(userId);
		}
		//通知客户端
		userMgr.broacastInRoom('mj_user_comes_push', seats, roomInfo, userId, true);

		emitSocketEvent(socket, 'login_finished');
		if (roomInfo.conf.type == "dht") {
			socket.gameMgr.syncLocation(userId, userData);//gps
		}

		//通知申请解散房间
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
			}, 1000);
		}

		roomMgr.computeOnlineCnt(roomInfo);

	}).catch(error => {
		// 处理 getJSON 和 前一个回调函数运行时发生的错误
		console.log('发生错误！', error);
	});
};

//gps
handlers.getLocation = function (socket, data) {
	var userId = socket.userId;
	if (userId == null) return;
	try {
		data = JSON.parse(data);
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
	userMgr.broacastInRoom('room_user_ready_push', { userid: userId, ready: true }, room, userId, true);
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

//切换后台是否离线状态
handlers.setonline = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	if (data == null) {
		return;
	}
	console.log("------online------[userId]:" + socket.userId + '[online]:' + data);
	var temp = {
		userid: socket.userId,
		online: data
	};

	var roomId = roomMgr.getUserRoom(socket.userId);
	var room = roomMgr.getRoom(roomId);
	userMgr.broacastInRoom('user_state_push', temp, room, socket.userId);
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

//互动表情
handlers.daoju = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	var data = JSON.parse(data);
	var phizId = data.daojuname;
	var target = data.target;
	var roomId = roomMgr.getUserRoom(socket.userId);
	var room = roomMgr.getRoom(roomId);
	userMgr.broacastInRoom('daoju_push', { sender: socket.userId, target: target, content: phizId }, room, socket.userId, true);
}

//踢人接口 
handlers.kick = function (socket, data) {//余姚
	//被踢的玩家id
	var kickuserId = data;
	var userId = socket.userId
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
	if (roomMgr.isCreator(userId) && !room.conf.club_id) {//非俱乐部房
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
	userMgr.broacastInRoom('exit_notify_push', kickuserId, room, userId, false);
	userMgr.broacastInRoom('Tiren_push', kickuserId, room, userId, true);

	userMgr.kickOne(kickuserId);
	roomMgr.exitRoom(kickuserId, roomId);
	//玩家退出更新gps 信息
	socket.gameMgr.syncLocation(userId, roomId);
	// userMgr.del(userId);
};
//退出房间接口
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
	if (roomMgr.isCreator(userId) && !room.conf.club_id) {//非俱乐部房
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
					console.error('[SOCKETBUG] ---exit- roomId != checkRoomid  -[userid]:' + room.seats[i].userId + '[roomid]:' + roomId + '[roomid2]:' + checkRoomid);
				}
			}
		}
	}
	//通知其它玩家，有人退出了房间
	userMgr.broacastInRoom('exit_notify_push', userId, room, userId, false);
	emitSocketEvent(socket, 'exit_result');

	roomMgr.exitRoom(userId, roomId);
	userMgr.del(userId);
	socket.disconnect();
	//玩家退出更新gps 信息
	socket.gameMgr.syncLocation(userId, roomId);
}

//特殊退出房间接口  只有出现局数大于0  玩家只有1-3个时候才走这里
handlers.exitTow = function (socket, data) {
	var userId = socket.userId;
	if (userId == null) {
		return;
	}

	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}

	var room = roomMgr.getRoom(roomId);
	var seatsBool = false;
	if (room) {
		for (var i = 0; i < room.seats.length; i++) {
			if (room.seats[i].userId <= 0) {
				seatsBool = true;
				console.error('[BUGSOCKET]---exitTow---[roomid]:' + roomId, "[userid]" + userId);
				//break;
			} else {
				//特别处理  预防出现一个玩家 有多个房间数据没清除的, 该玩家已经在另一个房间则给该玩家id清楚,以免影响到他所在的房间
				var checkRoomid = roomMgr.getUserRoom(room.seats[i].userId);
				if (checkRoomid) {
					if (checkRoomid != roomId) {
						room.seats[i].userId = 0;
						console.error('[SOCKETBUG] ---exitTow- roomId != checkRoomid  -[userid]:' + room.seats[i].userId + '[roomid]:' + roomId + '[roomid2]:' + checkRoomid);
					}
				}
			}
		}
	}

	if (seatsBool) {
		//通知其它玩家，有人退出了房间
		userMgr.broacastInRoom('exit_notify_push', userId, room, userId, false);
		emitSocketEvent(socket, 'exit_result');
		roomMgr.exitRoom(userId, roomId);
		userMgr.del(userId);
		socket.disconnect();
		//玩家退出更新gps 信息
		socket.gameMgr.syncLocation(userId, roomId);
	}

}

handlers.baoting = function (socket, data) {
	var userId = socket.userId;
	if (userId == null) {
		return;
	}
	socket.gameMgr.baoTing(userId, data);
}
//房主解散房间走这里
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

	var room = roomMgr.getRoom(roomId);

	//如果不是房主，则不能解散房间  如果是俱乐部,不能走这里
	if (roomMgr.isCreator(roomId, userId) == false && room && room.conf.club_id > 0) {
		return;
	}

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
//申请解散房间
handlers.dissolve_request = function (socket, data) {
	var userId = socket.userId;
	if (userId == null) {
		return;
	}

	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		return;
	}

	if (roomId != data) {
		console.error('[SOCKETBUG] ---dissolve_request- roomId != Roomid  -[userid]:' + userId + '[roomid]:' + roomId + '[roomid2]:' + data);
		//return;
	}


	//如果游戏未开始，则不可以
	if (roomMgr.hasBegan(roomId) == false) {
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
//同意解散房间投票走这里
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
		for (var i = 0; i < dr.states.length; ++i) {
			if (dr.states[i] == false) {
				//doAllAgreeCnt++;
				doAllAgree = false;
			}
		}

		var half = dr.states.length / 2;
		//全部玩家同意才能解散房间
		if (doAllAgree) {
			roomMgr.doDissolve(roomId);
		}
	}
}
//拒绝申请解散房间走这里
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

//俱乐部投票踢人
handlers.kickout_request = function (socket, data) {
	// console.log('kickout_request', data);
	var userId = socket.userId;//发起人
	var target = JSON.parse(data).target;//被踢人
	var roomId2 = JSON.parse(data).roomId;//房间号

	if (userId == null || target == null) {
		console.log('kickout_request  参数异常');
		return;
	}

	var roomId = roomMgr.getUserRoom(userId);
	if (roomId == null) {
		console.error('[SOCKETBUG] ---kickout_request- roomId is null -[userid]:' + userId + '[roomid]:' + roomId2);
		return;
	}


	if (roomId2 != roomId) {
		console.error('[SOCKETBUG] ---kickout_request-[roomId != roomId2]--[userid]:' + userId + '[roomid]:' + roomId + '[roomid2]' + roomId2);
		return;
	}

	//如果游戏已经开始，则不可以发起踢人请求
	if (roomMgr.hasBegan(roomId)) {
		console.log('游戏已经开始，不可以发起踢人请求');
		return;
	}

	var roomId3 = roomMgr.getUserRoom(target);
	if (roomId3 == null || roomId3 != roomId) {
		console.error('[SOCKETBUG] ---kickout_target-[roomId != roomId3]--[userid]:' + userId + '[target]:' + target + '[roomid]:' + roomId + '[roomid2]' + roomId3);
		return;
	}

	var ret = roomMgr.kickOutRequest(roomId, userId, target);
	if (ret != null) {
		var data = ret.kick;
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
//投票同意或者拒绝踢人
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

	roomMgr.kickOutAgree(roomId, userId, agree);
}

//比赛场--start

//游戏场景中同步比赛数据(待更名为match_sync)
handlers.get_match_data = function (socket) {
	console.log('scoket_service');
	roomMgr.detail_match_push(socket.userId, (data) => {
		userMgr.sendMsg(socket.userId, 'match_data_push', data)
	})
}

//比赛场--end

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
	roomMgr.computeOnlineCnt(roomInfo);
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
	console.log("handle game msg:" + event);
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