var db = require('../../externals/utils/dbsync');
var fs = require('fs');
var crypto = require('../../externals/utils/crypto');
var userMgr = (require('../../externals/game_utils/usermgr')).getUserMgr('niuniu');
var consts = require('../../externals/utils/consts');
var fibers = require('fibers');

//游戏逻辑map
var files = fs.readdirSync(__dirname + '/games/');
var gameMap = {};
for (var k in files) {
	var filepath = files[k];
	if (filepath.indexOf('gamemgr_') == 0) {
		var gameMgr = require('./games/' + filepath);
		gameMap[filepath] = gameMgr;
	}
}

//所有房间列表
var rooms = {};
//tempcard
var temprooms = {};
//玩家定位数据
var userLocation = {};
//房间总数
var totalRooms = 0;

//游戏服务器配置信息
var config = null;

//该游戏是否可以续局
const CAN_RENEW = false;
//可续局房间保留时长
const ROOM_WAIT_INTERVAL = 600000;
//可续局房间等待玩家时长
const ROOM_KICK_INTERVAL = 100000;
//可以续局的房间列表
var renewRooms = {};

//协商解散房间列表
var dissolvingList = [];

/**
 * 房间ID生成函数
 */
function generateRoomId() {
	var roomId = "";
	for (var i = 0; i < 6; ++i) {
		roomId += Math.floor(Math.random() * 10);
	}
	return roomId;
}

/**
 * 从数据库中恢复房间
 * @param {Object} dbdata 
 */
function constructRoomFromDb(dbdata) {
	var roomInfo = {
		uuid: dbdata.uuid,
		id: dbdata.id,
		numOfGames: dbdata.num_of_turns,
		createTime: dbdata.create_time,
		nextButton: dbdata.next_button,
		seats: new Array(4),
		conf: JSON.parse(dbdata.base_info),
		canRenew: CAN_RENEW,
		state: consts.RoomState.NOT_START,
		gametype: config.gametype,
		gamemode: config.gamemode,
		giveGemsMap: {},
	};

	var gamepath = 'gamemgr_' + roomInfo.conf.type + '.js';
	var maxChair = 4;
	if (roomInfo.conf.maxChair > 0) {
		maxChair = roomInfo.conf.maxChair;
	}
	roomInfo.maxChair = maxChair;
	roomInfo.seats.length = maxChair;
	roomInfo.gameMgr = gameMap[gamepath];
	if (roomInfo.gameMgr == null) {
		return null;
	}

	var roomId = roomInfo.id;
	var userIdList = [];

	var seatsInfo = [];
	try {
		seatsInfo = JSON.parse(dbdata.seats_info);
	} catch (e) {
		console.log('[Error] - JSON parse seat info error, seat_info:' + dbdata.seats_info);
	}

	for (var i = 0; i < maxChair; ++i) {
		var seatInfo = seatsInfo[i];
		var s = roomInfo.seats[i] = {};
		s.userId = seatInfo ? seatInfo.user : 0;
		s.score = seatInfo ? seatInfo.score : 0;
		s.ready = false;
		s.renewed = false;
		s.seatIndex = i;

		if (s.userId > 0) {
			userLocation[s.userId] = {
				roomId: roomId,
				seatIndex: i
			};
			userIdList.push(s.userId);
		}
	}

	var namemap = db.get_multi_names(userIdList)
	if (namemap) {
		for (var i = 0; i < roomInfo.seats.length; ++i) {
			var s = roomInfo.seats[i];
			s.name = namemap[s.userId];
			if (s.name == null) {
				s.name = '';
			}
		}
	}

	db.update_room_serverid(config.gametype, config.gamemode, roomId, config.serverid);
	rooms[roomId] = roomInfo;
	totalRooms++;
	return roomInfo;
}

/**
 * 重置除玩家id，姓名，座位号以外的全部数据
 * @param {Object} seat 
 */
function resetSeat(seat) {
	if (seat) {
		seat.score = 0;
		seat.ready = false;
		seat.renewed = false;
	}
}

/**
 * 清除座位数据
 * @param {Object} seat 
 */
