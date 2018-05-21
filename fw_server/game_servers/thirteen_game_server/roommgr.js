var db = require('../../externals/utils/dbsync');
var fs = require('fs');
var http = require('../../externals/utils/http');
var userMgr = (require('../../externals/game_utils/usermgr')).getUserMgr('thirteen');
var consts = require('../../externals/utils/consts');
var gps = require('../../externals/utils/gps');
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
//玩家定位数据
var userLocation = {};
//房间总数
var totalRooms = 0;

//游戏服务器配置信息
var config = null;

//该游戏是否可以续局
const CAN_RENEW = true;
//可续局房间保留时长
const ROOM_WAIT_INTERVAL = 600000;
//可续局房间等待玩家时长
const ROOM_KICK_INTERVAL = 100000;
//可以续局的房间列表
var renewRooms = {};

//超过指定时间不做任何操作就删除房间就解散房间
var dissolvingListdf = [];

//协商解散房间列表
var dissolvingList = [];

//投票踢人刷新
var VoteKick = [];

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
 * 使用数据库记录回复房间
 * @param {Object} dbdata 
 */
function constructRoomFromDb(dbdata) {
	var roomInfo = {
		uuid: dbdata.uuid,
		id: dbdata.id,
		numOfGames: dbdata.num_of_turns,
		createTime: dbdata.create_time,
		finishTime: dbdata.finish_time,
		nextButton: dbdata.next_button,
		seats: new Array(4),
		conf: JSON.parse(dbdata.base_info),
		state: dbdata.state,
		canRenew: CAN_RENEW,
		gametype: config.gametype,
		gamemode: config.gamemode,
		playing: false,
	};

	var gamepath = 'gamemgr_' + roomInfo.conf.type + '.js';
	var maxChair = 4;
	if (roomInfo.conf.maxChair > 0) {
		maxChair = roomInfo.conf.maxChair;
	}
	//五人场，强制开多一色
	if (maxChair === 5) {
		roomInfo.conf.duoYiSe = true;
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
		if (dbdata.seats_info) {
			seatsInfo = JSON.parse(dbdata.seats_info);
		}
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
		s.numZiMo = 0;
		s.numJiePao = 0;
		s.numDianPao = 0;
		s.numAnGang = 0;
		s.numMingGang = 0;
		s.numChaJiao = 0;

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
	//超过指定时间 不做任何操作就删除 房间
	exports.dissolveRequestdf(roomId);
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
		seat.numZiMo = 0;
		seat.numJiePao = 0;
		seat.numDianPao = 0;
		seat.numAnGang = 0;
		seat.numMingGang = 0;
		seat.numChaJiao = 0;
	}
}

/**
 * 设置房间状态
 */
function setRoomState(roomId, state) {
	console.log('[DEBUG] - set room[' + roomId + '] to state ' + state);
	var room = exports.getRoom(roomId);
	if (room == null
		|| state < consts.RoomState.NOT_START
		|| state > consts.RoomState.WAITING_RENEW) {
		console.log('[DEBUG] - cant get room or state is invalid');
		return;
	}

	console.log('[DEBUG] - update room state in db');
	db.update_room_state(config.gametype, config.gamemode, roomId, state);
	room.state = state;

	//不可续费房间，直接返回
	if (!room.canRenew) {
		console.log('[DEBUG] - no renew room');
		delete renewRooms[roomId];
		return;
	}

	//可续费房间，将房间添加到续费房间列表
	if (room.state == consts.RoomState.WAITING_RENEW) {
		console.log('[DEBUG] - add room into renew rooms');
		//重置房间关联的game
		room.game = null;
		room.playing = false;
		//重置游戏场数
		room.numOfGames = 0;
		//清空dr
		room.dr = null;
		console.log('[DEBUG] - set dissolved to false');
		//清空解散标记
		room.dissolved = false;

		//重置所有座位数据
		for (var i = 0; i < room.seats.length; i++) {
			resetSeat(room.seats[i]);
		}
		//续费房间状态改为待激活，等待玩家续费
		renewRooms[roomId] = { state: consts.RoomRenewState.UNACTIVE, time: Date.now() };
	} else {
		console.log("[DEBUG] - delete renew room[" + roomId + "] when set state:" + state);
		delete renewRooms[roomId];
	}
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
		info.push({user: userId, score: score });
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
}

