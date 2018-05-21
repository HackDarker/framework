var crypto = require('../../externals/utils/crypto');
var express = require('express');
var http = require('../../externals/utils/http');
var roomMgr = require("./roommgr");
var tokenMgr = (require("../../externals/game_utils/tokenmgr")).getTokenMgr('niuniu');
var fibers = require('fibers');
//var socket = require('./socket_service');

var app = express();
var config = null;

var encryptRoutMgr = ((global.HTTP_AES_KEY != null) ? new http.HttpRoutMgr() : app);
var serverIp = "";

//测试
app.all('*', function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
	res.header("X-Powered-By", ' 3.2.1');
	res.header("Content-Type", "application/json;charset=utf-8");
	fibers(function () {
		next();
	}).run();
});

if (global.HTTP_AES_KEY != null) {
	app.get('/sec', function (req, res) {
		var arr = req.originalUrl.split('?');
		if (arr.length >= 2) {
			var url = arr[1];
			url = crypto.AesDecrypt(url, global.HTTP_AES_KEY, 128);

			var urlobj = JSON.parse(url);
			var path = urlobj.path;
			req.query = urlobj.extra;

			encryptRoutMgr.rout(req.method, path, req, res);
		}
	});
}

app.get('/get_server_info', function (req, res) {
	var serverId = req.query.serverid;
	var sign = req.query.sign;
	console.log(serverId);
	console.log(sign);
	if (serverId != config.SERVER_ID || sign == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}

	var md5 = crypto.md5(serverId + config.ROOM_PRI_KEY);
	if (md5 != sign) {
		http.send(res, GAME_ERRS.CHECK_SIGN_FAILED);
		return;
	}

	var locations = roomMgr.getUserLocations();
	var arr = [];
	for (var userId in locations) {
		var roomId = locations[userId].roomId;
		arr.push(userId);
		arr.push(roomId);
	}
	http.send(res, RET_OK, {
		userroominfo: arr
	});
});

app.get('/create_room', function (req, res) {
	var userId = parseInt(req.query.userid);
	var sign = req.query.sign;
	var gems = req.query.gems;
	var conf = req.query.conf
	var gametype = req.query.gametype;
	var gamemode = req.query.gamemode;
	var serverid = req.query.serverid;

	if (userId == null ||
		sign == null ||
		conf == null ||
		gametype == null ||
		gamemode == null ||
		serverid == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
		return;
	}

	var md5 = crypto.md5(userId + conf + gems + config.ROOM_PRI_KEY);
	if (md5 != req.query.sign) {
		console.log("invalid reuqest.");
		http.send(res, GAME_ERRS.CHECK_SIGN_FAILED, null, true);
		return;
	}

	conf = JSON.parse(conf);
	var result = roomMgr.createRoom(userId, conf, gems, gametype, gamemode, serverid);
	console.log('==================',result)
	if (result.ret.code != 0 || result.roomId == null) {
		http.send(res, result.ret, null, true);
		return;
	} else {
		http.send(res, RET_OK, { roomid: result.roomId }, true);
	}
});




app.get('/startohergame', function (req, res) {
	var userId = parseInt(req.query.userId);
	var roomId = req.query.roomId;


	if (userId == null ||
		roomId == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}



	var quest = roomMgr.startsgame(roomId, userId);
	var mess={
		code:0,
		msg:"ok"
	}
	var data={
		quest:quest
	}
   http.send(res, mess,data);
		return;


});



app.get('/enter_room', function (req, res) {
	var userId = parseInt(req.query.userid);
	var name = req.query.name;
	var userip = req.query.userip;
	var roomId = req.query.roomid;
	var sign = req.query.sign;
	var gametype = req.query.gametype;
	var gamemode = req.query.gamemode;

	if (userId == null ||
		roomId == null ||
		userip == null ||
		sign == null ||
		gametype == null ||
		gamemode == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
		return;
	}

	var md5 = crypto.md5(userId + name + roomId + config.ROOM_PRI_KEY);
	console.log(req.query);
	console.log(md5);
	if (md5 != sign) {
		http.send(res, GAME_ERRS.CHECK_SIGN_FAILED, null, true);
		return;
	}

	//安排玩家坐下
	var ret = roomMgr.enterRoom(roomId, userId, name, userip, gametype, gamemode);
	console.log(ret);

	if (ret.code !== 0) {
		http.send(res, ret);
		return;
	}

	var token = tokenMgr.createToken(userId, 5000);
	http.send(res, RET_OK, { token: token }, true);
});