function clearSeat(seat) {
	if (seat) {
		seat.userId = 0;
		seat.score = 0;
		seat.name = "";
		seat.ready = false;
		seat.renewed = false;
	}
}

/**
 * 设置房间状态
 */
function setRoomState(roomId, state) {
	var room = exports.getRoom(roomId);
	if (room == null ||
		state < consts.RoomState.NOT_START ||
		state > consts.RoomState.WAITING_RENEW) {
		console.log('[DEBUG] - cant get room or state is invalid');
		return;
	}

	db.update_room_state(config.gametype, config.gamemode, roomId, state);
	room.state = state;

	//不可续费房间，直接返回
	if (!room.canRenew) {
		delete renewRooms[roomId];
		return;
	}

	//可续费房间，将房间添加到续费房间列表
	if (room.state == consts.RoomState.WAITING_RENEW) {
		//重置房间关联的game
		room.game = null;
		//重置游戏场数
		room.numOfGames = 0;
		//清空dr
		room.dr = null;
		//清空解散标记
		room.dissolved = false;
		//清空赠送钻石记录
		room.giveGemsMap = {};

		//重置所有座位数据
		for (var i = 0; i < room.seats.length; i++) {
			resetSeat(room.seats[i]);
		}
		//续费房间状态改为待激活，等待玩家续费
		renewRooms[roomId] = {
			state: consts.RoomRenewState.UNACTIVE,
			time: Date.now()
		};
	} else {
		delete renewRooms[roomId];
	}
}


exports.savecard = function (roomid, cardlist) {
	var ret = temprooms[roomid]
	if (ret === undefined || ret === null) {
		temprooms[roomid] = {
			list: cardlist
		}
	} else {
		temprooms[roomid].list = [];
		temprooms[roomid].list = cardlist;
	}
	console.log(temprooms[roomid].list);
	return;

}


exports.getcard = function (roomid) {
	var ret = temprooms[roomid].list
	if (ret) {
		return ret;
	}
	return 0;

}

exports.delcard = function (roomid, number, userid) {
	var ret = temprooms[roomid].list
	console.log(temprooms[roomid].list + "操作前")

	if (!ret) {
		var data = {
			code: 0,
		}
		return data;
	}
	var tempnum = 0;
	if (ret) {

		for (var i in temprooms[roomid].list) {
			var temptwo = Number(temprooms[roomid].list[i])
			if (number != temptwo) {
				tempnum++;

			} else {

			}
		}

	}
	if (ret.length == tempnum) {
		var data = {
			code: 2,
			list: temprooms[roomid].list

		}
		return data;

	}

	if (ret) {

		for (var i in temprooms[roomid].list) {
			var temptwo = Number(temprooms[roomid].list[i])
			if (number == temptwo) {
				temprooms[roomid].list[i] = -1;

			}
		}

	}

	console.log(temprooms[roomid].list + "操作后")
	var room = exports.getRoom(roomid);

	if (!room) {
		var data = {
			code: 0,

		}
		return data;

	}
	var catlist = room.game.data.players;
	var doglist = room.seats;
	var templist;
	for (var i = 0; i < doglist.length; i++) {
		if (Number(userid) == Number(doglist[i].userId)) {
			var bitchlist = catlist[i].cards;
			bitchlist[4] = Number(number);
			catlist[i].cards[4] = Number(number);
			templist = catlist[i].cards;
		}
	}
	var data = {
		code: 1,
		list: templist
	}
	return data;
}

function getSeatsInfo(room) {
	var info = [];
	if (room == null) {
		return info;
	}

	var seat = null;
	var userId = 0;
	var score = 0;
	for (var i in room.seats) {
		seat = room.seats[i];
		userId = seat ? seat.userId : 0;
		score = seat ? seat.score : 0;
		info.push({
			user: userId,
			score: score
		});
	}

	return info;
}

function updateDBSeatsInfo(roomId) {
	var room = exports.getRoom(roomId);
	if (room == null || room.seats == null) {
		return false;
	}

	var seatsInfo = getSeatsInfo(room);

	db.update_seats_info(room.gametype, room.gamemode, roomId, seatsInfo);
	db.update_num_of_turns(room.gametype, room.gamemode, roomId, room.numOfGames);
}