//俱乐部
function getSeatsClub(num) {
	var info = [];
	var userId = 0;
	var score = 0;
	for (var i = 0; i < num; i++) {
		userId =  0;
		score =  0
		info.push({user: userId, score: score });
	}
	return info;
}

//俱乐部
function updateDBSeatsClub(roomId , num) {
	if (roomId == null) {
		return;
	}
	var seatsInfo = getSeatsClub(num);
	db.update_seats_info("0030001", "norm", roomId, seatsInfo);
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
		console.log('unsupported thirteen game type:' + roomConf.type);
		result.ret = GAME_ERRS.UNSUPPORTED_GAME_TYPE;
		return result;
	}

	result.ret = gameMgr.checkConfTow(roomConf, gems);
	if (result.ret.code !== 0) {
		return result;
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
			finishTime: 0,
			nextButton: 0,
			seats: [],
			conf: gameMgr.getConf(roomConf, creator),
			state: consts.RoomState.NOT_START,
			canRenew: CAN_RENEW,
			gametype: gametype,
			gamemode: gamemode,
			playing: false,
		};

		roomInfo.gameMgr = gameMgr;

		var maxChair = 4;
		if (roomInfo.conf.maxChair) {
			maxChair = roomInfo.conf.maxChair;
		}

		//五人场，强制开多一色
		if (maxChair === 5) {
			roomInfo.conf.duoYiSe = true;
		}

		roomInfo.maxChair = maxChair;
		for (var i = 0; i < maxChair; ++i) {
			roomInfo.seats.push({
				userId: 0,
				score: 0,
				name: "",
				ready: false,
				renewed: false,
				seatIndex: i,
				numZiMo: 0,
				numJiePao: 0,
				numDianPao: 0,
				numAnGang: 0,
				numMingGang: 0,
				numChaJiao: 0,
			});
		}


		//写入数据库
		var conf = roomInfo.conf;
		var uuid = db.create_room(gametype, gamemode, serverid, roomInfo.id, roomInfo.conf, createTime);
		if (uuid != null) {
			roomInfo.uuid = uuid;
			console.log('create_room', uuid);
			rooms[roomId] = roomInfo;
			totalRooms++;
			result.roomId = roomId;
			//超过指定时间 不做任何操作就删除 房间
			exports.dissolveRequestdf(roomId);
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
	for (var i = 0; i < roomInfo.maxChair; ++i) {
		var userId = roomInfo.seats[i].userId;
		if (userId > 0) {
			var location = userLocation[userId];
			if (location != null) {
				if (location.roomId == roomId) {
					delete userLocation[userId];
					//作用避免该玩家 内存里存储有多个信息, 导致清空玩家房间id 进不去原来的房间,产生一个玩家可以进入多个房间的BUG
					var temp = db.get_user_roomid(userId);
					if (temp && temp.roomid == roomId && temp.gametype == '0030001') {
						//清空数据库中玩家自己的房间id
						db.set_room_id_of_user(userId, null, null, null);
					} else {
						console.error('[ROOMBUG]--mysql information player != Memory --[userid]:' + userId + '[roomid]:' + roomId + '[sql]:', temp);
					}
				}
			}
		}
	}
	delete rooms[roomId];
	delete renewRooms[roomId];
	totalRooms--;
	if (roomInfo.conf.isAA && roomInfo.conf.for_other && roomInfo.conf.club_id) {
		console.log('俱乐部所开房间不需要从数据库清除,由圈主解散！同时还原此房间的数据',roomInfo.conf.maxChair);
		var num = 4
		if (roomInfo.conf.maxChair > 0) {
			num = roomInfo.conf.maxChair;
		}
		//更新十三水数据库位置信息
		updateDBSeatsClub(roomId, num);
		// db.update_club_room_uuid(roomInfo.gametype, roomInfo.gamemode, roomId);
		var ret = db.update_num_of_turns(roomInfo.gametype, roomInfo.gamemode, roomId, 0);
		var ret = db.update_next_button(roomInfo.gametype, roomInfo.gamemode, roomId, 0);
		return;
	}
	db.delete_room(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid);

};

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

