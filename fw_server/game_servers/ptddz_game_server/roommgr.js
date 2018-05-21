var db = require('../../externals/utils/dbsync');
var fibers = require('fibers');

var rooms = {};
var creatingRooms = {};

var userLocation = {};
var totalRooms = 0;
//游戏服务器配置信息
var config = null;

var consts = require('../../externals/utils/consts');
const GAMETYPE = consts.GameType.PTDDZ;
const GAMEMODE = consts.GameMode.NORM;
const CASH_CHANGE_RESONS = consts.CashChangeResons;

function generateRoomId() {
	var roomId = "";
	for (var i = 0; i < 6; ++i) {
		roomId += Math.floor(Math.random() * 10);
	}
	return roomId;
}

function constructRoomFromDb(dbdata, callback) {
	// console.log(dbdata.base_info);
	var roomInfo = {
		uuid: dbdata.uuid,
		id: dbdata.id,
		numOfGames: dbdata.num_of_turns,
		createTime: dbdata.create_time,
		nextButton: dbdata.next_button,
		seats: [],
		conf: JSON.parse(dbdata.base_info)
	};

	roomInfo.gameMgr = require("./games/gamemgr_" + roomInfo.conf.type);

	var playerCount = 4;

	if (roomInfo.conf.playerCount) {
		playerCount = roomInfo.conf.playerCount;
	}

	var roomId = roomInfo.id;
	var userIdList = new Array(playerCount);
	for (var i = 0; i < playerCount; ++i) {
		var s = roomInfo.seats[i] = {};
		s.userId = dbdata["user_id" + i];
		s.score = dbdata["user_score" + i];
		s.ready = false;
		s.renewed = false;
		s.seatIndex = i;
		s.scoreOfRounds = [];

		if (s.userId > 0) {
			userLocation[s.userId] = {
				roomId: roomId,
				seatIndex: i
			};
		}
		userIdList[i] = s.userId;
	}
	rooms[roomId] = roomInfo;
	totalRooms++;

	var namemap = db.get_multi_names(userIdList);
	if (namemap) {
		for (var i = 0; i < roomInfo.seats.length; ++i) {
			var s = roomInfo.seats[i];
			s.name = namemap[s.userId];
			if (s.name == null) {
				s.name = '';
			}
		}
	}
	callback(roomInfo);
}

exports.createRoom = function (creator, roomConf, gems, gametype, gamemode, serverid, callback) {
	if (roomConf.type == null) {
		callback(1, null);
		return;
	}

	var gameList = ['ptddz', 'srddz'];
	if (gameList.indexOf(roomConf.type) == -1) {
		callback(1, null);
		return;
	}

	var gameMgr = require("./games/gamemgr_" + roomConf.type);
	var retCode = gameMgr.checkConf(roomConf, gems);
	if (retCode != 0) {
		console.log('retCode:', retCode);
		if (roomConf.club_id > 0 && retCode == 2222) {
			console.log('俱乐部创建房间不检测钻石');
		} else {
			callback(retCode, null);
			return;
		}
	}
	var configs = gameMgr.getConf(roomConf, creator);

	var fnCreate = function () {
		var roomId = generateRoomId();
		if (rooms[roomId] != null || creatingRooms[roomId] != null) {
			fnCreate();
		}
		else {
			creatingRooms[roomId] = true;
			fibers(function () {
				var ret = db.is_room_exist2(GAMETYPE, GAMEMODE, roomId);

				if (ret) {
					delete creatingRooms[roomId];
					fnCreate();
				}
				else {
					var createTime = Math.ceil(Date.now() / 1000);
					var roomInfo = {
						uuid: "",
						id: roomId,
						numOfGames: 0,
						createTime: createTime,
						nextButton: 0,
						seats: [],
						conf: configs,
						gameMgr: gameMgr,
					};
					// console.log(roomInfo.conf);

					var playerCount = roomInfo.conf.playerCount;
					if (playerCount) {
						for (var i = 0; i < playerCount; ++i) {
							roomInfo.seats.push({
								userId: 0,
								score: 0,
								name: "",
								ready: false,
								seatIndex: i,
								scoreOfRounds: [],
							});
						}
					} else {
						for (var i = 0; i < 4; ++i) {
							roomInfo.seats.push({
								userId: 0,
								score: 0,
								name: "",
								ready: false,
								seatIndex: i,
								scoreOfRounds: [],
							});
						}
					}

					//写入数据库
					var conf = roomInfo.conf;
					// var uuid = db.create_room(roomInfo.id, roomInfo.conf, ip, port, createTime);
					fibers(function () {
						var uuid = db.create_room(gametype, gamemode, serverid, roomInfo.id, roomInfo.conf, createTime);
						delete creatingRooms[roomId];
						if (uuid != null) {
							roomInfo.uuid = uuid;
							rooms[roomId] = roomInfo;
							totalRooms++;

							// db.cost_gems(creator, conf.cost, CASH_CHANGE_RESONS.COST_CREATE_ROOM.format(roomId));

							callback(0, roomId);
						}
						else {
							callback(3, null);
						}
					}).run();
				}
			}).run();

		}
	}

	fnCreate();
};