exports.setConfig = function (conf) {
	config = conf;
};

exports.createRoom = function (creator, roomConf, gems, gametype, gamemode, serverid) {
	var result = {
		ret: RET_OK,
		roomId: null
	};

	if (config == null ||
		config.gametype != gametype ||
		config.gamemode != gamemode) {
		result.ret = GAME_ERRS.UNMATCH_GAME_TYPE_OR_MOD;
		return result;
	}

	var gameMgr = gameMap['gamemgr_' + roomConf.type + '.js'];
	if (!gameMgr) {
		console.log('unsupported game type:' + roomConf.type);
		result.ret = GAME_ERRS.UNSUPPORTED_GAME_TYPE;
		return result;
	}

	result.ret = gameMgr.checkConf(roomConf, gems);
	if (result.ret.code !== 0) {
		return result;
	}
	if (roomConf.for_others) {
		var cost = gameMgr.getCost(roomConf);
		db.cost_gems(creator, cost);
	}

	for (var i = 0; i < 5; ++i) {
		var roomId = generateRoomId();
		//如果房间ID已经被占用，则重试
		if (db.is_room_exist2(gametype, gamemode, roomId)) {
			continue;
		}
		var createTime = Math.ceil(Date.now() / 1000);
		var roomInfo = {
			uuid: "",
			id: roomId,
			numOfGames: 0,
			createTime: createTime,
			nextButton: 0,
			seats: [],
			conf: gameMgr.getConf(roomConf, creator),
			canRenew: CAN_RENEW,
			state: consts.RoomState.NOT_START,
			gametype: gametype,
			gamemode: gamemode,
			giveGemsMap: {},
		};

		roomInfo.gameMgr = gameMgr;

		var maxChair = 4;
		if (roomInfo.conf.maxChair) {
			maxChair = roomInfo.conf.maxChair;
		}
		roomInfo.maxChair = maxChair;
		for (var i = 0; i < maxChair; ++i) {
			roomInfo.seats.push({
				userId: 0,
				score: 0,
				name: "",
				ready: false,
				seatIndex: i,
				renewed: false
			});
		}

		//写入数据库
		var conf = roomInfo.conf;
		var uuid = db.create_room(gametype, gamemode, serverid, roomInfo.id, roomInfo.conf, createTime);
	//	db.update_room_number();
		if (uuid != null) {
			roomInfo.uuid = uuid;
			console.log(uuid);
			rooms[roomId] = roomInfo;
			totalRooms++;
			result.roomId = roomId;

			//设置房间状态
			setRoomState(roomId, consts.RoomState.NOT_START);
		} else {
			//创建房间失败
			result.ret = GAME_ERRS.CREATE_ROOM_FAILED;
		}
		return result;
	}
};

exports.destroy = function (roomId) {
	var roomInfo = exports.getRoom(roomId);
	if (roomInfo == null) {
		return;
	}

	if (roomInfo.conf.for_others) {
		if (roomInfo.numOfGames == 0 || (roomInfo.numOfGames == 1 && roomInfo.state == 1)) {
			var gameMgr = gameMap['gamemgr_' + roomInfo.conf.type + '.js'];
			db.add_user_gems(roomInfo.conf.creator, gameMgr.getCost(roomInfo.conf));
		}
	}

	delete rooms[roomId];
	totalRooms--;
	db.delete_room(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid);

	for (var i = 0; i < roomInfo.maxChair; ++i) {
		var userId = roomInfo.seats[i].userId;
		if (userId > 0) {
			delete userLocation[userId];
			db.set_room_id_of_user(userId, null, null, null);
		}
	}
}

exports.getTotalRooms = function () {
	return totalRooms;
}

exports.getRoom = function (roomId) {
	var room = rooms[roomId];
	if (!room) {
		var dbdata = db.get_room_data(config.gametype, config.gamemode, roomId);
		if (!dbdata) {
			return null;
		}
		room = constructRoomFromDb(dbdata);
	}
	return room;
};

exports.isCreator = function (roomId, userId) {
	var roomInfo = exports.getRoom(roomId);
	if (roomInfo == null) {
		return false;
	}
	return roomInfo.conf.creator == userId;
};

