var db = require('../../externals/utils/dbsync');
var fs = require('fs');
var http = require('../../externals/utils/http');
var userMgr = (require('../../externals/game_utils/usermgr')).getUserMgr('dht');
var consts = require('../../externals/utils/consts');
const CASH_CHANGE_RESONS = consts.CashChangeResons;
var gps = require('../../externals/utils/gps');
var fibers = require('fibers');
var crypto = require('../../externals/utils/crypto');

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

//超过指定时间就解散房间
var dissolvingListdf = [];

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
		nextButton: dbdata.next_button,
		bonusFactor: 0,
		seats: [],
		conf: JSON.parse(dbdata.base_info),
		state: dbdata.state,
		canRenew: CAN_RENEW,
		gameOver: [],
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
		if(dbdata.seats_info){
			seatsInfo = JSON.parse(dbdata.seats_info);
		}
	} catch (e) {
		console.log('[Error] - JSON parse seat info error, seat_info:' + dbdata.seats_info);
	}
	
	fibers(function () {
		for (var i = 0; i < numPeople; ++i) {
			var seatInfo = seatsInfo[i];
			var s = roomInfo.seats[i] = {};
			s.userId = seatInfo ? seatInfo.user : 0;
			s.score = seatInfo ? seatInfo.score : 100;
			s.gangScore = seatInfo ? seatInfo.gangScore : 0;
			var ready = false;
			if (seatInfo) {
				if (seatInfo.ready == false || seatInfo.ready == true) {
					ready = seatInfo.ready;
				} else {
					ready = dbdata.num_of_turns > 0;
				}
				//r如果局数大于０.　有userid 等于0　出现bug 局数赋值为０ 更新数据库局数
				if (dbdata.num_of_turns > 0) {
					if (s.userId == 0) {
						roomInfo.numOfGames = 0;
						dbdata.num_of_turns = 0;
						db.update_num_of_turns("0020001", "norm", roomId, 0);
						console.error('[ROOMBUG]--num_of_turns>0--userid is null [room]:' + roomId);
					}
				}
			} else {
				//r如果局数大于０.　有userid 等于0　出现bug 局数赋值为０ 更新数据库局数
				if (dbdata.num_of_turns > 0) {
					if (s.userId == 0) {
						roomInfo.numOfGames = 0;
						dbdata.num_of_turns = 0;
						db.update_num_of_turns("0020001", "norm", roomId, 0);
						console.error('[ROOMBUG]--num_of_turns>0--userid is null [room]:' + roomId);
					}
				}
			}
			s.ready = ready;
			s.renewed = false;
			s.seatIndex = i;
			s.scoreOfRounds = [];
			s.gangScoreOfRounds = [];
			s.numZiMo = 0;
			s.numAnGang = 0;
			s.numMingGang = 0;
			s.numDiangang = 0;
			s.numJiegang = 0;

			if (s.userId > 0) {
				userLocation[s.userId] = {
					roomId: roomId,
					seatIndex: i
				};
				userIdList.push(s.userId);
			}
		}
	}).run();

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
 * 游戏结算清空game数据 等待待续费
 * @param {Object} seat 
 */
function resetSeatGame(seat) {
	if (seat) {
		seat.score = 100;
		seat.gangScore = 0;
		seat.ready = false;
		seat.scoreOfRounds = [];
		seat.gangScoreOfRounds = [];
		seat.numZiMo = 0;
		seat.numAnGang = 0;
		seat.numMingGang = 0;
		seat.numDiangang = 0;
		seat.numJiegang = 0;
	}
}

/**
 * 重置除玩家id，姓名，座位号以外的全部数据
 * @param {Object} seat 
 */
function resetSeat(seat, score) {
	if (seat) {
		seat.score = score;
		seat.gangScore = 0;
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
		seat.score = 100;
		seat.gangScore = 0;
		seat.name = "";
		seat.ready = false;
		seat.renewed = false;
		seat.scoreOfRounds = [];
		seat.gangScoreOfRounds = [];
		seat.numZiMo = 0;
		seat.numAnGang = 0;
		seat.numMingGang = 0;
		seat.numDiangang = 0;
		seat.numJiegang = 0;
	}
}

/**
 * 设置房间状态
 */