app.get('/ping', function (req, res) {
	var sign = req.query.sign;
	var md5 = crypto.md5(config.ROOM_PRI_KEY);
	if (md5 != sign) {
		return;
	}
	http.send(res, RET_OK);
});
/**
 * 获取在线房间和玩家(后台管理系统添加)
 */
// app.get('/get_online_rooms_and_players', function (req, res) {
// 	var playing = parseInt(req.query.playing);
// 	playing = isNaN(playing) ? null : playing;


// 	var olRooms = roomMgr.getOnlineRooms(playing == 1);

// 	var olPlayers = socket.getOnlinePlayers();

// 	var todayOlRooms = roomMgr.getTodayOnlineRooms();

// 	// RET_OK
// 	var ret = {
// 		code: 0,
// 		msg: "ok"
// 	};
// 	http.send(res, ret, {
// 		rooms: olRooms,
// 		today_rooms: todayOlRooms,
// 		players: olPlayers
// 	}, true);
// });





app.get('/is_room_runing', function (req, res) {
	var roomId = req.query.roomid;
	var sign = req.query.sign;
	if (roomId == null || sign == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}

	var md5 = crypto.md5(roomId + config.ROOM_PRI_KEY);
	if (md5 != sign) {
		http.send(res, GAME_ERRS.CHECK_SIGN_FAILED);
		return;
	}

	var roomInfo = roomMgr.getRoom(roomId);
	http.send(res, RET_OK, {
		runing: roomInfo != null
	});
});

var gameServerInfo = null;
var lastTickTime = 0;

//向大厅服定时心跳
function update() {
	if (lastTickTime + config.HTTP_TICK_TIME < Date.now()) {
		lastTickTime = Date.now();
		gameServerInfo.load = roomMgr.getTotalRooms();
		http.get(config.HALL_FOR_GAME_IP, config.HALL_FOR_GAME_PORT, "/register_gs", gameServerInfo, function (ret, data) {
			if (ret == true) {
				if (data.errcode != 0) {
					console.log(data.errmsg);
				}

				if (data.ip != null) {
					serverIp = data.ip;
				}
			} else {
				//
				lastTickTime = 0;
			}
		});

		var mem = process.memoryUsage();
		var format = function (bytes) {
			return (bytes / 1024 / 1024).toFixed(2) + 'MB';
		};
		//console.log('Process: heapTotal '+format(mem.heapTotal) + ' heapUsed ' + format(mem.heapUsed) + ' rss ' + format(mem.rss));
	}
}

exports.start = function (conf) {
	config = conf;

	//
	gameServerInfo = {
		id: config.SERVER_ID,
		type: config.GAME_TYPE,
		mode: config.GAME_MODE,
		clientip: config.GAME_FOR_CLIENT_IP,
		clientport: config.GAME_FOR_CLIENT_PORT,
		httpPort: config.GAME_FOR_HALL_PORT,
		load: roomMgr.getTotalRooms(),
	};

	setInterval(update, 1000);
	app.listen(config.GAME_FOR_HALL_PORT, config.GAME_FOR_HALL_IP);
	console.log("http service is listening on " + config.GAME_FOR_HALL_IP + ":" + config.GAME_FOR_HALL_PORT);
};

app.get('/get_room_player_num', function (req, res) {
	console.log(req.query.roomList);
	var arr = [];
	if (typeof (req.query.roomList) == "string") {
		arr[0] = req.query.roomList;
	} else {
		arr = req.query.roomList;
	}
	var playerNumArr = [];
	for (var i = 0; i < arr.length; ++i) {
		var room = roomMgr.getRoom(arr[i]);
		var num = 0;
		for (var j = 0; j < room.seats.length; ++j) {
			var seat = room.seats[j];
			if (seat.userId > 0) {
				++num;
			}
		}
		playerNumArr[i] = num;
	}
	http.send(res, RET_OK, playerNumArr);
});