exports.sendcardtemp = function (userId, roomid) {
	if (userId == null || roomid == null) {
		return GAME_ERRS.UNMATCH_GAME_TYPE_OR_MOD;
	}
	var room = exports.getRoom(roomid);
	if (room == null) {
		return GAME_ERRS.ROOM_IS_NOT_EXISTED;
	}

	var ret = room.gameMgr.getcard(roomid, userId);

	return ret;


}

exports.enterRoom = function (roomId, userId, userName, userip, gametype, gamemode) {
		if (config == null ||
			config.gametype != gametype ||
			config.gamemode != gamemode) {
			return GAME_ERRS.UNMATCH_GAME_TYPE_OR_MOD;
		}

		var room = exports.getRoom(roomId);

		if (room == null) {
			return GAME_ERRS.ROOM_IS_NOT_EXISTED;
		}
		// var qut = db.finduserid(userId);
		// if (qut) {
		// 	if (qut[0].mark = 1) {
				
		// 		userMgr.sendMsg(userId, "push_mark",userId);
		// 	}
		// }
			if (exports.getUserRoom(userId) == roomId) {
				console.log('[DEBUG] - user[' + userId + '] is in room[' + roomId + '], state is:' + room.state);
				//玩家已在房间中，且房间为续费房间，则做续费处理
				if (room.state == consts.RoomState.WAITING_RENEW) {
					console.log('[DEBUG] - room is waiting renew');
					//重置房间状态标记
					var resetRoomState = false;

					//续费房间数据
					var renewInfo = renewRooms[roomId];
					if (renewInfo != null) {
						//是否是第一个进入续费房间的玩家
						var firstUser = (renewInfo.state == consts.RoomRenewState.UNACTIVE);
						console.log('[DEBUG] - get renew info:' + JSON.stringify(renewInfo) + ', user[' + userId + '] is the first player[' + firstUser + '], be the creator');

						//房卡检查
						if (firstUser ||
							room.conf.isAA) {
							console.log('[DEBUG] - check cost aa[' + room.conf.isAA + '], firstPlayer[' + firstUser + ']');
							var gems = db.get_gems_by_userid(userId);
							var ret = room.gameMgr.checkConf(room.conf, gems);
							if (ret.code !== 0) {
								console.log('[DEBUG] - gems are not enough.');
								//return ret;
								return GAME_ERRS.GEMS_NOT_ENOUGH;
							}
						}

						//第一个进入房间的玩家成为续费房间房主
						if (firstUser) {
							console.log('[DEBUG] - first in user, change creator, update db, change renew state');
							room.conf.creator = userId;
							db.update_room_conf(room.gametype, room.gamemode, roomId, room.conf);
							renewInfo.state = consts.RoomRenewState.ACTIVE;
						}

						//设置改玩家座位数据
						var location = userLocation[userId];
						if (location != null) {
							console.log('[DEBUG] - set renew flag of seat[' + JSON.stringify(location) + ']');
							//设置玩家续费标记
							room.seats[location.seatIndex].renewed = true;
						}

						resetRoomState = true;
						//所有玩家都已续费,更改房间状态
						for (var i = 0; i < room.seats.length; i++) {
							var seat = room.seats[i];
							resetRoomState = resetRoomState && seat.renewed;
							console.log('[DEBUG] - get seat renew flag, seat index[' + i + ']' + ', flag:' + seat.renewed + ',reset room state:' + resetRoomState);
						}
					} else {
						console.log('[DEBUG] - renew info is null');
						resetRoomState = true;
					}

					if (resetRoomState === true) {
						console.log('[DEBUG] - reset room state to NOT_START');
						setRoomState(roomId, consts.RoomState.NOT_START);
					}
				}
				//已存在
				return RET_OK;
			} else if (room.conf.firbiddenJoin && room.numOfGames > 0) {
				return GAME_ERRS.ROOM_IS_FULL;
			}

			//如果是AA制，则要预判玩家钻石是否够
			if (room.conf.isAA === true) {
				var gems = db.get_gems_by_userid(userId);
				var ret = room.gameMgr.checkConf(room.conf, gems);
				if (ret.code !== 0) {
					//return ret;
					return GAME_ERRS.GEMS_NOT_ENOUGH;
				}
			}

			for (var i = 0; i < room.maxChair; ++i) {
				var seat = room.seats[i];
				if (seat.userId <= 0) {
					seat.userId = userId;
					seat.score = 0;
					seat.name = userName;
					seat.ready = false;
					userLocation[userId] = {
						roomId: roomId,
						seatIndex: i
					};
					exports.computeOnlineCnt(room);
					updateDBSeatsInfo(roomId);
					//正常
					return RET_OK;
				}
			}

			//房间已满
			return GAME_ERRS.ROOM_IS_FULL;
		};




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
			if (s.ready == value) {
				return;
			}
			s.ready = value;
			userMgr.broacastInRoom('room_user_ready_push', {
				userid: userId,
				ready: true
			}, room, userId, true);

			if (value == false) {
				return;
			}
			var tempseat = 0;
			// var seatmax = room.maxChair;
			var seatmax = room.conf.zidong;
			var tempT = room.numOfGames;
			if (room.conf.zidong != 0 && tempT == 0) {
				for (var i = 0; i < room.seats.length; ++i) {
					var s = room.seats[i];
					if (s.userId > 0) {
						if (s.ready == true) {
							tempseat++;
							if (tempseat == seatmax) {

								room.gameMgr.begin(roomId);

								setRoomState(roomId, consts.RoomState.PLAYING);
								return;
							}

						}
					}
				}

			}

			exports.checkRoomState(roomId, userId);
		}

		exports.startsgame = function (roomid, userid) {
			var room = exports.getRoom(roomid);
			if (room == null) {

				return false;
			}
			if (userid != room.conf.creator) {
				return false;
			}
			var seats = room.seats;
			var suc = true;
			var count = 0;
			for (var i = 0; i < seats.length; ++i) {
				var s = seats[i];
				if (s.userId > 0) {
					if (s.ready) {
						++count;
					} else {

						return false;
					}
				}
			}
			if (count >= 2) {
				room.gameMgr.begin(roomid);
				setRoomState(roomid, consts.RoomState.PLAYING);
				return true;
			}
			return false;


		}

		exports.startGame = function (userId) {
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

			var seats = room.seats;
			var suc = true;
			var count = 0;
			for (var i = 0; i < seats.length; ++i) {
				var s = seats[i];
				if (s.userId > 0) {
					if (s.ready) {
						++count;
					} else {
						suc = false;
						break;
					}
				}
			}
			if (suc && count >= 2) {
				room.confirmPlayer = true;
				exports.checkRoomState(roomId, userId);
			} else {

			}
		}

		exports.checkRoomState = function (roomId, userId) {
			var room = exports.getRoom(roomId);
			if (room == null) {
				return;
			}
			if (!room.confirmPlayer && room.numOfGames == 0) {
				return;
			}

			//如果未开局，则要4家都准备好了才开
			if (room.game == null) {
				if (room.seats.length == room.maxChair) {
					for (var i = 0; i < room.seats.length; ++i) {
						var s = room.seats[i];
						if (s.userId > 0) {
							if (s.ready == false) {
								return;
							}
						}
					}
					//4个人到齐了，并且都准备好了，则开始新的一局
					room.gameMgr.begin(roomId);

					setRoomState(roomId, consts.RoomState.PLAYING);
				}
			} else {
				//如果已开局，则同步信息
				room.gameMgr.sync(userId);
			}
		}

		exports.randomSeats = function (roomId) {
			var roomInfo = exports.getRoom(roomId);
			if (!roomInfo) {
				return;
			}

			roomInfo.seats.sort(function () {
				return 0.5 - Math.random()
			});

			var seatOrder = [];
			for (var i = 0; i < roomInfo.maxChair; ++i) {
				var s = roomInfo.seats[i];
				s.seatIndex = i;
				userLocation[s.userId].seatIndex = i;
				seatOrder[i] = s.userId;
			}
			//更新数据库
			updateDBSeatsInfo(roomId);
			//刷新
			userMgr.broacastInRoom('room_seats_changed_push', seatOrder, roomInfo, roomInfo.seats[0].userId, true);
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
			//console.log(userLocation[userId]);
			if (location != null) {
				return location.seatIndex;
			}
			return null;
		};

		exports.getUserLocations = function () {
			return userLocation;
		};

		exports.updateScores = function (roomId) {
			var room = exports.getRoom(roomId);
			if (room == null) {
				return;
			}

			updateDBSeatsInfo(roomId);
		};

		exports.exitRoom = function (userId) {
			console.log('[DEBUG] - user[' + userId + '] exit room');
			var room = null;
			var location = userLocation[userId];
			if (location != null) {
				var roomId = location.roomId;
				var seatIndex = location.seatIndex;
				room = exports.getRoom(roomId);
				if (room != null && seatIndex != null) {
					var seat = room.seats[seatIndex];

					//从房间中踢该座位的玩家
					userMgr.kickSeatInRoom(room, seatIndex);

					//清除玩家座位信息
					clearSeat(seat);

					console.log('[DEBUG] - clear seat[' + seatIndex + '] info');

					//更新数据库中的数据
					updateDBSeatsInfo(room.gametype, room.gamemode, roomId);

					//如果是续费房间，取不到续费房间数据或者续费房间已经激活，有人退出则重置房间状态
					if (room.state == consts.RoomState.WAITING_RENEW) {
						var renewInfo = renewRooms[roomId];
						if (renewInfo.state == consts.RoomRenewState.ACTIVE ||
							renewInfo == null) {
							console.log('[DEBUG] - room[' + roomId + '] is renewing or cant find renew info, but user[' + userId + '] exit, set to not start');
							setRoomState(roomId, consts.RoomState.NOT_START);

							//如果房间已续费，则广播玩家退出消息
							if (renewInfo != null) {
								console.log('[DEBUG] - the room[' + roomId + '] is renewing, push user[' + userId + '] exit message');
								//通知其它玩家，有人退出了房间
								userMgr.broacastInRoom('exit_notify_push', userId, room, userId, false);
							}
						}
					}
				} else {
					console.log('[Error] get room or seat index error');
				}
			} else {
				console.log('[Error] get user [' + userId + '] location error')
			}

			if (room == null) {
			//	db.update_room_number(2);
			}
			//清空房间数据
			delete userLocation[userId];
			if (temprooms[roomId]) {
				temprooms[roomId].list = [];
			}



			//清空数据库中玩家房间数据
			db.set_room_id_of_user(userId, null, null, null);

			var numOfPlayers = 0;
			if (room != null) {
				for (var i = 0; i < room.seats.length; ++i) {
					if (room.seats[i].userId > 0) {
						numOfPlayers++;
					}
				}
			}
			if (numOfPlayers == 0) {
			//	db.update_room_number(2);
			}
			console.log('[DEBUG] - num of players is:' + numOfPlayers);
			// if (numOfPlayers == 0) {
			// 	exports.destroy(roomId);
			// }

			exports.computeOnlineCnt(room);
		};

		exports.closeRoom = function (roomId, forceEnd) {
			console.log('[DEBUG] - close room[' + roomId + '], force:' + forceEnd);
			var room = exports.getRoom(roomId);
			if (room == null) {
				console.log('[DEBUG] - cant get room[' + roomId + ']');
				return;
			}

			db.archive_games(room.gametype, room.gamemode, room.uuid);

			if ((room.numOfGames >= 1 || forceEnd) && room.game == null) {
				console.log('[DEBUG] - archive room[' + roomId + '], numOfGames[' + room.numOfGames + ']');
				db.archive_room(room.gametype, room.gamemode, room.uuid, room.canRenew);
			}

			var s0 = room.seats[0];
			userMgr.broacastInRoom('room_close_push', null, room, s0.userId, true);
			userMgr.kickAllInRoom(room);

			//如果可续局
			if (room.canRenew) {
				console.log('[DEBUG] - begin renew process');
				//更新数据库中的记录
				console.log('[DEBUG] - update uuid of the room[' + roomId + ']');
				var uuid = db.renew_room(config.gametype, config.gamemode, roomId);
				if (!uuid) {
					console.log('[DEBUG] - renew room failed.');
					exports.destroy(roomId);
					return;
				}

				room.uuid = uuid;
				//更新房间状态
				setRoomState(roomId, consts.RoomState.WAITING_RENEW);
			} else {
				console.log('[DEBUG] - destory room[' + roomId + ']');
				exports.destroy(roomId);
			}
		}

		exports.hasBegan = function (roomId) {
			var roomInfo = exports.getRoom(roomId);
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

		exports.doDissolve = function (roomId) {
			//协商解散
			var roomInfo = exports.getRoom(roomId);
			if (roomInfo == null) {
				return null;
			}
			roomInfo.gameMgr.doGameOver(roomInfo, true);

		};

		exports.dissolveRequest = function (roomId, userId) {
			var roomInfo = exports.getRoom(roomId);
			if (roomInfo == null) {
				return null;
			}

			if (roomInfo.dr != null) {
				return null;
			}

			var seatIndex = exports.getUserSeat(userId);
			if (seatIndex == null) {
				return null;
			}

			roomInfo.dr = {
				endTime: Date.now() + 60000,
				states: [false, false, false, false]
			};
			roomInfo.dr.states.length = roomInfo.seats.length;
			roomInfo.dr.states[seatIndex] = true;

			dissolvingList.push(roomId);

			return roomInfo;
		};

		exports.dissolveAgree = function (roomId, userId, agree) {
			var roomInfo = exports.getRoom(roomId);
			if (roomInfo == null) {
				return null;
			}

			if (roomInfo.dr == null) {
				return null;
			}

			var seatIndex = exports.getUserSeat(userId);
			if (seatIndex == null) {
				return null;
			}

			if (agree) {
				roomInfo.dr.states[seatIndex] = true;
			} else {
				roomInfo.dr = null;
				var idx = dissolvingList.indexOf(roomId);
				if (idx != -1) {
					dissolvingList.splice(idx, 1);
				}
			}
			return roomInfo;
		};

		function updateDissolvingRooms() {
			for (var i = dissolvingList.length - 1; i >= 0; --i) {
				var roomId = dissolvingList[i];

				var room = exports.getRoom(roomId);
				if (room != null && room.dr != null) {
					if (Date.now() > room.dr.endTime) {
						console.log("delete room and games");
						exports.doDissolve(roomId);
						dissolvingList.splice(i, 1);
					}
				} else {
					dissolvingList.splice(i, 1);
				}
			}
		}

		function updateGames() {
			for (var roomid in rooms) {
				var room = exports.getRoom(roomid);
				if (!room || !room.gameMgr) {
					continue;
				}

				if (typeof room.gameMgr.update === 'function') {
					room.gameMgr.update();
				}
			}
		}

		function updateRenewRooms() {
			for (var roomId in renewRooms) {
				var room = exports.getRoom(roomId);
				var renewInfo = renewRooms[roomId];
				if (room == null || renewInfo == null) {
					continue;
				}

				var passTime = Date.now() - renewInfo.time;
				if ((renewInfo.state == consts.RoomRenewState.UNACTIVE) && (passTime >= ROOM_WAIT_INTERVAL)) {
					console.log('[DEBUG] - renew room[' + roomId + '] is unactive, timeout, destory.');
					exports.destroy(roomId);
				} else if ((renewInfo.state == consts.RoomRenewState.ACTIVE) && (passTime >= ROOM_KICK_INTERVAL)) {
					console.log('[DEBUG] - renew room[' + roomId + '] is active, timeout, kick not renew user');
					for (var i = 0; i < room.seats.length; i++) {
						var seat = room.seats[i];
						if (seat == null) {
							continue;
						}

						if (seat.renewed !== true) {
							console.log('[DEBUG] - user[' + seat.userId + '] is not renewed, kick');
							delete userLocation[seat.userId];
							userMgr.kickSeatInRoom(room, i);
							clearSeat(seat);
							updateDBSeatsInfo(roomId);
							db.set_room_id_of_user(seat.userId, null, null, null);
							//通知其它玩家，有人退出了房间
							userMgr.broacastInRoom('exit_notify_push', seat.userId, room, seat.userId, false);
						}
					}

					console.log('[DEBUG] - set room[' + roomId + '] state NO_START');
					setRoomState(roomId, consts.RoomState.NOT_START);
				}
			}
		}

		const MAX_GIVE_NUM = 1;
		exports.giveGems = function (roomId, sender, receiver, gems) {
			var room = exports.getRoom(roomId);
			if (room == null) {
				return global.GAME_ERRS.ROOM_IS_NOT_EXISTED;
			}

			var senderGems = db.get_gems_by_userid(sender);
			if (senderGems < gems) {
				return global.GAME_ERRS.GEMS_NOT_ENOUGH;
			}

			room.giveGemsMap = room.giveGemsMap != null ? room.giveGemsMap : {};
			var giveGemsMap = room.giveGemsMap;
			var senderGiveRecords = giveGemsMap[sender];
			if (senderGiveRecords != null && senderGiveRecords[receiver] >= MAX_GIVE_NUM) {
				return global.GAME_ERRS.DUPLICATE_GIVE_GEMS;
			}

			//增减钻石
			var costRet = false;
			var addRet = false;
			costRet = db.cost_gems(sender, gems, consts.CashChangeResons.COST_GIVE_GEMS.format(receiver));
			if (costRet) {
				addRet = db.add_user_gems(receiver, gems, consts.CashChangeResons.ADD_GAVE_GEMS.format(sender));
			}

			if (addRet) {
				giveGemsMap[sender] = senderGiveRecords != null ? senderGiveRecords : {};
				senderGiveRecords = giveGemsMap[sender];
				var giveNum = senderGiveRecords[receiver];
				senderGiveRecords[receiver] = giveNum != null ? giveNum + 1 : 1;
				return global.RET_OK;
			} else {
				//接收失败，扣费成功则返回原玩家
				if (costRet) {
					db.add_user_gems(sender, gems, '+ give gems to ' + receiver + ' failed.');
				}
				return global.GAME_ERRS.GIVE_FAILED;
			}
		}

		exports.update = function () {
			//刷新协商解散房间
			updateDissolvingRooms();

			//驱动游戏逻辑刷新
			updateGames();

			//续局房间
			updateRenewRooms();
		};

		//取出所有属于自己的房间
		exports.init = function (config) {
			var roomList = db.get_room_list(config.CLIENT_IP, config.CLIENT_PORT);
			if (roomList) {
				for (var i = 0; i < roomList.length; ++i) {
					var roomData = roomList[i];
					constructRoomFromDb(roomData);
				}
			}

			var HOUR = 60 * 60 * 1000;

			//每小时清除一下数据库。
			setInterval(function () {
				fibers(function () {
					var timestamp = Math.floor(Date.now() / 1000);
					//清除三天前的数据。
					timestamp -= 60 * 60 * 24 * 3;
					console.log('clear archive data.');
					db.clear_rooms_archive(timestamp);
					db.clear_games_archive(timestamp);
				}).run();
			}, HOUR);
		}

		exports.computeOnlineCnt = function (roomInfo) {
			if (!roomInfo) {
				return;
			}
			var cnt = 0;
			for (var i = 0; i < roomInfo.seats.length; ++i) {
				if (roomInfo.seats[i].ip != null) {
					cnt++;
				}
			}
			roomInfo.onlineCnt = cnt;
		}

		/**
		 * 获取今日开房间列表(后台管理添加)
		 * @param {Boolean} playing 
		 */
		exports.getTodayOnlineRooms = function (playing) {
			var curNumOfOlRooms = exports.getOnlineRooms(playing);
			var finishedRooms = db.get_room_info_archive();
			var creatTime = new Date(new Date().setHours(0, 0, 0, 0)) / 1000;

			var finishedNumOfAtRooms = 0;
			for (var i in finishedRooms) {
				var roomInfo = finishedRooms[i];

				if (roomInfo != null && creatTime >= roomInfo.create_time) {
					finishedNumOfAtRooms++;
				}
			}

			return curNumOfOlRooms + finishedNumOfAtRooms;
		};

		/**
		 * 获取在线房间列表(后台管理添加)
		 * @param {Boolean} playing - 是否为活跃房间
		 */
		exports.getOnlineRooms = function (playing) {
			var rooms = db.get_room_info(playing);
			return rooms ? rooms.length : 0;
		};