exports.destroy = function (roomId) {
	var roomInfo = rooms[roomId];
	if (roomInfo == null) {
		return;
	}

	for (var i = 0; i < roomInfo.seats.length; ++i) {
		var userId = roomInfo.seats[i].userId;
		if (userId > 0) {
			delete userLocation[userId];
			//作用避免该玩家 内存里存储有多个信息, 导致清空玩家房间id 进不去原来的房间,产生一个玩家可以进入多个房间的BUG
			var temp = db.get_user_roomid(userId);
			if (temp && temp.roomid == roomId && temp.gametype == '0010001') {
				db.set_room_id_of_user(userId, null, null, null);
			} 
			// //转盘抽奖活动存储游戏盘数
			// if (roomInfo.numOfGames >= 8) {
			// 	exports.update_lottery_playTimes(userId);
			// }
		}
	}
	if (roomInfo.conf.srzf && roomInfo.conf.dkfj && roomInfo.conf.club_id) {
		console.log('俱乐部所开房间不需要清除,由圈主解散！');
		return;
	}

	delete rooms[roomId];
	totalRooms--;
	// db.delete_room(roomId);
	var ret = db.delete_room(GAMETYPE, GAMEMODE, roomInfo.uuid);
}
//转盘抽奖活动统计完成局数任务
exports.update_lottery_playTimes = function (userId) {
	console.log('转盘抽奖活动统计完成局数任务');
	db.get_lottery_msg_Id(userId, function (data) {

		var date = new Date();
		var lastNight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		var timestamp = lastNight.getTime();

		var data = JSON.parse(data.lottery);
		if (data == null) {//活动期间第一次完成一次游戏
			var temp = {
				lotteryTimes: 0,
				// HasShare:true,
				HasShare: false,
				playTimes: 1,
				dateTime: Date.now()//保存数据修改时间
			}
		} else {
			if (data.dateTime < timestamp) {
				console.log('第二天数据重置')
				// data.lotteryTimes = 0;
				data.HasShare = false;
				data.playTimes = 0;
				data.dateTime = timestamp;

			} else {
				console.log('同一天进行的游戏')
			}
			var playTimes = data.playTimes + 1;
			var lotteryTimes = data.lotteryTimes;
			if (playTimes == 5) {
				lotteryTimes += 1;
			}
			var temp = {
				lotteryTimes: lotteryTimes,
				HasShare: data.HasShare,
				playTimes: playTimes,
				dateTime: Date.now()
			}
		}

		var temp = JSON.stringify(temp);

		db.update_lottery(userId, temp, function (data) {
			console.log('玩家完成一大局，playTimes+1');
		});
	})

};

exports.getTotalRooms = function () {
	return totalRooms;
}

exports.getRoom = function (roomId) {
	return rooms[roomId];
};

exports.isCreator = function (roomId, userId) {
	var roomInfo = rooms[roomId];
	if (roomInfo == null) {
		return false;
	}
	return roomInfo.conf.creator == userId;
};

