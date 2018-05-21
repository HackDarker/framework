// require("hot-require");
var crypto = require('../../externals/utils/crypto');
var express = require('express');
var db = require('../../externals/utils/dbsync');
var http = require('../../externals/utils/http');
var roomMgr = require("./roommgr");
// var userMgr = require("./usermgr");
// var tokenMgr = require("./tokenmgr");
var tokenMgr = (require("../../externals/game_utils/tokenmgr")).getTokenMgr('srddz');
var userMgr = (require('../../externals/game_utils/usermgr')).getUserMgr('srddz');

var consts = require('../../externals/utils/consts');
const CASH_CHANGE_RESONS = consts.CashChangeResons;

// var gameMgr = require("./gamemgr_zzmj");
var app = express();
var config = null;

var serverIp = "";

//测试
app.all('*', function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
	res.header("X-Powered-By", ' 3.2.1');
	res.header("Content-Type", "application/json;charset=utf-8");
	next();
});

app.get('/get_server_info', function (req, res) {
	var serverId = req.query.serverid;
	var sign = req.query.sign;
	if (serverId != config.SERVER_ID || sign == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
		return;
	}

	var md5 = crypto.md5(serverId + config.ROOM_PRI_KEY);
	if (md5 != sign) {
		http.send(res, GAME_ERRS.CHECK_SIGN_FAILED, null, true);
		return;
	}

	var locations = roomMgr.getUserLocations();
	var arr = [];
	for (var userId in locations) {
		var roomId = locations[userId].roomId;
		arr.push(userId);
		arr.push(roomId);
	}
	http.send(res, RET_OK, { userroominfo: arr }, true);
});
app.get('/create_room', function (req, res) {
	var userId = parseInt(req.query.userid);
	var sign = req.query.sign;
	var gems = req.query.gems;
	var conf = req.query.conf;
	var gametype = req.query.gametype;
	var gamemode = req.query.gamemode;
	var serverid = req.query.serverid;

	if (userId == null || sign == null || conf == null ||
		gametype == null ||
		gamemode == null ||
		serverid == null) {
		http.send(res, 1, "invalid parameters");
		return;
	}

	var md5 = crypto.md5(userId + conf + gems + config.ROOM_PRI_KEY);
	if (md5 != req.query.sign) {
		console.log("invalid reuqest.");
		http.send(res, 1, "sign check failed.");
		return;
	}
	console.log('/create_room', conf);
	conf = JSON.parse(conf);
	var gameList = ['srddz'];
	if (gameList.indexOf(conf.type) == -1) {
		// callback(1,null);
		return;
	}

	var gameMgr = require("./games/gamemgr_" + conf.type);//_require("./gamemgr_" + conf.type);
	// 代开房间先扣除豆子
	if (conf.dkfj && !conf.srzf) {//俱乐部不走这里
		if (conf.type != 'niuniu') {
			var costgem = gameMgr.getJushuCost(conf.jushuxuanze, true);
		} else {
			var costgem = gameMgr.getJushuCost(conf.jushu, true);
		}

		if (conf.type == 'jdmj') {
			console.log("房费_元宝：", costgem);
			var isyuanbao = true;
		} else {
			console.log("房费_钻石：", costgem);
			var isyuanbao = false;
		}

		if (costgem > gems) {
			http.send(res, { code: 6005, msg: "代开房间 create failed." }, null, true);
			return;
		}

		// roomMgr.createRoom(userId, conf, gems, serverIp, config.GAME_FOR_CLIENT_PORT, function (errcode, roomId) {
		roomMgr.createRoom(userId, conf, gems, gametype, gamemode, serverid, function (errcode, roomId) {
			console.log(errcode + " : " + roomId);
			if (errcode != 0 || roomId == null) {
				http.send(res, { code: errcode, msg: "create failed." }, null, true);
				return;
			}
			else {
				// http.send(res,0,"ok",{roomid:roomId});
				console.log('代开房间创建成功')
				http.send(res, RET_OK, { roomid: roomId, gems: gems - costgem }, true);

			}
		});

	}
	else {
		// 非 四人支付就是房主支付
		if (!conf.srzf) {//房主支付
			if (conf.type != 'niuniu') {
				var costgem = gameMgr.getJushuCost(conf.jushuxuanze, !conf.srzf);
			} else {
				var costgem = gameMgr.getJushuCost(conf.jushu, !conf.srzf);
			}

			if (costgem > gems) {

				if (conf.type != 'jdmj') {
					http.send(res, { code: 6005, msg: "房主支付 not enough gems" }, null, true);
				} else if (conf.type == 'jdmj') {
					http.send(res, 6005, "房主支付 not enough yuanbao");
				}
				return;
			}
		}

		// roomMgr.createRoom(userId, conf, gems, serverIp, config.GAME_FOR_CLIENT_PORT, function (errcode, roomId) {
		roomMgr.createRoom(userId, conf, gems, gametype, gamemode, serverid, function (errcode, roomId) {
			if (errcode != 0 || roomId == null) {
				http.send(res, { code: errcode, msg: "create failed." }, null, true);
				return;
			}
			else {
				// http.send(res, 0, "ok", { roomid: roomId, gems: gems });
				http.send(res, RET_OK, { roomid: roomId, gems: gems }, true);
			}
		});
	}
});

