var crypto = require('../externals/utils/crypto');
var express = require('express');
var db = require('../externals/utils/dbsync');
var http = require('../externals/utils/http');
var fibers = require('fibers');

var app = express();

var hallIp = null;
var config = null;
var rooms = {};
var serverMap = {};
var roomIdOfUsers = {};

//设置跨域访问
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

app.get('/register_gs', function (req, res) {
	var ip = req.ip;
	if (ip.indexOf("::ffff:") != -1) {
		ip = ip.substr(7);
	}
	var clientip = req.query.clientip;
	var clientport = req.query.clientport;
	var httpPort = req.query.httpPort;
	var load = req.query.load;

	var serverid = req.query.id;
	var servertype = req.query.type;
	var servermode = req.query.mode;
	var addr = servertype + ":" + servermode + ":" + serverid;

	if (serverMap[addr]) {
		var info = serverMap[addr];
		if (info.clientport != clientport
			|| info.httpPort != httpPort
			|| info.ip != ip
		) {
			console.log("duplicate gsid:" + addr + ",addr:" + ip + "(" + httpPort + ")");
			http.send(res, HALL_ERRS.GSID_CONFLICTED, null, true);
			return;
		}
		info.load = load;
		http.send(res, RET_OK, { ip: clientip }, true);
		return;
	}
	var url = 'http://' + ip + ':' + httpPort;
	serverMap[addr] = {
		ip: ip,
		id: addr,
		serverid: serverid,
		type: servertype,
		mode: servermode,
		clientip: clientip,
		clientport: clientport,
		httpPort: httpPort,
		url: url,
		load: load
	};
	http.send(res, RET_OK, { ip: clientip }, true);
	console.log("game server registered.\n\tid:" + addr + "\n\taddr:" + ip + "\n\thttp port:" + httpPort + "\n\tsocket clientport:" + clientport);

	var reqdata = {
		serverid: addr,
		sign: crypto.md5(addr + config.ROOM_PRI_KEY)
	};

	//获取服务器信息
	var ret = http.getSync(url + "/get_server_info", reqdata);
	if (ret && ret.data.errcode == 0) {
		for (var i = 0; i < data.userroominfo.length; i += 2) {
			var userId = data.userroominfo[i];
			var roomId = data.userroominfo[i + 1];
		}
	}
});

function chooseServer(gametype, gamemode) {
	var serverinfo = null;
	if (gametype == null || gamemode == null) {
		return null;
	}
	//新选择一个服务器
	if (serverinfo == null) {
		for (var s in serverMap) {
			var info = serverMap[s];

			if (info.type != gametype || info.mode != gamemode) {
				continue;
			}

			if (serverinfo == null) {
				serverinfo = info;
			} else {
				if (serverinfo.load > info.load) {
					serverinfo = info;
				}
			}
		}
	}
	return serverinfo;
}

exports.createRoom = function (account, userId, roomConf, gametype, gamemode) {
	var result = {
		ret: RET_OK,
		gametype: null,
		gamemode: null,
		roomid: null
	}

	//分配游戏服务器
	var serverinfo = chooseServer(gametype, gamemode);
	if (serverinfo == null) {
		result.ret = HALL_ERRS.ASSIGN_GAME_SERVER_FAILED;
		return result;
	}

	//获取金币数据
	var data = db.get_gems(account);
	if (data == null) {
		result.ret = HALL_ERRS.GET_GEMS_INFO_FAILED;
		return result;
	}

	//请求创建房间
	var reqdata = {
		userid: userId,
		gems: data.gems,
		conf: roomConf,
		gametype: gametype,
		gamemode: gamemode,
		serverid: serverinfo.serverid
	};
	reqdata.sign = crypto.md5(userId + roomConf + data.gems + config.ROOM_PRI_KEY);
	var syncHttpRet = http.getSync(serverinfo.url + "/create_room", reqdata);
	if (syncHttpRet == null || syncHttpRet.err || syncHttpRet.data == null) {
		//发生系统错误
		result.ret = SYS_ERRS.INTER_NETWORK_ERROR;
		return result;
	}
	if (syncHttpRet.data.errcode === 0 && syncHttpRet.data.roomid != null) {
		result.roomid = syncHttpRet.data.roomid;
		result.gametype = gametype;
		result.gamemode = gamemode;
	} else {
		var err = findErrorByCode(syncHttpRet.data.errcode);
		result.ret = err;
	}

	return result;
};