exports.enterRoom = function (roomId, userId, userName, gametype, gamemode, userip, usergps) {
	if (config == null ||
		config.gametype != gametype ||
		config.gamemode != gamemode) {
		return GAME_ERRS.UNMATCH_GAME_TYPE_OR_MOD;
	}

	console.log('[Debug] - ' + userId + ' request enter room[' + roomId);
	if (userId == null) {
		console.log('[Error] - user id is null.');
	}

	var room = exports.getRoom(roomId);
	if (room == null) {
		return GAME_ERRS.ROOM_IS_NOT_EXISTED;
	}

	//IP Strict
	if (room.conf.ipstrict) {
		for (var k in room.seats) {
			var sip = room.seats[k].ip;
			if (sip != null && sip == userip) {
				return GAME_ERRS.IP_STRICT;
			}
		}
	}

	if (exports.getUserRoom(userId) == roomId) {
		console.log('[DEBUG] - user[' + userId + '] is in room[' + roomId + '], state is:' + room.state);
		if (room.conf.isAA && room.numOfGames == 0) {
			var gems = db.get_gems_by_userid(userId);
			var ret = room.gameMgr.checkConf(room.conf, gems);
			if (ret.code !== 0) {
				console.log('[DEBUG] - gems are not enough.');
				return ret;
			}
		}
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
				// if (firstUser
				// 	|| room.conf.isAA) {
				// 	console.log('[DEBUG] - check cost aa[' + room.conf.isAA + '], firstPlayer[' + firstUser + ']');
				// 	var gems = db.get_gems_by_userid(userId);
				// 	var ret = room.gameMgr.checkConf(room.conf, gems);
				// 	if (ret.code !== 0) {
				// 		console.log('[DEBUG] - gems are not enough.');
				// 		return ret;
				// 	}
				// }

				//第一个进入房间的玩家成为续费房间房主
				if (firstUser) {
					//第一个进入房间不是aa支付的, 检查游戏是否足够
					if (!room.conf.isAA && room.numOfGames == 0) {
						var gems = db.get_gems_by_userid(userId);
						var ret = room.gameMgr.checkConf(room.conf, gems);
						if (ret.code !== 0) {
							console.log('[DEBUG] - gems are not enough.');
							return ret;
						}
					}
					console.log('[DEBUG] - first in user, change creator, update db, change renew state');
					room.conf.creator = userId;
					db.update_room_creator(room.gametype, room.gamemode, roomId, room.conf.creator);
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

		return RET_OK;
	}
	
	//如果是AA制，则要预判玩家钻石是否够
	if (room.conf.isAA === true) {
		var gems = db.get_gems_by_userid(userId);
		var ret = room.gameMgr.checkConf(room.conf, gems);
		if (ret.code !== 0) {
			console.log('[Debug] - gems are not enough');
			return ret;
		}
	}

	for (var i = 0; i < room.maxChair; ++i) {
		var seat = room.seats[i];
		if (seat.userId == null || seat.userId <= 0) {
			seat.userId = userId;
			seat.name = userName;
			seat.ready = false;
			seat.ip = userip;
			seat.gpsData = usergps;
			userLocation[userId] = {
				roomId: roomId,
				seatIndex: i
			};

			exports.computeOnlineCnt(room);
			//console.log(userLocation[userId]);
			updateDBSeatsInfo(roomId);
			if (room.conf.for_other && room.conf.club_id) {
				let numOfPlayers = 0;
				if (room != null) {
					for (let i = 0; i < room.seats.length; ++i) {
						if (room.seats[i].userId > 0) {
							numOfPlayers++;
						}
					}
				}
				var result = {
					club_id: room.conf.club_id,
					roomid: roomId,
					numOfPlayers: numOfPlayers,
					maxChair: room.conf.maxChair
				}
				exports.sendMsgToClub(room.conf.club_id, result, 'RoomInfoChange', '房间人数');
			}
			//正常
			return RET_OK;
		}
	}

	//房间已满
	return GAME_ERRS.ROOM_IS_FULL;
};

exports.setReady = function (userId, value) {
	value = value != null ? value : false;
	if (userId == null || value == false) {
		return;
	}

	var roomId = exports.getUserRoom(userId);
	if (roomId == null) {
		return;
	}

	var room = exports.getRoom(roomId);
	if (room == null) {
		return;
	}

	var seatIndex = exports.getUserSeat(userId);
	if (seatIndex != null) {
		var s = room.seats[seatIndex];
		if (s && s.ready != value) {
			s.ready = value;
			userMgr.broacastInRoom('room_user_ready_push', { userid: userId, ready: true }, room, userId, true);
		}
	}

	//离线自动准备
	if (!CAN_RENEW || room.state != consts.RoomState.WAITING_RENEW) {
		for (var seatIdx in room.seats) {
			var seat = room.seats[seatIdx];
			if (seat == null || seat.userId <= 0) {
				continue;
			}

			if (userMgr.isOnline(seat.userId) == false && seat.ready == false) {
				seat.ready = true;
				userMgr.broacastInRoom('room_user_ready_push', { userid: seat.userId, ready: true }, room, userId, true);
			}
		}
	}
	if (value) {
		//更新指定时间 不做任何操作就删除 房间
		exports.dissolveRequestdf(roomId);
	}
	exports.checkRoomState(roomId, userId);
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

exports.checkRoomState = function (roomId, userId) {
	var room = exports.getRoom(roomId);
	if (room == null) {
		return;
	}

	//如果未开局，则要4家都准备好了才开
	if (room.game == null) {
		if (room.seats.length == room.maxChair) {
			for (var i = 0; i < room.seats.length; ++i) {
				var s = room.seats[i];
				if (!s.userId || s.ready == false) {
					return;
				}
			}

			//如果游戏开始 还在投票踢人就取消投票踢人
            if (room.kick != null) {
                room.kick = null
                userMgr.broacastInRoom('kickout_notice_push', null, room, userId, true);
			}
			
			//4个人到齐了，并且都准备好了，则开始新的一局
			room.gameMgr.begin(roomId);
			room.playing = true;
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

	roomInfo.seats.sort(function () { return 0.5 - Math.random() });

	var seatOrder = [];
	for (var i = 0; i < roomInfo.maxChair; ++i) {
		var s = roomInfo.seats[i];
		s.seatIndex = i;
		userLocation[s.userId].seatIndex = i;
		seatOrder[i] = s.userId;
		//更新数据库
		updateDBSeatsInfo(roomId);
	}
	//刷新
	userMgr.broacastInRoom('room_seats_changed_push', seatOrder, roomInfo, roomInfo.seats[0].userId, true);
}

exports.isRoomReady = function (roomId) {
	var room = exports.getRoom(roomId);
	if (room == null) {
		return false;
	}

	var seats = room.seats;

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

exports.exitRoom = function (userId ,roomNum) {
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
			updateDBSeatsInfo(roomId);

			//如果是续费房间，取不到续费房间数据或者续费房间已经激活，有人退出则重置房间状态
			if (room.state == consts.RoomState.WAITING_RENEW) {
				var renewInfo = renewRooms[roomId];
				if (renewInfo.state == consts.RoomRenewState.ACTIVE
					|| renewInfo == null) {
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

	//作用避免该玩家 内存里存储有多个信息, 导致清空玩家房间id 进不去原来的房间,产生一个玩家可以进入多个房间的BUG
	var temp = db.get_user_roomid(userId);
	if (temp && temp.roomid == roomId && temp.gametype == '0030001') {
		//清空数据库中玩家自己的房间id
		db.set_room_id_of_user(userId, null, null, null);
	} else {
		//console.error('[ROOMBUG]--mysql information player != Memory --[userid]:' + userId + '[roomid]:' + roomId + '[sql]:', temp);
	}

	//清空房间数据
	delete userLocation[userId];
	var numOfPlayers = 0;
	if (room != null) {
		for (var i = 0; i < room.seats.length; ++i) {
			if (room.seats[i].userId > 0) {
				numOfPlayers++;
			}
		}
		exports.syncToClub(room, numOfPlayers, roomId);
	}

	exports.computeOnlineCnt(room);
	console.log('[DEBUG] - num of players is:' + numOfPlayers);
	if (numOfPlayers == 0) {
		exports.destroy(roomId);
	}
};

//玩家进出房间同步到俱乐部大厅
exports.syncToClub = function (room,numOfPlayers,roomId) {
	//玩家退出房间同步数据到俱乐部
	var result = {
		club_id: room.conf.club_id,
		roomid: roomId,
		numOfPlayers: numOfPlayers,
		maxChair: room.conf.maxChair
	}
	exports.sendMsgToClub(room.conf.club_id, result, 'RoomInfoChange', '房间人数');
};

exports.closeRoom = function (roomId, forceEnd) {
	console.log('[DEBUG] - close room[' + roomId + '], force:' + forceEnd);
	var room = exports.getRoom(roomId);
	if (room == null) {
		console.log('[DEBUG] - cant get room[' + roomId + ']');
		return;
	}

	db.archive_games(room.gametype, room.gamemode, room.uuid);

	if (room.numOfGames > 1 || (room.numOfGames == 1 && forceEnd)) {
		console.log('[DEBUG] - archive room[' + roomId + '], numOfGames[' + room.numOfGames + ']');
		db.archive_room(room.gametype, room.gamemode, room.uuid, room.canRenew);//room.canRenew
	}

	var s0 = room.seats[0];
	userMgr.broacastInRoom('room_close_push', null, room, s0.userId, true);
	userMgr.kickAllInRoom(room);


	//如果可续局
	if (true) {//room.canRenew
		//续局状态 2 表示可续局 0表示未开始
		var state = 2;
		//如果是俱乐部 续局时 清空该房间的玩家所有信息
		if (room.conf.for_other && room.conf.club_id) {
			state = 0;
			console.log('[CHECK] - julebu -room:[' + roomId + ']');
			for (var i = 0; i < room.seats.length; ++i) {
				var userId = room.seats[i].userId;
				var seat = room.seats[i];
				if (userId > 0) {
					var location = userLocation[userId];
					if (location != null) {
						if (location.roomId == roomId) {
							delete userLocation[userId];
							//作用避免该玩家 内存里存储有多个信息, 导致清空玩家房间id 进不去原来的房间,产生一个玩家可以进入多个房间的BUG
							var temp = db.get_user_roomid(userId);
							if (temp && temp.roomid == roomId && temp.gametype == '0030001') {
								//清空数据库中玩家自己的房间id
								db.set_room_id_of_user(userId, null, null, null);
							} else {
								console.error('[ROOMBUG]--mysql information player != Memory --[userid]:' + userId + '[roomid]:' + roomId + '[sql]:', temp);
							}
						}
					}
					//清除玩家座位信息
					clearSeat(seat);
				}
			}

			//更新数据库中的数据
			updateDBSeatsInfo(roomId);
			//玩家退出房间同步数据到俱乐部
			exports.syncToClub(room, 0, roomId);

			exports.destroy(roomId);
		} else {
			//数据库局数恢复
			db.update_num_of_turns(room.gametype, room.gamemode, roomId, 0);
			//数据库庄家恢复
			db.update_next_button(room.gametype, room.gamemode, roomId, 0);
		}

		console.log('[DEBUG] - begin renew process');
		//更新数据库中的记录
		console.log('[DEBUG] - update uuid of the room[' + roomId + ']');
		var uuid = db.renew_room(config.gametype, config.gamemode, roomId, getSeatsInfo(room));

		if (!uuid) {
			if (room.conf.for_other && room.conf.club_id) {
				room.conf.for_other = false;
				room.conf.club_id = false;
				console.error('[DEBUG] -julebu xuFei uuid为null -failed.roomid:[' + roomId + ']');
			}
			exports.destroy(roomId);
			return;
		}
		room.uuid = uuid;
		if (state == 2) {
			//更新房间状态
			setRoomState(roomId, state);//consts.RoomState.WAITING_RENEW
		}
	} else {
		console.log('[DEBUG] - destory room[' + roomId + ']');
		exports.destroy(roomId);
	}
};

//不做任何操作超过2个小时就解散房间房间
exports.dissolveRequestdf = function (roomId) {
	var roomInfo = exports.getRoom(roomId);
	if (roomInfo == null) {
		return;
	}
	if (roomInfo.df != null) {
		roomInfo.df.endTime = Date.now() + 88800000;
		return;
	}
	roomInfo.df = {
		endTime: Date.now() + 88800000,
	};

	if (dissolvingListdf.indexOf(roomId) != 0) {
		dissolvingListdf.push(roomId);
	}
};

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

//-------记录投票踢人房间----------------
exports.dissolveVoteKick = function (roomId) {
	var roomInfo = exports.getRoom(roomId);
	if (roomInfo == null) {
		return;
	}

	if (roomInfo.kick == null) {
		return;
	}

	if (VoteKick.indexOf(roomId) != 0) {
		VoteKick.push(roomId);
	}
};


exports.doDissolve = function (roomId) {
	var roomInfo = exports.getRoom(roomId);
	if (roomInfo == null || roomInfo.dissolved) {
		return null;
	}

	roomInfo.dissolved = true;
	roomInfo.gameMgr.forceEnd(roomInfo);
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
		endTime: Date.now() + 180000,
		states: []
	};

	for (var i = 0; i < roomInfo.seats.length; ++i) {
		roomInfo.dr.states[i] = false;
	}

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
	}
	else {
		roomInfo.dr = null;
		var idx = dissolvingList.indexOf(roomId);
		if (idx != -1) {
			dissolvingList.splice(idx, 1);
		}
	}
	return roomInfo;
};
//俱乐部投票记录被踢的人
exports.kickOutRequest = function (roomId, userId, target) {
	var roomInfo = exports.getRoom(roomId);
	if (roomInfo == null) {
		return null;
	}

	var seatIndex = exports.getUserSeat(userId);
	if (seatIndex == null) {
		return null;
	}

	roomInfo.kick = {
		sender: userId,
		target: target,
		onlineCnt: 0,
		endTime: Date.now() + 30000,//30s后无操作自动同意
		seats: [],
	};

	//-------记录投票踢人房间--超过指定时间就踢人或者不踢人------
	exports.dissolveVoteKick(roomId);
	console.log('----俱乐部投票记录被踢的人----', userId);
	for (var i = 0; i < roomInfo.seats.length; ++i) {
		var seat = {
			states: -1
		};
		if (roomInfo.seats[i].userId > 0) {
			seat.online = true;
			roomInfo.kick.onlineCnt++;
		} else {
			seat.online = false;
		}
		roomInfo.kick.seats[i] = seat;
	}

	roomInfo.kick.seats[seatIndex].states = true;

	return roomInfo;
};


//俱乐部同意或者拒绝踢人
exports.kickOutAgree = function (roomId, userId, agree) {
	var roomInfo = exports.getRoom(roomId);
	if (roomInfo == null) {
		return null;
	}

	if (roomInfo.kick == null) {
		return null;
	}

	var seatIndex = exports.getUserSeat(userId);
	if (seatIndex == null) {
		return null;
	}

	roomInfo.kick.seats[seatIndex].states = agree;
	//如果有人拒绝 取消踢该玩家
	if (agree == false) {
		userMgr.broacastInRoom('kickout_notice_push', null, roomInfo, userId, true);
		roomInfo.kick = null;
		return;
	}
	if (roomInfo != null) {
		var kick = roomInfo.kick;
		var doAllAgreeCnt = 0;
		var notvote = 0;//未投票人数
		for (var i = 0; i < kick.seats.length; ++i) {
			if (kick.seats[i].online && kick.seats[i].states == true) {
				console.log('seatindex', i);
				doAllAgreeCnt++;
			} else if (kick.seats[i].online && kick.seats[i].states == -1) {
				notvote++;
			}
		}
		//如果被踢的玩家是离线的,不用所有人投票完成就可以踢人
		let online = userMgr.isOnline(roomInfo.kick.target);
		let boolonline = true;
		if(!online){
			if (doAllAgreeCnt > (kick.onlineCnt / 2)){
				boolonline = false;
			}
		}
		if (notvote && boolonline) {
			console.log('有人还未投票');
		} else {
			console.log('所有人投票完毕，计算是否踢人');
			console.log('doAllAgreeCnt', doAllAgreeCnt);
			console.log('onlineCnt', kick.onlineCnt);
			console.log('kick', roomInfo.kick);
			var gameStart = exports.hasBegan(roomId);
			console.log('游戏是否开始-如果游戏开始投票失败:', roomInfo.kick);
			if (doAllAgreeCnt > (kick.onlineCnt / 2) && !gameStart) {
				//通知其它玩家，有人退出了房间
				userMgr.broacastInRoom('exit_notify_push', kick.target, roomInfo, userId, false);
				userMgr.broacastInRoom('Tiren_push', kick.target, roomInfo, userId, true);
				userMgr.kickOne(kick.target);
				exports.exitRoom(kick.target, roomId);
				roomInfo.kick = null;
				return;
			} else {
				kick = {};
				roomInfo.kick = null;
			}
		}
		userMgr.broacastInRoom('kickout_notice_push', kick, roomInfo, userId, true);
	}
};

//投票踢人到指定时间 没人投票 实行踢人或者踢人失败.
exports.kickOutTime = function (roomId) {
	var roomInfo = exports.getRoom(roomId);
	if (roomInfo == null) {
		return null;
	}

	let userId = 0
	for (let i = 0; i < roomInfo.seats.length; ++i) {
		if(roomInfo.seats[i].userId > 0){
			userId = roomInfo.seats[i].userId;
			break;
		}
	}

	if(!userId){
		return;
	}

	if (roomInfo.kick == null) {
		userMgr.broacastInRoom('kickout_notice_push', null, roomInfo, userId, true);
		return null;
	}

	let online = userMgr.isOnline(roomInfo.kick.target);
	let gameStart = exports.hasBegan(roomId);
	//console.log('---指定时间被踢玩家信息---',roomInfo.kick.target +'游戏是否开始:'+gameStart);
	if (!gameStart) {
		//通知其它玩家，有人退出了房间
		userMgr.broacastInRoom('exit_notify_push', roomInfo.kick.target, roomInfo, userId, false);
		userMgr.broacastInRoom('Tiren_push', roomInfo.kick.target, roomInfo, userId, true);
		userMgr.kickOne(roomInfo.kick.target);
		exports.exitRoom(roomInfo.kick.target, roomId);
		userMgr.broacastInRoom('kickout_notice_push', 'finsh', roomInfo, userId, true);
		roomInfo.kick = null;
		return;
	}else{
		roomInfo.kick = null;
	}
	userMgr.broacastInRoom('kickout_notice_push', null, roomInfo, userId, true);
};

function updateDissolvingRooms() {
	for (var i = dissolvingList.length - 1; i >= 0; --i) {
		var roomId = dissolvingList[i];

		var roomInfo = exports.getRoom(roomId);
		if (roomInfo != null && roomInfo.dr != null) {
			if (Date.now() > roomInfo.dr.endTime) {
				console.log("delete room and games");
				exports.doDissolve(roomId);
				dissolvingList.splice(i, 1);
			}
		}
		else {
			dissolvingList.splice(i, 1);
		}
	}
}

//不做任何操作超过指定时间解散房间
function updateDissolvingRoomsdf() {
	for (var i = dissolvingListdf.length - 1; i >= 0; --i) {
		var roomId = dissolvingListdf[i];
		var roomInfo = exports.getRoom(roomId);
		if (roomInfo != null && roomInfo.df != null) {
			if (Date.now() > roomInfo.df.endTime) {
				console.log("[delete] ----- room", roomId);
				// if (exports.hasBegan(roomId) || roomInfo.numOfGames > 0) {
				// 	exports.doDissolve(roomId)
				// } else {
				// 	for (var n = 0; n < roomInfo.seats.length; n++) {
				// 		if (roomInfo.seats[n].userId > 0) {
				// 			userMgr.kickOne(roomInfo.seats[n].userId);
				// 			exports.exitRoom(roomInfo.seats[n].userId);
				// 		}
				// 	}	
				// }
				exports.destroy(roomId);
				dissolvingListdf.splice(i, 1);
			}
		}
		else {
			dissolvingListdf.splice(i, 1);
		}
	}
}

//俱乐部投票踢人时间刷新
function updateVoteKick() {
	for (var i = VoteKick.length - 1; i >= 0; --i) {
		var roomId = VoteKick[i];
		var roomInfo = exports.getRoom(roomId);
		if (roomInfo != null && roomInfo.kick != null) {
			if (Date.now() > roomInfo.kick.endTime) {
				console.log("[delete] kickOutTime----- room:", roomId);
				exports.kickOutTime(roomId)
				VoteKick.splice(i, 1);
			}
		}
		else {
			VoteKick.splice(i, 1);
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
					//作用避免该玩家 内存里存储有多个信息, 导致清空玩家房间id 进不去原来的房间,产生一个玩家可以进入多个房间的BUG
					var temp = db.get_user_roomid(seat.userId);
					if (temp && temp.roomid == roomId && temp.gametype == '0030001') {
						//清空数据库中玩家自己的房间id
						db.set_room_id_of_user(seat.userId, null, null, null);
					} else {
						console.error('[ROOMBUG]--mysql information player != Memory --[userid]:' + userId + '[roomid]:' + roomId + '[sql]:', temp);
					}
					//通知其它玩家，有人退出了房间
					userMgr.broacastInRoom('exit_notify_push', seat.userId, room, seat.userId, false);
				}
			}

			console.log('[DEBUG] - set room[' + roomId + '] state NO_START');
			setRoomState(roomId, consts.RoomState.NOT_START);
		}
	}
}

function checkRoomLife() {
	for (var roomId in rooms) {
		if (renewRooms[roomId]) {
			return;
		}

		var now = Date.now() / 1000;

		var lifeTime = 3 * 60 * 60;
		//删除超时的房间
		var info = rooms[roomId];
		if (info.onlineCnt > 0 || (info.createTime + lifeTime) > now || info.conf.club_id) {
			continue;
		}

		//超时移除的房间，不走续费流程。
		info.canRenew = false;
		console.log('life is over:' + info.id);
		//
		exports.doDissolve(info.id);
	}
}

exports.update = function () {
	//刷新协商解散房间
	updateDissolvingRooms();

	//驱动游戏逻辑刷新
	updateGames();

	//不做任何操作超过指定时间解散房间
	updateDissolvingRoomsdf();

	//投票超过指定时间 踢人或者不踢人
	updateVoteKick();

	//续局房间
	// updateRenewRooms();

	// //
	// checkRoomLife();
};

//取出所有属于自己的房间
exports.init = function (config) {
	console.error('－－－－－－－－－服务器重启－－－－－－－－');
	var roomList = db.get_room_list(config.GAME_TYPE, config.GAME_MODE, config.SERVER_ID);
	if (roomList) {
		for (var i = 0; i < roomList.length; ++i) {
			var roomData = roomList[i];
			var roomInfo = constructRoomFromDb(roomData);
			if (roomInfo.state != consts.RoomState.NOT_START && roomInfo.state != consts.RoomState.PLAYING) {
				console.log('remove no need room:' + roomInfo.id);
				exports.destroy(roomInfo.id);
			}
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
			db.clear_rooms_archive(config.GAME_TYPE, config.GAME_MODE, timestamp);
			db.clear_games_archive(config.GAME_TYPE, config.GAME_MODE, timestamp);
		}).run();
	}, HOUR);
}

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
	console.log('sendMsgToClub	data', data);
	var url = 'http://' + 'localhost' + ':' + 9000;
	fibers(() => {
		var httpres = http.getSync2(url + '/send_msg_to_club', data);
		console.log('游戏信息发送到俱乐部：', httpres);
	}).run();
};

exports.computeOnlineCnt = function (roomInfo) {
	if (roomInfo == null) {
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


exports.kick_user = function (userIdList) {
	// console.log('kick_user', userIdList);
	// console.log('length', userIdList.length);
	// console.log('kick_user', typeof userIdList);
	if (userIdList.length > 0) {
		for (let index = 0; index < userIdList.length; index++) {
			const userId = userIdList[index];
			if (userId == null) {
				return false;
			}

			var roomId = exports.getUserRoom(userId);
			if (roomId == null) {
				return false;
			}
			var room = exports.getRoom(roomId);
			//如果游戏已经开始，则不可以
			if (exports.hasBegan(roomId)) {
				return false;
			}
			//通知其它玩家，有人退出了房间
			userMgr.broacastInRoom('exit_notify_push', userId, room, userId, false);
			userMgr.broacastInRoom('Tiren_push', userId, room, userId, true);
			userMgr.kickOne(userId);
			exports.exitRoom(userId,roomId);
		}
		delete rooms[roomId];
		delete renewRooms[roomId];
		totalRooms--;
	}
	return true;
};