function setRoomState(roomId, state, gameStart) {
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
	if (!room.canRenew) {//!room.canRenew
		console.log('[DEBUG] - no renew room');
		delete renewRooms[roomId];
		return;
	}

	//可续费房间，将房间添加到续费房间列表  //和游戏未开始才能进入
	if (room.state == consts.RoomState.WAITING_RENEW && !gameStart) {
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
		//清空游戏结算信息
		room.gameOver = [];

		var beginScore = getOriginScore(room);

		//重置所有座位数据
		for (var i = 0; i < room.seats.length; i++) {
			resetSeat(room.seats[i], beginScore);
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
	var score = 100;
	//比赛场分数
	if(room.conf.bsc){
		score = 0;
	}
	var seat = null;
	var userId = 0;
	
	for (var i in room.seats) {
		seat = room.seats[i];
		userId = seat ? seat.userId : 0;
		score = seat ? seat.score : score;
		gangScore = seat ? seat.gangScore : 0;
		ready = seat ? seat.ready : false;
		info.push({ user: userId, score: score, gangScore: gangScore, ready: ready });
	}

	return info;
}

function getSeatsClub() {
	var info = [];

	var userId = 0;
	var score = 0;
	for (let i = 0; i < 4; i++) {
		userId = 0;
		score = 100;
		gangScore = 0;
		ready = false;
		info.push({ user: userId, score: score, gangScore: gangScore, ready: ready });
	}
	return info;
}

function updateDBSeatsInfo(roomId) {
	var room = exports.getRoom(roomId);
	if (room == null || room.seats == null) {
		return false;
	}
	var seatsInfo = getSeatsInfo(room);
	//console.log('seatsInfo', seatsInfo);
	db.update_seats_info(room.gametype, room.gamemode, roomId, seatsInfo);
}

//俱乐部
function updateDBSeatsClub(roomId) {
	if (roomId == null) {
		return;
	}
	var seatsInfo = getSeatsClub();
	console.log('seatsInfo', seatsInfo);
	db.update_seats_info("0020001", "norm", roomId, seatsInfo);
}

exports.setConfig = function (conf) {
	config = conf;
};

function getOriginScore(room) {
	if(room.conf.bsc){
		console.log('getOriginScore 比赛场为0');
		return 0;
	}
	return 100;
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

	if (roomConf.for_others && !roomConf.club_id) {
		roomConf.aa = false;
	}

	var gameMgr = gameMap['gamemgr_' + roomConf.type + '.js'];
	if (!gameMgr) {
		console.log('unsupported dht game type:' + roomConf.type);
		result.ret = GAME_ERRS.UNSUPPORTED_GAME_TYPE;
		return result;
	}

	var ret = gameMgr.getConf(creator, roomConf, gems);
	if (ret.ret.code != 0) {
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
			gameOver: [],
			canRenew: CAN_RENEW,
			gametype: gametype,
			gamemode: gamemode
		};

		roomInfo.gameMgr = gameMgr;

		var beginScore = getOriginScore(roomInfo);//无用

		for (var i = 0; i < ret.conf.numPeople; ++i) {
			roomInfo.seats.push({
				userId: 0,
				score: 100,
				gangScore: 0,
				name: "",
				ready: false,
				renewed: false,
				seatIndex: i,
				numZiMo: 0,
				numAnGang: 0,
				numMingGang: 0,
				numDiangang: 0,
				numJiegang: 0,
				scoreOfRounds: [],
				gangScoreOfRounds: []
			});
		}

		//写入数据库
		var conf = roomInfo.conf;
		var uuid = db.create_room(gametype, gamemode, serverid, roomInfo.id, roomInfo.conf, createTime);
		if (uuid == null) {
			ret.errcode = 3;
			return ret;
		}

		//俱乐部是圈主代开房间，玩家AA支付
		if (conf.for_others && conf.aa && roomInfo.conf.club_id) {
			console.log('俱乐部代开房间且AA支付,圈主不需要扣房费');
		}

		//设置房间状态
		setRoomState(roomId, consts.RoomState.NOT_START);

		roomInfo.uuid = uuid;
		console.log(uuid);
		rooms[roomId] = roomInfo;
		totalRooms++;
		ret.roomId = roomId;
		//超过指定时间 不做任何操作就删除 房间
		exports.dissolveRequestdf(roomId);

		//如果是替他人开房，则需要记录账单
		if (conf.for_others) {
			// db.insert_bill(uuid, roomId, conf, creator);//?数据库中无此方法
		}

		return ret;
	}
	// console.log('no roomid can use');
	// return null;
};

exports.destroy = function (roomId) {
	fibers(function () {
		var roomInfo = exports.getRoom(roomId);
		if (roomInfo == null) {
			return;
		}

		for (var i = 0; i < roomInfo.seats.length; ++i) {
			var userId = roomInfo.seats[i].userId;
			if (userId > 0) {
				var location = userLocation[userId];
				if (location != null) {
					if (location.roomId == roomId) {
						delete userLocation[userId];
						//作用避免该玩家 内存里存储有多个信息, 导致清空玩家房间id 进不去原来的房间,产生一个玩家可以进入多个房间的BUG
						var temp = db.get_user_roomid(userId);
						console.log('===删除房间===', temp.roomid + ' [=id=] ' + roomId);
						if (temp && temp.roomid == roomId && temp.gametype == '0020001') {
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
		if (roomInfo.conf.aa && roomInfo.conf.for_others && roomInfo.conf.club_id) {
			//console.log('俱乐部所开房间不需要从数据库清除,由圈主解散！同时还原此房间的数据');
			updateDBSeatsClub(roomId);
			db.update_num_of_turns(roomInfo.gametype, roomInfo.gamemode, roomId, 0);
			db.update_next_button(roomInfo.gametype, roomInfo.gamemode, roomId, 0);
			db.update_room_state(roomInfo.gametype, roomInfo.gamemode, roomId, consts.RoomState.NOT_START);
			return;
		}
		db.delete_room(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid);
	}).run();
}

exports.getTotalRooms = function () {
	return totalRooms;
}

exports.getRoom = function (roomId) {
	var room = rooms[roomId];
	if (!room) {
		fibers(function () {
			var dbdata = db.get_room_data(config.gametype, config.gamemode, roomId);
			if (!dbdata) {
				return null;
			}
			room = constructRoomFromDb(dbdata);
			//比赛场参数
			if (room.conf.matchData) {
				room.conf.matchData.title = crypto.fromBase64(room.conf.matchData.title);
				for (var i = 0; i < room.conf.matchData.seatArr.length; i++) {
					room.conf.matchData.seatArr[i].name = crypto.fromBase64(room.conf.matchData.seatArr[i].name);
				}
			}
		}).run();
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

	try {
		//查询 有没有排行榜有没有玩家id 
		var rank = db.set_rank_userid(userId);
		if (!rank) {
			//没有玩家id 就插入玩家id
			db.init_rank_userid(userId, userName);
		}
	} catch (error) {
		console.error("[CHECKBUG]rank-->排行查询插入失败ID[" + userId + "]", error);
	}

	var room = exports.getRoom(roomId);
	if (room == null) {
		return GAME_ERRS.ROOM_IS_NOT_EXISTED;
	}

	//超过指定时间 不做任何操作就删除 房间
	exports.dissolveRequestdf(roomId);

	//IP Strict
	if (room.conf.ipstrict) {
		// console.log('room.seats', room.seats);
		console.log('room.userip', userip);
		for (var k in room.seats) {
			var sip = room.seats[k].ip;
			if (sip != null && sip == userip) {
				return GAME_ERRS.IP_STRICT;
			}
		}
	}

	if (exports.getUserRoom(userId) == roomId) {
		console.log('[DEBUG] - user[' + userId + '] is in room[' + roomId + '], state is:' + room.state);
		if (room.conf.club_id && room.numOfGames == 0) {//俱乐部房每个进房都扣
			var data = db.get_user_data_by_userid(userId);
			if (data.gems < room.conf.cost) {
				return GAME_ERRS.GEMS_NOT_ENOUGH;
			}
		} else {
			if (room.conf.aa && userId != room.conf.creator && room.numOfGames == 0) {
				var data = db.get_user_data_by_userid(userId);
				if (data.gems < room.conf.cost) {
					return GAME_ERRS.GEMS_NOT_ENOUGH;
				}
			}
		}
		//玩家已在房间中，且房间为续费房间，则做续费处理
		if (room.state == consts.RoomState.WAITING_RENEW) {
			console.log('[DEBUG] - room is waiting renew');
			//重置房间状态标记
			var resetRoomState = false;

			//续费房间数据
			var renewInfo = renewRooms[roomId];
			if (renewInfo != null && room.numOfGames == 0) {
				//是否是第一个进入续费房间的玩家
				var firstUser = (renewInfo.state == consts.RoomRenewState.UNACTIVE);
				console.log('[DEBUG] - get renew info:' + JSON.stringify(renewInfo) + ', user[' + userId + '] is the first player[' + firstUser + '], be the creator');
				//房卡检查
				// if (firstUser
				// 	|| room.conf.aa) {
				// 	console.log('[DEBUG] - check cost aa[' + room.conf.aa + '], firstPlayer[' + firstUser + ']');
				// 	var gems = db.get_gems_by_userid(userId);
				// 	if (gems < room.conf.cost) {
				// 		console.log('[DEBUG] - gems are not enough.');
				// 		return GAME_ERRS.GEMS_NOT_ENOUGH;
				// 	}
				// }

				//第一个进入房间的玩家成为续费房间房主
				if (firstUser) {
					//如果不是aa 第一个续费进入房间检查游戏币
					if (!room.conf.aa && room.numOfGames == 0) {
						var data = db.get_user_data_by_userid(userId);
						if (data.gems < room.conf.cost) {
							return GAME_ERRS.GEMS_NOT_ENOUGH;
						}
					}
					console.log('[DEBUG] - first in user, change creator, update db, change renew state');
					if (!room.conf.club_id) {
						room.conf.creator = userId;
						db.update_room_creator(room.gametype, room.gamemode, roomId, room.conf.creator);
					} else {
						console.log('俱乐部房间续费时 不改变房主  房主永远是俱乐部创建者');
					}
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
	} else {
		//如果房间里没有这个玩家 局数大于0 出现bug 返回错误 游戏已开始
		if (room.numOfGames > 0) {
			return GAME_ERRS.GET_JUSHUDAYUZREO_RECORD;
		}
	}

	if (room.conf.club_id && room.numOfGames == 0) {//俱乐部房每个进房都扣
		var data = db.get_user_data_by_userid(userId);
		if (data.gems < room.conf.cost) {
			return GAME_ERRS.GEMS_NOT_ENOUGH;
		}
	} else {
		if (room.conf.aa && room.numOfGames == 0) {
			var data = db.get_user_data_by_userid(userId);
			if (data.gems < room.conf.cost) {
				return GAME_ERRS.GEMS_NOT_ENOUGH;
			}
		}
	}

	var empty = [];
	for (var i = 0; i < 4; ++i) {
		var seat = room.seats[i];
		//如果已经加这个房间,不能在加入这个房间
		if (userId == seat.userId) {
			return GAME_ERRS.ROOM_IS_FULL;
		}
		if (seat.userId <= 0) {
			empty.push(i);
		}
	}

	if (empty.length > 0) {
		var randomIndex = 0;
		if (empty.length < 4) {
			randomIndex = empty[Math.floor(Math.random() * empty.length)];
		}
		var seat = room.seats[randomIndex];
		seat.userId = userId;
		seat.name = userName;
		seat.ip = userip;
		userLocation[userId] = {
			roomId: roomId,
			seatIndex: randomIndex
		};
		exports.computeOnlineCnt(room);
		if (room != null) {
			let numOfPlayers = 0;
			for (let i = 0; i < room.seats.length; ++i) {
				if (room.seats[i].userId > 0) {
					numOfPlayers++;
				}
			}
			if (room.conf.for_others && room.conf.club_id) {//玩家退出房间同步数据到俱乐部

				var result = {
					club_id: room.conf.club_id,
					roomid: roomId,
					numOfPlayers: numOfPlayers,
					maxChair: room.conf.numPeople
				}
				exports.sendMsgToClub(room.conf.club_id, result, 'RoomInfoChange', '房间人数');
			}
		}

		exports.computeOnlineCnt(room);
		updateDBSeatsInfo(roomId);
		console.log('==========通知进入房间=========[userid]',userId);
		//比赛场不管玩家是否进入房间上线,直接开始游戏
		if(room.conf.bsc){
			room.gameMgr.setReady(userId);
		}
		//正常
		return RET_OK;
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
	s.ready = value;

	if (s.ready == false) {
		return;
	}
	
	fibers(function () {
		//更新准备信息到数据库
		var seatsInfo = getSeatsInfo(room);
		db.update_seats_info(room.gametype, room.gamemode, roomId, seatsInfo);
	}).run();
	//更新指定时间 不做任何操作就删除 房间
	exports.dissolveRequestdf(roomId);
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

exports.exitRoom = function (userId, roomId) {
	var location = userLocation[userId];
	var seatIndex = null;
	var room = null;
	if (!roomId) {
		roomId = location.roomId;
		room = exports.getRoom(roomId);
		console.error("[ROOMBUG] ---> exitroom --roomid is null [userid]:" + userId);
	} else {
		room = exports.getRoom(roomId);
	}

	if (location != null) {
		if (roomId != location.roomId) {
			console.error("[ROOMBUG] ---> exitroom --roomId != roomId [roomId]: " + roomId + "  [location.roomId]: " + location.roomId);
			return;
		}
		seatIndex = location.seatIndex;
	} else if (room != null) {
		var boolUserid = true;
		for (var i = 0; i < room.seats.length; ++i) {
			if (room.seats[i].userId == userId) {
				seatIndex = room.seats[i].seatIndex;
				boolUserid = false;
				break;
			}
		}
		if (boolUserid) {
			console.error("[ROOMBUG] ---> exitroom --room is not [userid]:" + userId);
			return;
		}

		//如果局数>0 就出现bug 返回
		if (room.numOfGames > 0) {
			console.error("[ROOMBUG] ---> exitroom --numOfGames > 0 is null [userid]:" + userId);
			return;
		}
	} else {
		console.error("[ROOMBUG] ---> exitroom --location And rooms is null [userid]:" + userId);
	}

	if (location != null || room != null) {
		console.log('location', location);
		if (room != null && seatIndex != null) {
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
				if (renewInfo == null) {
					console.log('[DEBUG] - room[' + roomId + '] renewInfo == null, but user[' + userId + '] exit, set to not start');
					setRoomState(roomId, consts.RoomState.NOT_START);
					//通知其它玩家，有人退出了房间
					userMgr.broacastInRoom('exit_notify_push', userId, room, userId, false);
				} else if (renewInfo.state == consts.RoomRenewState.ACTIVE) {
					console.log('[DEBUG] - room[' + roomId + '] is renewing or cant find renew info, but user[' + userId + '] exit, set to not start');
					setRoomState(roomId, consts.RoomState.NOT_START);
					//如果房间已续费，则广播玩家退出消息
					if (renewInfo != null) {
						console.log('[DEBUG] - the room[' + roomId + '] is renewing, push user[' + userId + '] exit message');
						//通知其它玩家，有人退出了房间
						userMgr.broacastInRoom('exit_notify_push', userId, room, userId, false);
					}
				}
			} else {
				if (userId != null) {
					//通知其它玩家，有人退出了房间
					userMgr.broacastInRoom('exit_notify_push', userId, room, userId, false);
				}
			}
		} else {
			console.log('[Error] get room or seat index error');
		}
	} else {
		console.log('[Error] get user [' + userId + '] location error')
	}


	//清空房间数据
	if (location != null) {
		if (location.roomId == roomId) {
			delete userLocation[userId];
			//作用避免该玩家 内存里存储有多个信息, 导致清空玩家房间id 进不去原来的房间,产生一个玩家可以进入多个房间的BUG
			var temp = db.get_user_roomid(userId);
			if (temp && temp.roomid == roomId && temp.gametype == '0020001') {
				//清空数据库中玩家自己的房间id
				db.set_room_id_of_user(userId, null, null, null);
			} else {
				//console.error('[ROOMBUG]--mysql information player != Memory --[userid]:' + userId + '[roomid]:' + roomId + '[sql]:', temp);
			}
		}
	}

	if (room != null) {
		var numOfPlayers = 0;
		for (var i = 0; i < room.seats.length; ++i) {
			if (room.seats[i].userId > 0) {
				numOfPlayers++;
			}
		}
		exports.syncToClub(room, numOfPlayers, roomId);
	}

	exports.computeOnlineCnt(room);


	if (numOfPlayers == 0 && roomId) {
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
		maxChair: room.conf.numPeople
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

	if (room.numOfGames > 1 || (room.numOfGames == 1 && !forceEnd)) {
		console.log('[DEBUG] - archive room[' + roomId + '], numOfGames[' + room.numOfGames + ']');
		db.archive_room(room.gametype, room.gamemode, room.uuid, room.canRenew);//room.canRenew
	}

	var s0 = room.seats[0];
	userMgr.broacastInRoom('room_close_push', null, room, s0.userId, true);

	// sleep(1500);
	userMgr.kickAllInRoom(room);

	//如果可续局
	if (true) {//(room.canRenew) { //续局取消
		fibers(function () {
			//续局状态 2 表示可续局 0表示未开始
			var state = 2;
			//如果是俱乐部 续局时 清空该房间的玩家所有信息
			if (room.conf.for_others && room.conf.club_id) {
				state = 0;
				console.log('[CHECK] - julebu -room:[' + roomId + ']');
				for (var i = 0; i < room.seats.length; ++i) {
					var userId = room.seats[i].userId;
					var seat = room.seats[i];
					if (userId > 0) {
						//清空房间数据
						var location = userLocation[userId];
						if (location != null) {
							if (location.roomId == roomId) {
								delete userLocation[userId];
								//作用避免该玩家 内存里存储有多个信息, 导致清空玩家房间id 进不去原来的房间,产生一个玩家可以进入多个房间的BUG
								var temp = db.get_user_roomid(userId);
								if (temp.roomid == roomId && temp.gametype == '0020001') {
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
				exports.syncToClub(room,0,roomId);
				
				exports.destroy(roomId);
			} else {
				//游戏结束 重置游戏中的数据 等待续费
				for (var i = 0; i < room.seats.length; i++) {
					resetSeatGame(room.seats[i]);
				}
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
				if (room.conf.for_others && room.conf.club_id) {
					room.conf.for_others = false;
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
		}).run();
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

	if (roomInfo.gameMgr.hasBegan(roomId)) {
		return true;
	}

	if (roomInfo.numOfGames > 0) {
		return true;
	}

	return false;
};

exports.doDissolve = function (roomId, judge) {
	var roomInfo = exports.getRoom(roomId);
	if (roomInfo == null || roomInfo.dissolved) {
		return null;
	}

	roomInfo.dissolved = true;
	roomInfo.gameMgr.doDissolve(roomId, judge);
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
		states: [],
	};
	for (var i = 0; i < roomInfo.seats.length; ++i) {
		roomInfo.dr.states[i] = false;
	}
	roomInfo.dr.states[seatIndex] = true;

	dissolvingList.push(roomId);

	return roomInfo;
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

//申请解散房间--相关接口
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

exports.updateScores = function (roomId) {
	var room = exports.getRoom(roomId);
	if (room == null || room.seats == null) {
		return false;
	}
	var seatsInfo = getSeatsInfo(room);
	db.update_seats_info(room.gametype, room.gamemode, roomId, seatsInfo);
},

	exports.onRoomEnd = function (roomInfo, forceEnd) {

	},

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
//申请解散房间
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
				//exports.doDissolve(roomId, true);
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



exports.update = function () {
	//刷新协商解散房间
	updateDissolvingRooms();
	//超过指定时间就解散房间
	updateDissolvingRoomsdf();
	//投票超过指定时间 踢人或者不踢人
	updateVoteKick();
}

//取出所有属于自己的房间
exports.init = function (config) {
	console.error('---服务重启---')
	var roomList = db.get_room_list(config.GAME_TYPE, config.GAME_MODE, config.SERVER_ID);
	if (roomList) {
		for (var i = 0; i < roomList.length; ++i) {
			var roomData = roomList[i];
			var roomInfo = constructRoomFromDb(roomData);
			if (roomInfo.state != consts.RoomState.NOT_START && roomInfo.state != consts.RoomState.PLAYING) {
				console.log('remove no need room:' + roomInfo.id);
				console.log('remove no need room：state:' + roomInfo.state);
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

exports.computeOnlineCnt = function (roomInfo) {
	if (!roomInfo) {
		console.log('computeOnlineCnt==>roomInfo is null', roomInfo);
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
exports.kick_user = function (userIdList) {
	console.log("---踢人---", userIdList);
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
			if (room.gameMgr.hasBegan(roomId)) {
				return false;
			}
			//通知其它玩家，有人退出了房间
			userMgr.broacastInRoom('exit_notify_push', userId, room, userId, false);
			userMgr.broacastInRoom('Tiren_push', userId, room, userId, true);
			userMgr.kickOne(userId);
			exports.exitRoom(userId, roomId);
		}
		delete rooms[roomId];
		delete renewRooms[roomId];
		totalRooms--;
	}
	return true;
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
		if (!online) {
			if (doAllAgreeCnt > (kick.onlineCnt / 2)) {
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
			var gameStart = roomInfo.gameMgr.hasBegan(roomId);
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
		if (roomInfo.seats[i].userId > 0) {
			userId = roomInfo.seats[i].userId;
			break;
		}
	}

	if (!userId) {
		return;
	}

	if (roomInfo.kick == null) {
		userMgr.broacastInRoom('kickout_notice_push', null, roomInfo, userId, true);
		return null;
	}
	//console.log('---指定时间被踢玩家信息---', roomInfo.kick.target);

	let online = userMgr.isOnline(roomInfo.kick.target);
	let gameStart = roomInfo.gameMgr.hasBegan(roomId);
	if (!gameStart) {
		//通知其它玩家，有人退出了房间
		userMgr.broacastInRoom('exit_notify_push', roomInfo.kick.target, roomInfo, userId, false);
		userMgr.broacastInRoom('Tiren_push', roomInfo.kick.target, roomInfo, userId, true);
		userMgr.kickOne(roomInfo.kick.target);
		exports.exitRoom(roomInfo.kick.target, roomId);
		userMgr.broacastInRoom('kickout_notice_push', 'finsh', roomInfo, userId, true);
		roomInfo.kick = null;
		return;
	} else {
		roomInfo.kick = null;
	}
	userMgr.broacastInRoom('kickout_notice_push', null, roomInfo, userId, true);
};


//===============================比赛场start

//创建比赛场房间
exports.createMatchRoom = function (matchData, callback) {
	var gametype = '0020001'
	var gamemode = 'norm'
	var serverid = '001'
	
	var fnCreate = function () {
		fibers(function () {
			var roomId = generateRoomId();
			//如果房间ID已经被占用，则重试
			if (db.is_room_exist2(gametype, gamemode, roomId)) {
				fnCreate();
			}
			else {
				var createTime = Math.ceil(Date.now() / 1000);
				if (matchData.game_type.indexOf('mj') !== -1) {
					//if (matchData.game_type.substr(matchData.game_type.lastIndexOf('_')+1) == '1') {
					//瞎子麻将
					var conf = {
						numOfButton: 0,
						baseScore: 11,
						aa: false,
						club_id: 0,
						daojustrict: true,
						difen: 11,
						for_others: false,
						ipstrict: false,
						jushuxuanze: 1,
						model: 1,
						pinghu: 0,
						qingqidui: false,
						qingyise: true,
						qiqian: false,
						sangang: true,
						shiyifeng: true,
						tuoguan: true,
						type: "dht",
						wanfaxuanze: 1,
						zhuang: 0,
						numPeople: 4,
						creator: 2,
						bsc: true, //比赛场房间  
						maxGames: 2,//matchData.base_turns,//比赛局数
					}
					//else if (matchData.game_type.substr(lastIndexOf('_')+1) == '0') {
					if (false) {
						//亮子麻将
						conf.jushuxuanze = 0;
						conf.qingyise = false;
						conf.wanfaxuanze = 0;
					}

					//比赛场参数
					conf.matchData = {
						title: matchData.title,
						matchId: matchData.matchId,
						people_num: matchData.people_num,
						people_limit: matchData.people_limit,
						turns: matchData.turns,
						base_turns: matchData.base_turns,
						seatArr: matchData.seatArr
					}

					var roomInfo = {
						uuid: "",
						id: roomId,
						numOfGames: 0,
						createTime: createTime,
						nextButton: 0,
						bonusFactor: 0,
						seats: [],
						conf: conf,
						state: consts.RoomState.NOT_START,
						gameOver: [],
						canRenew: false,
						gametype: gametype,
						gamemode: gamemode,
					}
				}

				roomInfo.gameMgr = gameMap['gamemgr_' + conf.type + '.js']

				for (var i = 0; i < conf.numPeople; ++i) {
					roomInfo.seats.push({
						userId: 0,
						score: 100,
						gangScore: 0,
						name: "",
						ready: false,
						renewed: false,
						seatIndex: i,
						numZiMo: 0,
						numAnGang: 0,
						numMingGang: 0,
						numDiangang: 0,
						numJiegang: 0,
						scoreOfRounds: [],
						gangScoreOfRounds: [],
						matchData: {
							top: 0,
							match_score: 0,
							turns: 0
						}
					})
				}
				
				var confs = roomInfo.conf;
				if(confs.matchData){
					confs.matchData.title = crypto.toBase64(confs.matchData.title);
					confs.matchData.seatArr = JSON.parse(confs.matchData.seatArr);
					for(var i = 0;i<confs.matchData.seatArr.length;i++){
						confs.matchData.seatArr[i].name = crypto.toBase64(confs.matchData.seatArr[i].name);
					}
				}
				console.log('======比赛场创建房间成功=======');
				//写入数据库
				var uuid = db.create_room(gametype, gamemode, serverid, roomInfo.id, confs, createTime)
				if (uuid == null) {
					callback({ code: 3, roomId: null })
					return;
				}
				//设置房间状态
				//setRoomState(roomId, consts.RoomState.NOT_START)
				roomInfo.uuid = uuid
				console.log(uuid)
				rooms[roomId] = roomInfo
				totalRooms++
				//ret.roomId = roomId
				callback({ code: 0, roomId: roomId })
			}
		}).run();
	}

	fnCreate();
};

//同步游戏排名信息
exports.ranking_match_push = (userId, event, data) => {
	userMgr.sendMsg(userId, event, data)
}
var bscPORT = 8500 //跨域比赛场端口号
//更新比赛场用户分数
exports.update_match_user_score = (userId, score, matchId) => {
    if (userId == null || score ===null) {
        return
    }
    let matchData = {
        userId: userId,
        score: score,
        matchId: matchId
	}
	
	var url = 'http://' + 'localhost' + ':' + bscPORT;
	fibers(() => {
		console.log('比赛场:'+matchId+' 玩家['+userId+']本局分数：'+score)
		var httpres = http.getSync2(url + '/update_match_user_score', matchData);
	}).run();
}

//更新比赛场信息
exports.update_match_info = (matchId, roomId) => {
    if (matchId === null || roomId ===null) {
        return
    }
    let matchData = {
        matchId: matchId,
        roomId: roomId
	}

	//console.log('------8888888888------',config.HALL_FOR_GAME_IP + ' == ' +config.HALL_FOR_GAME_PORT);
	var url = 'http://' + 'localhost' + ':' + bscPORT;
	fibers(() => {
		var httpres = http.getSync2(url + '/update_match_info', matchData);
		console.log('跨域更新比赛服用户信息成功！')
	}).run();
}

//通知 单局比赛结束
exports.detail_match_push = (userId, callback) => {
    if (userId == null) {
        return
    }
    // http.get(config.HALL_FOR_GAME_IP, config.HALL_FOR_GAME_PORT, '/get_detail_match', {userId: userId}, (ret, data) => {
    //     if (ret) {
    //         callback(str.matchData)
    //     }
	// })
	var url = 'http://' + 'localhost' + ':' + bscPORT;
	fibers(() => {
		var matchData = http.getSync2(url + '/get_detail_match', {userId: userId});
		if(matchData.data.matchData){
			console.log('跨域获取本轮比赛数据成功！')
		}else{
			console.log('跨域获取本轮比赛数据失败！')
		}
		callback(matchData.data);
	}).run();
}


//获取用户比赛场分数
exports.get_match_room_info = (matchId, roomId, callback) => {
    if (matchId == null || roomId ===null) {
        return
    }

	let matchData = {
			matchId: matchId,
			roomId: roomId
		}
	var url = 'http://' + 'localhost' + ':' + bscPORT;
	fibers(() => {	
		var ret = http.getSync2(url + '/get_match_room_info', matchData);
		if(ret.data.match_room){
			console.log('跨域获取用户比赛场分数信息成功！')
		}else{
			console.log('跨域获取用户比赛场分数信息失败！',ret)
		}
		callback(ret.data);
	}).run();
}

//===============================比赛场end