app.get('/is_agent_room_begin', function (req, res) {
	var r = false;
	var roomId = req.query.roomid;
	var room = roomMgr.getRoom(roomId);
	if (room && room.gameMgr) {
		r = room.gameMgr.deletehasBegan(roomId);
		// r = room.gameMgr.hasBegan(roomId);
	}
	http.send(res, RET_OK, { roomid: roomId, begin: r }, true);
});

app.get('/enter_room', function (req, res) {
	var userId = parseInt(req.query.userid);
	var name = req.query.name;
	var roomId = req.query.roomid;
	var sign = req.query.sign;
	var userIp = req.query.userip;
	if (userId == null || roomId == null || sign == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER, "invalid parameters");//1
		return;
	}

	var md5 = crypto.md5(userId + name + roomId + config.ROOM_PRI_KEY);
	if (md5 != sign) {
		http.send(res, GAME_ERRS.CHECK_SIGN_FAILED, "sign check failed."); //2
		return;
	}
	//安排玩家坐下
	roomMgr.enterRoom(roomId, userId, name, userIp, function (ret) {
		if (ret != 0) {
			if (ret == 1) {
				http.send(res, GAME_ERRS.ROOM_IS_FULL, { msg: "room is full." }, true);//ROOM_IS_FULL 4
			} else if (ret == 2) {
				http.send(res, GAME_ERRS.ROOM_IS_NOT_EXISTED, { msg: "can't find room." }, true);//ROOM_IS_NOT_EXISTED 3
			} else if (ret == 3) {
				http.send(res, GAME_ERRS.GEMS_NOT_ENOUGH, { msg: "钻石不够" }, true);//GEMS_NOT_ENOUGH 5
			} else if (ret == 4) {
				http.send(res, { code: 6, msg: "元宝不够" }, {}, true);
			} else if (ret == 5) {
				http.send(res, GAME_ERRS.IP_STRICT, { msg: '房间开启IP相同禁止进入！' }, true);//IP_STRICT 7
			}
			return;
		}
		var gameType = roomMgr.getRoom(roomId).conf.type;
		var token = tokenMgr.createToken(userId, 5000);
		http.send(res, RET_OK, { token: token, gameType: gameType }, true);
	});
});

app.get('/ping', function (req, res) {
	var sign = req.query.sign;
	var md5 = crypto.md5(config.ROOM_PRI_KEY);
	if (md5 != sign) {
		return;
	}
	http.send(res, 0, "pong");
});

app.get('/is_room_runing', function (req, res) {
	var roomId = req.query.roomid;
	var sign = req.query.sign;
	if (roomId == null || sign == null) {
		http.send(res, 1, "invalid parameters");
		return;
	}

	var md5 = crypto.md5(roomId + config.ROOM_PRI_KEY);
	if (md5 != sign) {
		http.send(res, 2, "sign check failed.");
		return;
	}

	//var roomInfo = roomMgr.getRoom(roomId);
	http.send(res, 0, "ok", { runing: true });
});

app.get('/is_user_renewed', function (req, res) {
	var roomId = req.query.room_id;
	var userId = req.query.user_id;

	if (roomId == null || userId == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
		return;
	}

	var ret = roomMgr.isUserRenewed(roomId, userId);
	http.send(res, RET_OK, { renewed: ret ? 1 : 0 }, true);
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
			}
			else {
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

//=============================跨服获取比赛场数据--start
//比赛场创建房间
app.get('/createMatchRoom', (req, res) => {
	console.log('============请求创建比赛房间============');
    roomMgr.createMatchRoom(req.query, (data) => {
        if (data.code == 0) {
			http.send(res, RET_OK, { roomId:data.roomId }, true);
           // http.send(res, 1, {roomId:data.roomId});
        }
    })
})

//同步排名信息
app.get('/ranking_match_push', (req, res) => {
	console.log('========同步排名信息==========',req.query.match_score);
    if (req.query.userId == null) {
        return
    }
    let data = {
        match_score: req.query.match_score,
        match_top: req.query.match_top,
        matchData: JSON.parse(req.query.matchData),
        userId: req.query.userId
	}
	roomMgr.ranking_match_push(req.query.userId, 'ranking_match_push', data)
	//http.send(res, 0, "ok")
	http.send(res, RET_OK, {}, true);
})

//=============================跨服获取比赛场--end

exports.start = function ($config) {
	config = $config;

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
	console.log("game server is listening on " + config.GAME_FOR_HALL_IP + ":" + config.GAME_FOR_HALL_PORT);
};