exports.enterRoom = function (roomId, userId, userName, userIp, callback) {
	var fnTakeSeat = function (room) {
		console.log('用户是否有房间：', exports.getUserRoom(userId) == roomId)
		if (exports.getUserRoom(userId) == roomId) {
			//已存在
			return 0;
		}

		var playerCount = room.conf.playerCount;
		if (playerCount) {
			for (var i = 0; i < playerCount; ++i) {
				var seat = room.seats[i];
				if (seat.userId <= 0) {
					seat.userId = userId;
					seat.name = userName;
					userLocation[userId] = {
						roomId: roomId,
						seatIndex: i
					};
					fibers(function () {
						db.yymj_update_seats_info(config.GAME_TYPE, config.GAME_MODE, roomId, [], i, seat.userId);
					}).run();

					//正常
					return 0;
				}
			}
		}

		//房间已满
		return 1;
	};


	var checkAaPay = function (room) {
		// console.log("room:",room);

		if (room.conf.srzf && room.numOfGames <= 1) {
			fibers(function () {
				var gems = db.get_gems_by_userid(userId);
				var lesscost = false;
				if (gems < Math.ceil(room.conf.cost)) {
					callback(3);
				} else {
					var ret = fnTakeSeat(room);
					callback(ret);
				}
			}).run();
		} else {
			var ret = fnTakeSeat(room);
			callback(ret);
		}
	};

	var room = rooms[roomId];
	// console.log("rooms:",rooms);
	// console.log(room)
	if (room) {
		var checkIp = room.conf.checkIP;
		if (checkIp && userIp) {
			// console.log(room.seats);
			var item = room.seats.filter(item => {
				// console.log(item.ip+":"+userIp)
				// return item.ip != null && item.ip == userIp&&item.userId != userId&&item.userId>0;
				if (item.ip != null && item.ip == userIp) {
					return true;
				}
			}).filter(item1 => {
				// console.log(item1.userId+":"+userId)
				if (item1.userId != userId && item1.userId > 0) {
					return true;
				}
			});
			// console.log(item)
			if (item != null && item != '') {
				console.log(exports.getLogTime() + ':' + '房间' + roomId + '开启同ip检测-' + ' {用户：' + userId + '与' + item[0].userId + ' IP相同,禁止进入房间}');
				callback(5);
				return
			}
		}
		checkAaPay(room);
		// var ret = fnTakeSeat(room);
		// callback(ret);
	}
	else {

		// db.get_room_data(roomId, function (dbdata) {
		fibers(function () {
			var dbdata = db.get_room_data(config.GAME_TYPE, config.GAME_MODE, roomId);
			// console.log('roommgr-get_room_data:', dbdata)
			if (dbdata == null) {
				//找不到房间
				callback(2);
			}
			else {
				//construct room.
				constructRoomFromDb(dbdata, function (roomdata) {
					room = roomdata;
					checkAaPay(room);
				});

			}
		}).run();

	}
};

exports.getLogTime = function () {
	var date = new Date();
	return '[' + date.getFullYear() + ':' + (date.getMonth() + 1) + ':' + date.getDate() + ':' + date.getHours() + ':' + date.getMinutes() + ']';
},

	exports.setReady = function (userId, value) {
		var roomId = exports.getUserRoom(userId);
		if (roomId == null) {
			return;
		}

		var room = exports.getRoom(roomId);
		if (room == null) {
			return;
		}

		var seatIndex = exports.getUserSeat(userId);
		if (seatIndex == null) {
			return;
		}

		var s = room.seats[seatIndex];
		s.ready = value;
	}

exports.isReady = function (userId) {
	var roomId = exports.getUserRoom(userId);
	if (roomId == null) {
		return;
	}

	var room = exports.getRoom(roomId);
	if (room == null) {
		return;
	}

	var seatIndex = exports.getUserSeat(userId);
	if (seatIndex == null) {
		return;
	}

	var s = room.seats[seatIndex];
	return s.ready;
}


exports.getUserRoom = function (userId) {
	var location = userLocation[userId];
	if (location != null) {
		return location.roomId;
	}
	return null;
};

exports.getUserSeat = function (userId) {
	var location = userLocation[userId];
	if (location != null) {
		return location.seatIndex;
	}
	return null;
};

exports.getUserLocations = function () {
	return userLocation;
};

exports.returnCreatorGems = function (roomId) {
	//如果是代开房间，退还房卡给开房者
	var roominfo = exports.getRoom(roomId);
	console.log("Log_roominfo", roominfo)
	if (roominfo.numOfGames == 0 && roominfo.conf.dkfj) {
		var creatorId = roominfo.conf.creator;
		var cost = roominfo.conf.cost;
		db.return_gems(creatorId, cost, function (data) {
			if (data) {

				// http.send(res, 0, "ok 代开房间解散，房卡返还成功！");
				console.log("Log_return_gems_成功");
			} else {
				// http.send(res, 23, "代开房间解散，房卡返还失败！");
				console.log("Log_return_gems_失败");

			}

		})
	}
},

	exports.exitRoom = function (userId) {
		var location = userLocation[userId];
		if (location == null)
			return;

		var roomId = location.roomId;
		var seatIndex = location.seatIndex;
		var room = rooms[roomId];
		delete userLocation[userId];
		if (room == null || seatIndex == null) {
			return;
		}

		var seat = room.seats[seatIndex];
		seat.userId = 0;
		seat.name = "";
		seat.ready = false;

		var numOfPlayers = 0;
		for (var i = 0; i < room.seats.length; ++i) {
			if (room.seats[i].userId > 0) {
				numOfPlayers++;
			}
		}

		var temp = db.get_user_roomid(userId);
		if (temp && temp.roomid == roomId && temp.gametype == '0010001') {
			//清空数据库中玩家自己的房间id
			db.set_room_id_of_user(userId, null, null, null);
		} 

		if (numOfPlayers == 0) {
			// exports.destroy(roomId);
			console.log('代开房间:' + roomId + '玩家全部退出，房间为空！');
		}
	};