exports.enterRoom = function (userId, name, roomId, gametype, gamemode, userip, usergps) {
	var reqdata = {
		userid: userId,
		name: name,
		userip: userip,
		roomid: roomId,
		usergps: usergps,
		gametype: gametype,
		gamemode: gamemode
	};

	var result = {
		ret: RET_OK,
		enterInfo: null
	};

	reqdata.sign = crypto.md5(userId + name + roomId + config.ROOM_PRI_KEY);

	var enterRoomReq = function (serverinfo) {
		var ret = http.getSync(serverinfo.url + "/enter_room", reqdata);
		if (ret == null || ret.err || ret.data == null) {
			result.ret = SYS_ERRS.INTER_NETWORK_ERROR;
			return result;
		}
		if (ret.data.errcode == 0) {
			db.set_room_id_of_user(userId, roomId, gametype, gamemode);
			result.enterInfo = {
				ip: serverinfo.clientip,
				port: serverinfo.clientport,
				token: ret.data.token
			}
			return result;
		} else {
			result.ret = findErrorByCode(ret.data.errcode);
			if(result.ret == null){
				console.error("---申请加入房间失败[房间号]:" +roomId + "[错误]:",ret.data.errcode);
			}
			return result;
		}
	};

	var addr = db.get_room_serverid(gametype, gamemode, roomId);
	//首先通过数据库存储的房间信息查找相应的服务器
	if (gametype && gamemode) {
		var serverinfo = null;
		//有指定的服务器ID
		if (addr && addr.serverid) {
			var key = gametype + ":" + gamemode + ":" + addr.serverid;
			var serverinfo = serverMap[key];
		}

		//没有指定的服务器ID，或者指定ID的服务器不可用，则重新分配一个服务器
		if (serverinfo == null) {
			serverinfo = chooseServer(gametype, gamemode);
		}
		
		//进入房间
		if (serverinfo) {
			return enterRoomReq(serverinfo);
		}
	}
	//没有适合的游戏服务器，则等待
	result.ret = HALL_ERRS.ASSIGN_GAME_SERVER_FAILED;
	return result;
};

exports.isServerOnline = function (ip, port) {
	var serverInfo = null;
	for (var key in serverMap) {
		var server = serverMap[key];
		if (server.clientip == ip && server.clientport == port) {
			serverInfo = server;
			break;
		}
	}

	if (!serverInfo) {
		return false;
	}

	var sign = crypto.md5(config.ROOM_PRI_KEY);
	var ret = http.getSync(serverInfo.url + "/ping", { sign: sign });
	if (ret == null || ret.err || ret.data == null) {
		return false;
	}
	return true;
};

exports.exitRoom = function (gameType, gameMode, roomId, userId) {
	var reqdata = {
		user_id: userId,
		roomid:roomId
	};

	var addr = db.get_room_serverid(gameType, gameMode, roomId);
	if (!addr) {
		return HALL_ERRS.GET_SERVER_ADDR_FAILED;
	}

	var serverinfo = null;
	if (addr.serverid) {
		var key = gameType + ":" + gameMode + ":" + addr.serverid;
		serverinfo = serverMap[key];
	}

	if (!serverinfo) {
		console.log('[Error] can\'t find the server');
		return HALL_ERRS.ASSIGN_GAME_SERVER_FAILED;
	}
	var ret = http.getSync(serverinfo.url + '/exit_room', reqdata);

	return findErrorByCode(ret.data.errcode);
};
exports.kick_user = function (gameType, gameMode, roomId, userIdList) {
	var reqdata = {
		userIdList: JSON.stringify(userIdList),
	};
	console.log('kick_user1111', reqdata);
	var addr = db.get_room_serverid(gameType, gameMode, roomId);
	if (!addr) {
		return HALL_ERRS.GET_SERVER_ADDR_FAILED;
	}

	var serverinfo = null;
	if (addr.serverid) {
		var key = gameType + ":" + gameMode + ":" + addr.serverid;
		serverinfo = serverMap[key];
	}

	if (!serverinfo) {
		console.log('[Error] can\'t find the server');
		return HALL_ERRS.ASSIGN_GAME_SERVER_FAILED;
	}
	var ret = http.getSync(serverinfo.url + '/kick_user', reqdata);

	return findErrorByCode(ret.data.errcode);
};

exports.getNumOfPlayingRooms = function () {
	var sum = 0;
	for (var idx in serverMap) {
		var serverInfo = serverMap[idx];
		if (serverInfo) {
			sum += parseInt(serverInfo.load);
		}
	}
	console.log('--->' + sum);
	return sum;
};

exports.isUserRenewed = function (roomId, userId, gameType, gameMode) {
	var reqdata = {
		room_id: roomId,
		user_id: userId,
	};

	var addr = db.get_room_serverid(gameType, gameMode, roomId);
	if (addr == null) {
		return true;
	}

	var key = gameType + ":" + gameMode + ":" + addr.serverid;
	var serverinfo = serverMap[key];
	if (serverinfo == null) {
		return true;
	}

	var ret = http.getSync(serverinfo.url + '/is_user_renewed', reqdata);
	return ret.data.renewed;
};

app.get('/get_num_of_playing_rooms', function (req, res) {
	var num = exports.getNumOfPlayingRooms();
	console.log('get num of playing rooms ' + num);
	http.send(res, RET_OK, { num: num }, true);
})

exports.start = function (conf) {
	config = conf;
	app.listen(config.HALL_FOR_GAME_PORT, config.HALL_FOR_GAMEM_IP);
	console.log("room service is listening on " + config.HALL_FOR_GAME_IP + ":" + config.HALL_FOR_GAME_PORT);
};