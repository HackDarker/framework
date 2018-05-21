var db = require('../../externals/utils/dbsync');
var fs = require('fs');
var userMgr = (require('../../externals/game_utils/usermgr')).getUserMgr('qzmj');
var consts = require('../../externals/utils/consts');
const CASH_CHANGE_RESONS = consts.CashChangeResons;
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

//协商解散房间列表
var dissolvingList = [];

//不出牌5分钟就解散房间
var dissolvingListdf = [];

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
		nextButton: dbdata.next_button,
		bonusFactor: 0,
		seats: [],
		conf: JSON.parse(dbdata.base_info),
		state: dbdata.state,
		canRenew: CAN_RENEW,
		gametype: config.gametype,
		gamemode: config.gamemode
	};

	if (roomInfo.nextButton == null) {
		roomInfo.nextButton = 0;
	}

	var numPeople = 4;
	if (roomInfo.conf.numPeople) {
		numPeople = roomInfo.conf.numPeople;
	} else {
		roomInfo.conf.numPeople = numPeople;
	}

	var gamepath = 'gamemgr_' + roomInfo.conf.type + '.js';
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
	
	for (var i = 0; i < numPeople; ++i) {
		var seatInfo = seatsInfo[i];
		var s = roomInfo.seats[i] = {};
		s.userId = seatInfo ? seatInfo.user : 0;
		s.score = seatInfo ? seatInfo.score : 0;
		s.ready = s.userId > 0? true:false;
		s.renewed = false;
		s.seatIndex = i;
		s.numZiMo = 0;//自摸
		s.numJiePao = 0;//平胡
		s.numDianPao = 0;
		s.numAnGang = 0;
		s.numMingGang = 0;
		s.numChaJiao = 0;
		s.numYouJin = 0; //游金次数
        s.numShuangYou = 0;//双游次数
        s.numSanYou = 0;//三游次数
        s.numSanJinDao = 0;//三金倒次数
        s.numTianHu = 0;//天胡

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
function resetSeat(seat,bs) {
	if (seat) {
		seat.score = bs;
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
		seat.numYouJin = 0; //游金次数
        seat.numShuangYou = 0;//双游次数
        seat.numSanYou = 0;//三游次数
        seat.numSanJinDao = 0;//三金倒次数
        seat.numTianHu = 0;//天胡
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
		//重置游戏场数
		room.numOfGames = 0;
		//清空dr
		room.dr = null;
		//清空df
		room.df = null;
		//清空解散标记
		room.dissolved = false;

		var beginScore = getOriginScore(room);

		//重置所有座位数据
		for (var i = 0; i < room.seats.length; i++) {
			resetSeat(room.seats[i],beginScore);
		}
		//续费房间状态改为待激活，等待玩家续费
		renewRooms[roomId] = {state: consts.RoomRenewState.UNACTIVE, time: Date.now()};
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
		info.push({ user: userId, score: score });
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

exports.setConfig = function (conf) {
	config = conf;
};

function getOriginScore(room){
	if(room.conf.maxGames == -1){
		return 100;
	}
	return 0;
}

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
	
	if(roomConf.for_others){
		roomConf.aa = false;
	}

	var gameMgr = gameMap['gamemgr_' + roomConf.type + '.js'];
	if (!gameMgr) {
		console.log('unsupported qzmj game type:' + roomConf.type);
		result.ret = GAME_ERRS.UNSUPPORTED_GAME_TYPE;
		return result;
	}

	var ret = gameMgr.getConf(creator, roomConf, gems);
	if(ret.ret.code != 0){
		result.ret = ret.ret;
		return result;
	}

	if (!ret.conf) {
		result.ret = GAME_ERRS.GET_GAME_CONFIG_FAILED;
		return result;
	}

	if (!ret.conf.numPeople) {
		ret.conf.numPeople = 4;
	}

	//替他人开房
	ret.conf.for_others = roomConf.for_others;
	//AA支付
	ret.conf.aa = roomConf.aa;
	//IP限制
	ret.conf.ipstrict = roomConf.ipstrict;

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
			bonusFactor: 0,
			seats: [],
			conf: ret.conf,
			state: consts.RoomState.NOT_START,
			canRenew: CAN_RENEW,
			gametype: gametype,
			gamemode: gamemode
		};

		roomInfo.gameMgr = gameMgr;

		var beginScore = getOriginScore(roomInfo);

		for (var i = 0; i < ret.conf.numPeople; ++i) {
			roomInfo.seats.push({
				userId: 0,
				score: beginScore,
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
				numYouJin :0, //游金次数
				numShuangYou : 0,//双游次数
				numSanYou :0,//三游次数
				numSanJinDao : 0,//三金倒次数
				numTianHu : 0,//天胡
			});
		}
		

		//写入数据库
		var conf = roomInfo.conf;
		var uuid = db.create_room(gametype, gamemode, serverid, roomInfo.id, roomInfo.conf, createTime);
		if(uuid == null){
			ret.errcode = 3;
			return ret;
		}

		//扣除开销
		db.cost_gems(creator, 
					 conf.cost, 
					 CASH_CHANGE_RESONS.COST_CREATE_ROOM.format(roomId));

		//设置房间状态
		setRoomState(roomId, consts.RoomState.NOT_START);

		roomInfo.uuid = uuid;
		console.log(uuid);
		rooms[roomId] = roomInfo;
		totalRooms++;
		ret.roomId = roomId;

		//如果是替他人开房，则需要记录账单
		if(conf.for_others){
			db.insert_bill(uuid,roomId,conf,creator);
		}

		return ret;
	}
};