/**
 * 牛牛相关接口放到roommgr（废弃）
 */


var dissolvingList = [];

exports.hasBegan = function (roomid) {
	var roomInfo = exports.getRoom(roomid);
	if (roomInfo == null) {
		return false;
	}

	if (roomInfo.game != null) {
		return true;
	}

	if (roomInfo.numOfGames > 0) {
		return true;
	}

	return false;
};

exports.doDissolve = function (roomid) {
	var roomInfo = exports.getRoom(roomid);
	if (roomInfo == null) {
		return null;
	}
	console.log('doDissolve', roomInfo.gameMgr);
	console.log('----------', roomInfo.seats);
	if (roomInfo.conf.type == "sss") {
		roomInfo.gameMgr.doGameOver(roomInfo, true)
	} else {
		roomInfo.gameMgr.doGameOver(roomInfo.game, roomInfo.seats[0].userId, true)
	}
};

exports.dissolveRequest = function (roomid, userid) {
	var roomInfo = exports.getRoom(roomid);
	if (roomInfo == null) {
		return null;
	}

	if (roomInfo.dr != null) {
		return null;
	}

	var seatIndex = exports.getUserSeat(userid);
	if (seatIndex == null) {
		return null;
	}

	roomInfo.dr = {
		endTime: Date.now() + 30000,
		states: []
	};
	for (var i = 0; i < roomInfo.seats.length; ++i) {
		var userid = roomInfo.seats[i].userId;
		if (userid > 0) {
			roomInfo.dr.states.push(false);
		}
	}
	roomInfo.dr.states[seatIndex] = true;

	dissolvingList.push(roomid);

	return roomInfo;
};

exports.dissolveAgree = function (roomid, userid, agree) {
	var roomInfo = exports.getRoom(roomid);
	if (roomInfo == null) {
		return null;
	}

	if (roomInfo.dr == null) {
		return null;
	}

	var seatIndex = exports.getUserSeat(userid);
	if (seatIndex == null) {
		return null;
	}

	if (agree) {
		roomInfo.dr.states[seatIndex] = true;
	}
	else {
		roomInfo.dr = null;
		var idx = dissolvingList.indexOf(roomid);
		if (idx != -1) {
			dissolvingList.splice(idx, 1);
		}
	}
	return roomInfo;
};

exports.setConfig = function (conf) {
	config = conf;
};

function updateDissolveingRooms() {
	for (var i = dissolvingList.length - 1; i >= 0; --i) {
		var roomid = dissolvingList[i];

		var roomInfo = exports.getRoom(roomid);
		if (roomInfo != null && roomInfo.dr != null) {
			if (Date.now() > roomInfo.dr.endTime) {
				console.log("delete room and games");
				exports.doDissolve(roomid);
				dissolvingList.splice(i, 1);
			}
		}
		else {
			dissolvingList.splice(i, 1);
		}
	}
};

exports.isUserRenewed = function (roomId, userId) {
	var room = exports.getRoom(roomId);
	if (room == null || room.seats == null) {
		return true;
	}
	var seatIdx = exports.getUserSeat(userId);
	var seat = room.seats[seatIdx];
	if (seat == null) {
		return true;
	}

	return seat.renewed;
};
exports.sendMsgToClub = function (club_id, result) {
	var data = {
		club_id: club_id,
		data: result,
		sender: 123,
		type: 'GameResult',
		name: '游戏结果'
	}
	var url = 'http://' + config.HALL_FOR_GAME_IP + config.HALL_FOR_GAME_PORT;
	var httpres = http.getSync(url + '/send_msg_to_club', data);
	console.log('游戏结果发送到俱乐部：', httpres);
};

exports.update = function () {
	//刷新协商解散房间
	updateDissolveingRooms();
};

// setInterval(() => {
// 	exports.update()
// }, 1000);


/**
 * 俱乐部id /信息类型(GameResult RoomInfoChange) /房间传递的数据 /信息名：游戏结果 房间人数变化
 * @param {*} club_id 俱乐部id
 * @param {*} type 信息类型 GameResult RoomInfoChange
 * @param {*} result 房间传递的数据
 * @param {*} name 信息名：游戏结果 房间人数变化
 */
exports.sendMsgToClub = function (club_id, result, type, name) {
	var data = {
		club_id: club_id,
		roomId: result.roomid,
		data: JSON.stringify(result),
		sender: 123,
		type: type,
		name: name
	}
	//console.log('sendMsgToClub data', data);
	var url = 'http://' + 'localhost' + ':' + 9000;
	fibers(() => {
		var httpres = http.getSync2(url + '/send_msg_to_club', data);
		//console.log('游戏信息发送到俱乐部：', httpres);
	}).run();
};


