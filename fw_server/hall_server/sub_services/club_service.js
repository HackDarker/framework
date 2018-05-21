
var fibers = require('fibers');
var crypto = require('../../externals/utils/crypto');
var clubmgr = require('./clubmgr');
var tokenMgr = (require("../../externals/game_utils/tokenmgr")).getTokenMgr('club');
var userMgr = (require('../../externals/game_utils/usermgr')).getUserMgr('club');

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
	console.log('data', data);
	console.log('userId', socket.userId);
	var token = data.token;
	var club_id = data.club_id;
	var time = data.time;
	var sign = data.sign;


	//检查参数合法性
	if (token == null || club_id == null || sign == null || time == null) {
		console.log(1);
		emitSocketEvent(socket, 'login_club_result', { errcode: 1, errmsg: "invalid parameters" });
		return;
	}

	//检查参数是否被篡改
	var md5 = crypto.md5(club_id + token + time + config.ROOM_PRI_KEY);
	if (md5 != sign) {
		console.log(2);
		emitSocketEvent(socket, 'login_club_result', { errcode: 2, errmsg: "login failed. invalid sign!" });
		return;
	}

	//检查token是否有效
	if (tokenMgr.isTokenValid(token) == false) {
		console.log(3);
		emitSocketEvent(socket, 'login_club_result', { errcode: 3, errmsg: "token out of time." });
		return;
	}

	//检查房间合法性
	var userId = tokenMgr.getUserID(token);
	var club_id = clubmgr.getUserClub(userId);

	userMgr.bind(userId, socket);
	socket.userId = userId;

	//返回房间信息
	var clubInfo = clubmgr.getClubRoom(club_id);


	var ip = socket.handshake.address;
	if (ip && ip.indexOf("::ffff:") != -1) {
		ip = ip.substr(7);
	}

	//seats 为null
	if (!clubInfo.seats[userId]) {
		emitSocketEvent(socket, 'login_club_result', { errcode: 2, errmsg: "login failed. seats is null" });
		return;
	}

	clubInfo.seats[userId].ip = ip;

	//玩家上线进入俱乐部同步之前保存的最近10条聊天消息
	clubInfo.syncMsg = clubmgr.getSyncMsg(club_id);

	var userData = [];
	//通知前端
	var ret = {
		errcode: 0,
		errmsg: "ok",
		clubInfo: clubInfo,
	};
	emitSocketEvent(socket, 'login_club_result', ret);

	userData = clubInfo.seats[userId];
	//通知其它客户端,玩家上线
	userMgr.broacastInClub('new_members_comes_push', userData, clubInfo, userId);

	socket.clubInfo = clubInfo;

	emitSocketEvent(socket, 'login_club_finished');
};
handlers.chat = function (socket, data) {
	console.log('chat-usreID:', socket.userId);
	if (socket.userId == null) {
		return;
	}
	console.log('chat-content:', data);
	var chatContent = data;

	var club_id = clubmgr.getUserClub(socket.userId);
	var club = clubmgr.getClubRoom(club_id);
	var userInfo = club.seats[socket.userId];
	var isCreator;
	var data = {
		type: 'chat',
		sender: socket.userId,
		content: chatContent,
		name: userInfo.name,
		isCreator: socket.userId == club.creator,
		time: Date.now(),
		headimg: userInfo.headimg
	}
	clubmgr.saveClubChats[club_id].push(data);
	userMgr.broacastInClub('chat_push', [data], club, socket.userId, true);
}
handlers.quick_chat = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	console.log('quick_chat:', data);
	var chatContent = data;

	var club_id = clubmgr.getUserClub(socket.userId);
	var club = clubmgr.getClubRoom(club_id);
	var userInfo = club.seats[socket.userId];
	var isCreator;
	var data = {
		type: 'quick_chat',
		sender: socket.userId,
		content: chatContent,
		name: userInfo.name,
		isCreator: socket.userId == club.creator,
		time: Date.now(),
		headimg: userInfo.headimg
	}
	clubmgr.saveClubChats[club_id].push(data);
	userMgr.broacastInClub('quick_chat_push', [data], club, socket.userId, true);
}
handlers.voice_msg = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	console.log('voice_msg:', data);
	var chatContent = data;

	var club_id = clubmgr.getUserClub(socket.userId);
	var club = clubmgr.getClubRoom(club_id);
	var userInfo = club.seats[socket.userId];
	var isCreator;
	var data = {
		type: 'voice_msg',
		sender: socket.userId,
		content: chatContent,
		name: userInfo.name,
		isCreator: socket.userId == club.creator,
		time: Date.now(),
		headimg: userInfo.headimg
	}
	clubmgr.saveClubChats[club_id].push(data);
	userMgr.broacastInClub('voice_msg_push', [data], club, socket.userId, true);
}
handlers.emoji = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	console.log('emoji:', data);
	var phizId = data;

	var club_id = clubmgr.getUserClub(socket.userId);
	var club = clubmgr.getClubRoom(club_id);
	var userInfo = club.seats[socket.userId];
	var isCreator;
	var data = {
		type: 'emoji',
		sender: socket.userId,
		content: phizId,
		name: userInfo.name,
		isCreator: socket.userId == club.creator,
		time: Date.now(),
		headimg: userInfo.headimg,
	}
	clubmgr.saveClubChats[club_id].push(data);
	userMgr.broacastInClub('emoji_push', [data], club, socket.userId, true);
}
handlers.exit = function (socket, data) {
	if (socket.userId == null) {
		return;
	}
	var phizId = data;

	var club_id = clubmgr.getUserClub(socket.userId);
	var club = clubmgr.getClubRoom(club_id);
	delete club.seats[socket.userId];
	console.log('玩家退出聊天室：', socket.userId);
	if (JSON.stringify(club.seats) == "{}") {//当俱乐部中没人在线时清理内存
		clubmgr.deleteClubRoom(club_id);
	}
	userMgr.del(socket.userId);
	socket.disconnect();
	// userMgr.broacastInClub('emoji_push', { sender: socket.userId, content: phizId }, club, socket.userId, true);
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
		userId: userId,
		online: false
	};

	//清除玩家的在线信息
	userMgr.del(userId);

	var club_id = clubmgr.getUserClub(userId);
	var club = clubmgr.getClubRoom(club_id);
	// //通知房间内其它玩家
	// userMgr.broacastInClub('user_state_push', data, club, userId);

	socket.userId = null;
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
	httpServer.listen(config.CLUB_FOR_CLIENT_PORT);

	io.sockets.on('connection', registerHandlers);
	console.log("socket service is listening on " + config.CLUB_FOR_CLIENT_PORT);
};