exports.destroy = function (roomId) {
	var roomInfo = exports.getRoom(roomId);
	if(roomInfo == null){
		return;
	}

	delete rooms[roomId];
	delete renewRooms[roomId];
	totalRooms--;
	db.delete_room(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid);

	for(var i = 0; i < roomInfo.seats.length; ++i){
		var userId = roomInfo.seats[i].userId;
		if(userId > 0){
			delete userLocation[userId];
			db.set_room_id_of_user(userId, null, null, null);
		}
	}
}

exports.getTotalRooms = function(){
	return totalRooms;
}

exports.getRoom = function(roomId) {
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

exports.isCreator = function(roomId,userId){
	var roomInfo = exports.getRoom(roomId);
	if(roomInfo == null){
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

	var room = exports.getRoom(roomId);
	if (room == null) {
		return GAME_ERRS.ROOM_IS_NOT_EXISTED;
	}

	//IP Strict
	if(room.conf.ipstrict){
		for(var k in room.seats){
			var sip = room.seats[k].ip; 
			if(sip != null && sip == userip){
				return GAME_ERRS.IP_STRICT;
			}
		}
	}

	//GPS限制
	if (room.conf.gpsstrict) {
		if (!usergps) {
			console.log('user gps is null when enter room.')
			return GAME_ERRS.GPS_INVALID;
		}

		for (var i in room.seats) {
			var seat = room.seats[i];
			if (seat.userId == userId) {
				continue;
			}

			var seatgps = seat.gpsData;
			if (seatgps == null) {
				continue;
			}

			var dis = gps.getFlatternDistance(seatgps, usergps);
			//GPS数据无效
			if (isNaN(dis)) {
				console.log('gps distance is NaN, gpses -> (' + JSON.parse(seatgps) + 
				':' +  JSON.parse(usergps) + ')');
				return GAME_ERRS.GPS_INVALID;
			}

			//位置过近
			dis = Math.abs(dis);
			if (dis < 20) {
				console.log('gps position is two near.');
				return GAME_ERRS.GPS_STRICT;
			}
		}
	}

	if (exports.getUserRoom(userId) == roomId) {
		console.log('[DEBUG] - user[' + userId + '] is in room[' + roomId +'], state is:' + room.state);
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
				console.log('[DEBUG] - get renew info:' + JSON.stringify(renewInfo) + ', user[' + userId +'] is the first player[' + firstUser + '], be the creator');
				//房卡检查
				if (firstUser
					|| room.conf.aa) {
					console.log('[DEBUG] - check cost aa[' + room.conf.isAA + '], firstPlayer[' + firstUser+']');
					var gems = db.get_gems_by_userid(userId);
					if (gems < room.conf.cost) {
						console.log('[DEBUG] - gems are not enough.');
						return GAME_ERRS.GEMS_NOT_ENOUGH;;
					}

					db.cost_gems(userId, 
								 room.conf.cost,
								 CASH_CHANGE_RESONS.COST_RENEW_ROOM.format(roomId));
				}

				//第一个进入房间的玩家成为续费房间房主
				if (firstUser) {
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

		//已存在
		return RET_OK;
	}
	
	//
	if(room.conf.aa && userId != room.conf.creator){
		var data = db.get_user_data_by_userid(userId);
		if(data.gems < room.conf.cost){
			return GAME_ERRS.GEMS_NOT_ENOUGH;
		}
		db.cost_gems(userId,
					 room.conf.cost,
					 CASH_CHANGE_RESONS.COST_CREATE_ROOM.format(roomId));
	}

	for(var i = 0; i < room.seats.length; ++i){
		var seat = room.seats[i];
		if(seat.userId <= 0){
			seat.userId = userId;
			seat.name = userName;
			seat.ip = userip;
			seat.gpsData = usergps;
			userLocation[userId] = {
				roomId:roomId,
				seatIndex:i
			};

			var beginScore = getOriginScore(room);
			seat.score = beginScore;
			exports.computeOnlineCnt(room);
			//console.log(userLocation[userId]);
			updateDBSeatsInfo(roomId);
			//正常
			return RET_OK;
		}
	}	
	//房间已满
	return GAME_ERRS.ROOM_IS_FULL;
};

exports.setReady = function(userId,value){
	var roomId = exports.getUserRoom(userId);
	if(roomId == null){
		return;
	}

	var room = exports.getRoom(roomId);
	if(room == null){
		return;
	}

	var seatIndex = exports.getUserSeat(userId);
	if(seatIndex == null){
		return;
	}

	var s = room.seats[seatIndex];
	//if(s.ready == value){
	//	return;
	//}
	s.ready = value;

	if(value == false){
		return;
	}

	//如果未开局，则要都准备好了才开
    if(room.game == null){
        for(var i = 0; i < room.seats.length; ++i){
			var s = room.seats[i];
			if(s.ready == false){
				return;
			}
		}
		//人到齐了，并且都准备好了，则开始新的一局
		room.gameMgr.begin(roomId);
		//如果是第一局，则标记状态
		if(room.numOfGames == 1){
			//db.update_bill_state(room.uuid,1);
		}
    }
	else{
		//如果已开局，则同步信息
		room.gameMgr.sync(userId);
	}
}

exports.isReady = function(userId){
	var roomId = exports.getUserRoom(userId);
	if(roomId == null){
		return;
	}

	var room = exports.getRoom(roomId);
	if(room == null){
		return;
	}

	var seatIndex = exports.getUserSeat(userId);
	if(seatIndex == null){
		return;
	}

	var s = room.seats[seatIndex];
	return s.ready;	
}


exports.getUserRoom = function(userId){
	var location = userLocation[userId];
	if(location != null){
		return location.roomId;
	}
	return null;
};

exports.getUserSeat = function(userId){
	var location = userLocation[userId];
	//console.log(userLocation[userId]);
	if(location != null){
		return location.seatIndex;
	}
	return null;
};

exports.getUserLocations = function(){
	return userLocation;
};

exports.exitRoom = function(userId){
	var location = userLocation[userId];
	var room = null;
	if(location != null) {

		var roomId = location.roomId;
		var seatIndex = location.seatIndex;
		room = exports.getRoom(roomId);
		
		if(room != null || seatIndex != null) {
			var seat = room.seats[seatIndex];

			//从房间中踢该座位的玩家
			userMgr.kickSeatInRoom(room, seatIndex);

			//清除玩家座位信息
			clearSeat(seat);

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
	
	if(room.conf.aa && room.state == consts.RoomState.NOT_START) {
		db.cost_gems(userId,
					 -room.conf.cost,
					 CASH_CHANGE_RESONS.RETURN_DISSOLVE_ROOM.format(roomId));
	}

	//清空房间数据
	delete userLocation[userId];
	
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

	exports.computeOnlineCnt(room);

	if (numOfPlayers == 0) {
		exports.destroy(roomId);
	}
};


exports.closeRoom = function(roomId,forceEnd){
	console.log('[DEBUG] - close room[' + roomId + '], force:' + forceEnd);
	var room = exports.getRoom(roomId);
	if (room == null) {
		console.log('[DEBUG] - cant get room[' + roomId +']');
		return;
	}

	db.archive_games(room.gametype, room.gamemode, room.uuid);

	if (room.numOfGames > 1 || (room.numOfGames == 1 && forceEnd)) {
		console.log('[DEBUG] - archive room[' + roomId + '], numOfGames[' + room.numOfGames +']');
		db.archive_room(room.gametype, room.gamemode, room.uuid, false);//room.canRenew
	}

    var s0 = room.seats[0];
	userMgr.broacastInRoom('room_close_push', null, room, s0.userId, true);

	// sleep(1500);
    userMgr.kickAllInRoom(room);

    //如果可续局
	if (false){//(room.canRenew) { //续局取消
		console.log('[DEBUG] - begin renew process');
		//更新数据库中的记录
		console.log('[DEBUG] - update uuid of the room[' + roomId + ']');	
		var uuid = db.renew_room(config.gametype, config.gamemode, roomId, getSeatsInfo(room));
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

exports.hasBegan = function(roomId){
	var roomInfo = exports.getRoom(roomId);
    if(roomInfo == null){
        return false;
    }

	if(roomInfo.game != null){
		return true;
	}

	if(roomInfo.numOfGames > 0){
		return true;
	}

	return false;
};

exports.doDissolve = function (roomId) {
	var roomInfo = exports.getRoom(roomId);
	if (roomInfo == null || roomInfo.dissolved) {
		return null;
	}

	roomInfo.dissolved = true;
	roomInfo.gameMgr.forceEnd(roomInfo);
};

exports.dissolveRequest = function(roomId,userId){
    var roomInfo = exports.getRoom(roomId);
    if(roomInfo == null){
        return null;
    }

    if(roomInfo.dr != null){
        return null;
    }

    var seatIndex = exports.getUserSeat(userId);
    if(seatIndex == null){
        return null;
    }

    roomInfo.dr = {
        endTime:Date.now() + 300000,
        states:[],
    };
	for(var i = 0; i < roomInfo.seats.length; ++i){
		roomInfo.dr.states[i] = false;
	}
    roomInfo.dr.states[seatIndex] = true;

    dissolvingList.push(roomId);

    return roomInfo;
};

exports.dissolveRequestdf = function(roomId){//不出牌5分钟就解散房间
	var roomInfo = exports.getRoom(roomId);
    if(roomInfo == null){
        return;
	}
	if(roomInfo.df != null){
        return;
    }
	roomInfo.df = {
        endTime:Date.now() + 300000,
    };
    dissolvingListdf.push(roomId);
};

exports.dissolveAgreedf = function(roomId,userId,agree){//不出牌5分钟就解散房间
	var roomInfo = exports.getRoom(roomId);
    if(roomInfo == null){
        return;
	}
	if(roomInfo.df == null){
		return;
	}
	roomInfo.df = null
	dissolvingListdf.push(roomId);
	var idx = dissolvingListdf.indexOf(roomId);
	if (idx != -1) {
		dissolvingListdf.splice(idx, 1);
	}
}

exports.dissolveAgree = function(roomId,userId,agree){
    var roomInfo = exports.getRoom(roomId);
    if(roomInfo == null){
        return null;
    }

    if(roomInfo.dr == null){
        return null;
    }

    var seatIndex = exports.getUserSeat(userId);
    if(seatIndex == null){
        return null;
    }

    if(agree){
        roomInfo.dr.states[seatIndex] = true;
    }
    else{
        roomInfo.dr = null;
        var idx = dissolvingList.indexOf(roomId);
        if(idx != -1){
            dissolvingList.splice(idx,1);           
        }
    }
    return roomInfo;
};

exports.updateScores = function (roomId) {
	var room = exports.getRoom(roomId);
	if (room == null) {
		return null;
	}

	updateDBSeatsInfo(roomId);
},

exports.onRoomEnd = function (roomInfo, forceEnd) {
	//如果是强制解散，且第一局未打完，则返还房卡
	if (forceEnd && roomInfo.numOfGames <= 0) {
		if(roomInfo.conf.aa){
			for(var k in roomInfo.seats){
				var s = roomInfo.seats[k];
				db.cost_gems(s.userId, 
							 -roomInfo.conf.cost, 
							 CASH_CHANGE_RESONS.RETURN_DISSOLVE_ROOM.format(roomInfo.id));
			}
		}
		else{
			db.cost_gems(roomInfo.conf.creator, 
						 -roomInfo.conf.cost, 
						 CASH_CHANGE_RESONS.RETURN_DISSOLVE_ROOM.format(roomInfo.id));
		}
		//如果是代开房间，则删除记录
        if(roomInfo.conf.for_others){
			//db.delete_bill(roomInfo.uuid,roomInfo.conf.creator);
        }
    }
	else{
		//正常结束，则标记代开房间的状态
		//db.update_bill_state(roomInfo.uuid,2);
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

function updateDissolvingRoomsdf() {//不出牌5分钟就解散房间
	for (var i = dissolvingListdf.length - 1; i >= 0; --i) {
		var roomId = dissolvingListdf[i];
		var roomInfo = exports.getRoom(roomId);
		if (roomInfo != null && roomInfo.df != null) {
			if (Date.now() > roomInfo.df.endTime) {
				console.log("delete room and games");
				exports.doDissolve(roomId);
				dissolvingListdf.splice(i, 1);
			}
		}
		else {
			dissolvingListdf.splice(i, 1);
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

function checkRoomLife(){
	for(var roomId in rooms){
		if(renewRooms[roomId]){
			return;
		}
		
		var now = Date.now()/1000;
		
		var lifeTime = 3*60*60;
		//删除超时的房间
		var info = rooms[roomId];
		if(info.onlineCnt > 0 || (info.createTime + lifeTime) > now){
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
	//刷新不出牌5分钟就解散房间
	updateDissolvingRoomsdf();

	//刷新续局房间
	updateRenewRooms();

	//
	checkRoomLife();
}

//取出所有属于自己的房间
exports.init = function(config){
	var roomList = db.get_room_list(config.GAME_TYPE,config.GAME_MODE,config.SERVER_ID);
	if(roomList){
		for(var i = 0; i<roomList.length; ++i){
			var roomData = roomList[i];
			var roomInfo = constructRoomFromDb(roomData);
			if(roomInfo.state != consts.RoomState.NOT_START && roomInfo.state != consts.RoomState.PLAYING){
				console.log('remove no need room:' + roomInfo.id); 
				exports.destroy(roomInfo.id);
			}
		}
	}

	var HOUR = 60*60*1000;

	//每小时清除一下数据库。
	setInterval(function(){
		fibers(function(){
			var timestamp = Math.floor(Date.now()/1000);
			//清除三天前的数据。
			timestamp -= 60*60*24*3;
			console.log('clear archive data.');
			db.clear_rooms_archive(config.GAME_TYPE,config.GAME_MODE,timestamp);
			db.clear_games_archive(config.GAME_TYPE,config.GAME_MODE,timestamp);
		}).run();
	},HOUR);
}

exports.computeOnlineCnt = function(roomInfo){
	var cnt = 0;
	for(var i = 0; i < roomInfo.seats.length; ++i){
		if(roomInfo.seats[i].ip != null){
			cnt++;
		}
	}
	roomInfo.onlineCnt = cnt;
}