require('../externals/utils/sys');
var crypto = require('../externals/utils/crypto');
var express = require('express');
var bodyParser = require("body-parser");
var db = require('../externals/utils/dbsync');
var cp = require('crypto');
var http = require('../externals/utils/http');
var room_service = require("./room_service");
var fibers = require('fibers');
var gameconfig = require('./config').config;

var clubMgr = require('./sub_services/clubmgr');

var app = express();
app.use(bodyParser.urlencoded({ extended: false }));
var config = null;

// 苹果内购支付完成
var PAY_GEMS = [6, 12, 18, 25];
var PAY_IDS = ["yymj_fangka_level_1", "yymj_fangka_level_2", "yymj_fangka_level_3", "yymj_fangka_level_4"];
//--

//加密路由
var encryptRoutMgr = ((global.HTTP_AES_KEY != null) ? new http.HttpRoutMgr() : app);

function check_account(req, res) {
	var token = req.query.token;
	if (token == null) {
		return null;
	}

	var userdata = db.get_userdata_by_token(token);
	if (!userdata) {
		http.send(res, HALL_ERRS.TOKEN_TIMEOUT);
		return null;
	}

	return userdata;
}

//设置跨域访问
app.all('*', function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
	res.header("X-Powered-By", '3.2.1');
	res.header("Content-Type", "application/json;charset=utf-8");

	fibers(function () {
		next();
	}).run();
});

//加密路由统一的接口
if (global.HTTP_AES_KEY != null) {
	app.get('/sec', function (req, res) {
		var arr = req.originalUrl.split('?');
		if (arr.length >= 2) {
			var url = arr[1];
			url = crypto.AesDecrypt(url, global.HTTP_AES_KEY, 128);

			var urlobj = JSON.parse(url);
			var path = urlobj.path;
			req.query = urlobj.data;

			encryptRoutMgr.rout(req.method, path, req, res);
		}
	});
}

encryptRoutMgr.get('/login', function (req, res) {
	var account = req.query.account;
	var sign = req.query.sign;
	if (account == null || sign == null) {
		return;
	}

	var ip = req.ip;
	if (ip.indexOf("::ffff:") != -1) {
		ip = ip.substr(7);
	}

	var token = crypto.md5(account + sign + Date.now());
	var data = db.get_user_data(account);


	if (data == null) {
		http.send(res, RET_OK);
		console.error('[HALLBUG]-- login data is null --[account]:' + account + '[sign]:' + sign);
		return;
	}

	var date = new Date();
	var lastNight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	var timestamp = lastNight.getTime();
	var hasShared = data.last_share_time > timestamp;
	console.log("=====user-login:", timestamp);
	console.log("====user-userid:", data.userid);
	console.log("======user-name:", data.name);

	db.update_token_of_user(data.userid, token);

	var costConfs = db.get_cost_confs();

	var ret = {
		account: data.account,
		userid: data.userid,
		name: data.name,
		lv: data.lv,
		exp: data.exp,
		coins: data.coins,
		gems: data.gems,
		coupon: data.coupon,//礼券
		ip: ip,
		sex: data.sex,
		share: hasShared,
		shareconfig: gameconfig,
		token: token,
		costconfs: costConfs,
		agent: data.agent,
		pay_ids: PAY_IDS,//苹果支付ID
		invitor: data.invitor,//绑定邀请人ID
		smrz: data.smrz,//实名认证
		luckynum: data.luckynum,//抽奖次数
		gamedaynum: data.gamedaynum,//获取玩家今天游戏次数
		isagent: data.isagent ? true : false,//此玩家是代理可在俱乐部创建圈子
	};

	var gametype = data.gametype;
	var gamemode = data.gamemode;
	var roomId = data.roomid;

	//如果用户处于房间中，则需要对其房间进行检查。 如果房间还在，则通知用户进入
	if (gametype == null ||
		gamemode == null ||
		roomId == null ||
		roomId == '') {
		http.send(res, RET_OK, ret);
		return;
	}

	//检查房间是否存在于数据库中
	var roomState = 0;
	var roomData = db.get_room_data(gametype, gamemode, roomId);
	if (!roomData) {
		//如果房间不在了，表示信息不同步，清除掉用户记录
		gametype = null;
		gamemode = null;
		roomId = null;
		db.set_room_id_of_user(data.userid, null, null, null);
	} else {
		var isUserRenewed = room_service.isUserRenewed(roomId, data.userid, gametype, gamemode);
		if (isUserRenewed == 0) {
			roomState = roomData.state;
		}
	}
	ret.gametype = gametype;
	ret.gamemode = gamemode;
	ret.roomid = roomId;
	ret.room_state = roomState;
	http.send(res, RET_OK, ret);
});

encryptRoutMgr.get('/create_user', function (req, res) {
	var account = req.query.account;
	var sign = req.query.sign;
	if (account == null || sign == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}

	var name = req.query.name;

	var configs = db.get_configs();
	var coins = configs.first_coins;
	var gems = configs.first_gems;

	var exist = db.is_user_exist(account);
	if (exist) {
		http.send(res, ACC_ERRS.ACC_EXISTED);
		return;
	}

	var ret = db.create_user(account, name, coins, gems, 0, null);
	if (!ret) {
		http.send(res, HALL_ERRS.CREATE_USER_FAILED);
	}
	else {
		http.send(res, RET_OK);
	}
});

encryptRoutMgr.get('/create_private_room', function (req, res) {
	var userdata = check_account(req, res);
	if (!userdata) {
		return;
	}

	//封号状态等于 1就封号
	if (userdata.forbidden == 1) {
		console.log("-----账号被封-----", userdata.userid);
		http.send(res, { code: 90001, msg: '你的账号已被封' });
		return;
	}


	var conf = req.query.conf;
	//IP限制强制关闭
	if (conf) {
		conf.ipstrict = false;
	}
	var gameType = req.query.gametype;
	var gameMode = req.query.gamemode;
	var userip = req.ip;
	if (userip && userip.indexOf("::ffff:") != -1) {
		userip = userip.substr(7);
	}

	if (gameType == null || gameMode == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}

	var userId = userdata.userid;
	var name = userdata.name;

	var gpsstrict = req.query.gpsstrict;
	var usergps = req.query.gpsdata;

	console.log('user ip -> ' + userip);
	console.log('create room gps info -> ' + usergps);

	//如果自己开房且开了gps限制，但自身gps数据为空，则返回失败
	// if (!req.query.for_others && gpsstrict === true && !usergps) {
	// 	http.send(res, GAME_ERRS.GPS_STRICT);
	// 	return;
	// }
	//验证玩家状态
	var gametype = userdata.gametype;
	var gamemode = userdata.gamemode;
	var roomId = userdata.roomid;

	var roomExisted = gametype != null &&
		gamemode != null &&
		roomId != null &&
		db.is_room_exist(gametype, gamemode, roomId);
	console.log('create -room--bool:> ' + roomExisted);
	if (!roomExisted) {
		db.set_room_id_of_user(userId, null, null, null);
		//创建房间
		var result = room_service.createRoom(userdata.account, userId, conf, gameType, gameMode);
		console.log('result', result);
		var err = result.ret;

		gametype = result.gametype;
		gamemode = result.gamemode;
		roomId = result.roomid;
		if (err.code != 0 ||
			gametype == null ||
			gamemode == null ||
			roomId == null) {
			http.send(res, err);
			return;
		}
	}

	// result = room_service.enterRoom(userId, name, userip, roomId, gametype, gamemode);
	// err = result.ret;
	// var enterInfo = result.enterInfo;
	// if (err.code != 0) {
	// 	http.send(res, err);
	// 	return;
	// }

	// var sign = crypto.md5(retdata.roomid + retdata.token + retdata.time + config.ROOM_PRI_KEY);
	var retdata = {
		roomid: roomId,
		gametype: gametype,
		gamemode: gamemode,
	};
	console.log('create finsh -room:> ' + roomId);
	http.send(res, RET_OK, retdata);
});

encryptRoutMgr.get('/enter_private_room', function (req, res) {
	var data = req.query;
	var roomId = data.roomid;
	var gametype = data.gametype;
	var gamemode = data.gamemode;
	var userip = req.ip;
	if (userip.indexOf("::ffff:") != -1) {
		userip = userip.substr(7);
	}

	var usergps = req.query.gpsdata;
	console.log('enter room user ip -> ' + userip);

	if (roomId == null ||
		gametype == null ||
		gamemode == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}

	var userdata = check_account(req, res);
	if (!userdata) {
		return;
	}

	//封号状态等于 1就封号
	if (userdata.forbidden == 1) {
		console.log("-----账号被封-----", userdata.userid);
		http.send(res, { code: 90001, msg: '你的账号已被封' });
		return;
	}

	var userId = userdata.userid;
	var name = userdata.name;
	console.log('user ' + userId + ' name ' + name + ' enter room ' + roomId);
	//如果数据库中有全部的房间信息，则直接进入数据库中保存的房间
	if (userdata.gametype != null && userdata.gamemode != null && userdata.roomid != null) {
		gametype = userdata.gametype;
		gamemode = userdata.gamemode;
		roomId = userdata.roomid;
	}
	var testTime1 = Date.now();
	//进入房间
	var rets = room_service.enterRoom(userId, name, roomId, gametype, gamemode, userip, usergps);
	var testTime2 = Date.now() - testTime1;
	if (testTime2 > 5000) {
		console.error("---申请加入房间超过5秒----毫秒数:" + testTime2, "[房间号]:" + roomId + "[id]:" + userId);
	}
	var err = rets.ret;
	//如果出现错误等于null
	if (err == null) {
		http.send(res, { code: 99999, msg: "加入房间失败" });
		return;
	}
	var enterInfo = rets.enterInfo;
	if (err.code == 0) {
		var retdata = {
			roomid: roomId,
			ip: enterInfo.ip,
			port: enterInfo.port,
			token: enterInfo.token,
			time: Date.now()
		};
		retdata.sign = crypto.md5(roomId + retdata.token + retdata.time + config.ROOM_PRI_KEY);
		http.send(res, RET_OK, retdata);
	} else {
		http.send(res, err);
	}
});

encryptRoutMgr.get('/get_history_list', function (req, res) {
	var userdata = check_account(req, res);
	if (!userdata) {
		return;
	}
	var userId = userdata.userid;
	var gameType = req.query.game_type;
	var gameMode = req.query.game_mode;
	var dbdata = db.get_user_history(gameType, gameMode, userId);
	//查询自己的比赛 分数
	var mytotal = db.set_rank_userid(userId);
	//总分数
	var sore = 0;
	//自己的比赛分数
	var totalWin_score = 0;
	if (mytotal) {
		sore = mytotal.total_score;
		totalWin_score = mytotal.thisweek_score;
	}
	//查询自己的排行名次
	var myrank = db.get_my_rank(totalWin_score);
	var history = { list: [], namemap: null, myrank: myrank, totalWin_score: totalWin_score };
	var userIdList = [];
	if (dbdata) {
		for (var i = 0; i < dbdata.length; i++) {
			var data = dbdata[i];
			if (data == null) {
				continue;
			}

			var item = {};
			item.uuid = data.uuid;
			item.id = data.id;
			item.base_info = data.base_info;
			item.create_time = data.create_time;
			item.num_of_turns = data.num_of_turns;
			item.seats = [];

			var seats = [];
			try {
				seats = JSON.parse(data.seats_info);
			} catch (e) {
				console.log('JSON parse error');
			}

			for (var j = 0; j < seats.length; j++) {
				var seat = seats[j];
				if (seats == null) {
					continue;
				}
				userId = seat.user;
				if (userId == null || userId <= 0) {
					continue;
				}

				item.seats.push({ user_id: userId, score: seat.score, gangScore: seat.gangScore, name: seat.name });
				if (userIdList.indexOf(userId) == -1) {
					userIdList.push(userId);
				}
			}

			history.list.push(item);
		}
	}

	history.namemap = db.get_multi_names(userIdList);
	//console.log('[Debug] - history data - ' + JSON.stringify(history));
	http.send(res, RET_OK, { history: history });
});


encryptRoutMgr.get('/get_games_of_room', function (req, res) {
	var data = req.query;
	var uuid = data.uuid;
	var gametype = data.gametype;
	var gamemode = data.gamemode;

	if (uuid == null ||
		gametype == null ||
		gamemode == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}

	var userdata = check_account(req, res);
	if (!userdata) {
		return;
	}

	var data = db.get_games_of_room(gametype, gamemode, uuid);
	http.send(res, RET_OK, { data: data });
});

encryptRoutMgr.get('/get_detail_of_game', function (req, res) {
	var data = req.query;
	var uuid = data.uuid;
	var index = data.index;
	var gametype = data.gametype;
	var gamemode = data.gamemode;

	if (uuid == null || index == null ||
		gametype == null ||
		gamemode == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}

	var userdata = check_account(req, res);
	if (!userdata) {
		return;
	}
	var data = db.get_detail_of_game(gametype, gamemode, uuid, index);
	http.send(res, RET_OK, { data: data });
});

encryptRoutMgr.get('/get_user_status', function (req, res) {

	var userdata = check_account(req, res);
	if (!userdata) {
		return;
	}

	http.send(res, RET_OK, { gems: userdata.gems });
});

encryptRoutMgr.get('/get_message', function (req, res) {

	var userdata = check_account(req, res);
	if (!userdata) {
		return;
	}

	var type = req.query.type;

	if (type == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}

	var version = req.query.version;
	var data = db.get_message(type, version);

	if (data != null) {
		http.send(res, RET_OK, { msg: data.msg, version: data.version });
	}
	else {
		http.send(res, HALL_ERRS.GET_MESSAGE_FAILED);
	}
});

encryptRoutMgr.get('/is_server_online', function (req, res) {
	var userdata = check_account(req, res);
	if (!userdata) {
		return;
	}

	var ip = req.query.ip;
	if (ip.indexOf("::ffff:") != -1) {
		ip = ip.substr(7);
	}

	var port = req.query.port;
	var isonline = room_service.isServerOnline(ip, port);
	var ret = {
		isonline: isonline,
	};
	http.send(res, RET_OK, ret);
});

encryptRoutMgr.get('/get_user_cash', function (req, res) {
	var account = req.query.account;
	var sign = req.query.sign;
	if (account == null || sign == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}

	var data = db.get_user_data(account);
	if (!data) {
		http.send(res, ACC_ERRS.GET_ACC_INFO_FAILED);
		return;
	}

	var ret = {
		gems: data.gems,
		coins: data.coins,
	};
	http.send(res, RET_OK, ret);
});

//分享得房卡
encryptRoutMgr.get('/share', function (req, res) {
	console.log(req.query);
	if (!check_account(req, res)) {
		return;
	}

	var Old = db.get_user_data(req.query.account);
	if (!Old) {
		return;
	}
	var date = new Date();
	var lastNight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	var timestamp = lastNight.getTime();
	if (Old.last_share_time > timestamp) {
		return;
	}
	//分享房卡钻石为1
	var gems = 1;//Math.floor(Math.random()*3);
	var luckynum = 1;//分享获得 抽奖次数 +1
	var ret = db.add_share_gems(req.query.account, gems, luckynum, timestamp);

	if (ret) {
		var data = db.get_gems(req.query.account);
		http.send(res, RET_OK, { gems: gems });
	}
	else {
		http.send(res, 1, "add gems failed.");
	}

});

//查询今天是否已分享过
encryptRoutMgr.get('/has_shared_today', function (req, res) {
	console.log(req.query);
	if (!check_account(req, res)) {
		return;
	}

	var Old = db.get_user_data(req.query.account);
	var date = new Date();
	var lastNight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	var timestamp = lastNight.getTime();
	if (Old.last_share_time > timestamp) {
		http.send(res, RET_OK, { shared: true });
	}
	else {
		http.send(res, RET_OK, { shared: false });
	}

});

//申请礼券流水记录
encryptRoutMgr.get('/coupon_record', function (req, res) {
	var userdata = check_account(req, res);
	if (userdata == null) {
		return;
	}
	var userId = userdata.userid;
	//申请礼券记录
	var ret = db.coupon_record(userId);
	if (ret) {
		http.send(res, RET_OK, { couponjilu: ret });
	} else {
		http.send(res, { code: 101, msg: "礼券记录查询错误", couponjilu: [] });
	}
});

//申请礼券兑换商品流水记录
encryptRoutMgr.get('/commodity_record', function (req, res) {
	var userdata = check_account(req, res);
	if (userdata == null) {
		return;
	}
	var userId = userdata.userid;
	//申请商品记录
	var ret = db.commodity_record(userId);
	if (ret) {
		http.send(res, RET_OK, { commodity: ret });
	} else {
		http.send(res, { code: 101, msg: "商品记录查询错误", commodity: [] });
	}
});

//申请使用道具扣除礼卷　//使用一次道具８礼券
encryptRoutMgr.get('/cost_coupon', function (req, res) {
	var userdata = check_account(req, res);
	if (userdata == null) {
		return;
	}
	var userId = userdata.userid;
	//查询自己有多少礼券
	var ret = db.get_coupon(userId);
	if (ret) {
		if (ret.coupon < 8) {
			http.send(res, { code: 101, msg: "礼券不足" });
			return;
		}
	} else {
		http.send(res, { code: 102, msg: "数据库查询出错" });
		return;
	}

	//扣除礼券
	db.cost_user_coupon(userId, 8);
	http.send(res, RET_OK, { coupon: ret.coupon - 8 });
});


//申请礼券商品列表信息
encryptRoutMgr.get('/coupon_commodity_list', function (req, res) {
	var userdata = check_account(req, res);
	if (userdata == null) {
		return;
	}
	var userId = userdata.userid;
	//查询礼券商品列表
	var ret = db.coupon_commodity_list();
	console.log('=======申请礼券商品列表信息=========', ret);
	if (!ret) {
		http.send(res, { code: 102, msg: "数据库查询出错" });
		return;
	}

	http.send(res, RET_OK, { shoplist: ret });
});

//房卡兑换礼券 ----  礼券兑换商品
encryptRoutMgr.get('/exchange_coupon', function (req, res) {
	var userdata = check_account(req, res);
	if (userdata == null) {
		return;
	}
	var userId = userdata.userid;
	var account = userdata.account;
	var typeNum = req.query.num; //商品类型
	var Phone = req.query.iPhone; //手机号码

	if (isNaN(typeNum)) {
		http.send(res, { code: 101, msg: "商品类型只能传数字" });
		return;
	}
	var commodity = db.coupon_commodity_list();
	if (!commodity) {
		http.send(res, { code: 103, msg: "数据库查询出错" });
		return;
	}

	if (commodity[typeNum].num <= 0) {
		http.send(res, { code: 110, msg: "商品数量不足" });
		return;
	}
	//查询自己有多少游戏币
	var ret = db.get_gems(account);
	// let gems = [12, '50元京东券', '100元京东券', '200元京东券','苏泊尔智能电饭煲','狗年贺岁金钞2G',
	//     'vivoX9s玫瑰金64G','iPad平板电脑9.7英寸','iPhoneX64GB'];
	//类型传0-1 只走 礼券兑换房卡通道
	if (typeNum < 1) {
		if (ret) {
			//游戏币不足兑换失败
			if (ret.coupon < commodity[typeNum].coupon) {
				http.send(res, { code: 105, msg: "礼券不足兑换商品失败" });
				return;
			}
			//扣掉玩家礼券
			var temp = db.cost_user_coupon(userId, commodity[typeNum].coupon);
			if (temp) {
				//添加玩家房卡
				var player = db.add_user_gemstow(userId, commodity[typeNum].gems);
				if (!player) {
					console.error('添加房卡出现bug-----[userId]:' + userId + '[gems]:' + ret.gems);
				}
				//减少礼券产品数量
				db.updata_commoditylist_num(commodity[typeNum].type);
				//创建礼券单号
				var DK2 = 'BK' + Date.now() + Math.floor(Math.random() * 1000) + userId;
				db.create_pay_coupon(userId, DK2, commodity[typeNum].coupon, commodity[typeNum].gems, 2);
				http.send(res, RET_OK, { coupon: commodity[typeNum].coupon, gems: commodity[typeNum].gems, type: typeNum });
			}
		} else {
			http.send(res, { code: 103, msg: "查询数据出错啦" });
			return;
		}
	}
	//兑换商品类型1-9走这里通道
	else if (typeNum < 10) {
		if (ret) {
			if (ret.coupon < commodity[typeNum].coupon) {
				http.send(res, { code: 105, msg: "礼券不足兑换商品失败" });
				return;
			}
			var temp2 = db.cost_user_coupon(userId, commodity[typeNum].coupon);
			if (!temp2) {
				console.error('[commodityBUG]兑换商品出现bug-----[userId]:' + userId + '[coupon]:' + commodity[typeNum].coupon + '自己商品数量:' + ret.coupon);
				http.send(res, { code: 110, msg: "扣除出错啦" });
				return;
			}
			//减少礼券产品数量
			db.updata_commoditylist_num(commodity[typeNum].type);
			//1兑换中状态 2表示已兑换完成的商品
			var KK2 = 'KK' + Date.now() + Math.floor(Math.random() * 1000) + userId;
			db.create_pay_commodity(userId, KK2, commodity[typeNum].coupon, commodity[typeNum].name, Phone, 1);
			http.send(res, RET_OK, { coupon: commodity[typeNum].coupon, gems: commodity[typeNum].name, type: typeNum });
		} else {
			http.send(res, { code: 103, msg: "查询数据出错啦" });
			return;
		}
	} else {
		http.send(res, { code: 104, msg: "商品类型超出范围或者暂无商品" });
		return;
	}
});

//绑定邀请者得礼券
encryptRoutMgr.get('/bind_invitor', function (req, res) {
	var userdata = check_account(req, res);

	if (userdata == null) {
		return;
	}

	var userId = userdata.userid;
	//查询自己有没有绑定邀请人ID
	var tmep = db.query_bind_invitor(userId);
	if (tmep.invitor) {
		http.send(res, { code: 105, msg: "已绑定邀请人ID不能再绑定了哟" });
		return;
	}

	var invitorId = req.query.invitor;
	if (userdata.userid == invitorId) {
		http.send(res, { code: 106, msg: "不帮绑定自己" });
		return;
	}
	//查询有没有这个玩家
	var invitorData = db.get_user_data_by_userid(invitorId);
	if (invitorData == null) {
		http.send(res, { code: 108, msg: "没有邀请人请输入有效的邀请人" });
		return;
	}

	//绑定邀请人
	var bind = db.bind_invitor(userId, invitorId);
	if (!bind) {
		http.send(res, { code: 107, msg: "绑定失败" });
		return;
	}
	//送邀请人ID
	var coupon1 = 10;
	//送自己礼券
	var coupon2 = 2;
	//给邀请人添加礼券
	var player1 = db.add_user_coupon(invitorId, coupon1);
	var DK1 = 'BK' + Date.now() + Math.floor(Math.random() * 1000) + invitorId;
	//1.玩家id 2.创建礼券单号 3.礼券数量 4.房卡数量 5.1代表 活动状态 2代表 税换状态
	db.create_pay_coupon(invitorId, DK1, coupon1, null, 1);
	//给自己添加礼券
	var player2 = db.add_user_coupon(userId, coupon2);
	var DK2 = 'BK' + Date.now() + Math.floor(Math.random() * 1000) + userId;
	db.create_pay_coupon(userId, DK2, coupon2, null, 1);

	http.send(res, RET_OK, { coupon: coupon2, invitor: invitorId, player1: player1, player2: player2 });
});

//申请绑定你的玩家有多少数量和玩家信息
encryptRoutMgr.get('/query_bind_my', function (req, res) {
	var userdata = check_account(req, res);

	if (userdata == null) {
		return;
	}
	var userId = userdata.userid;
	//查询自己有多少玩家绑定你的id
	var tmep = db.query_bind_my(userId);
	if (!tmep) {
		tmep = [];
	}

	//邀请玩家数量达到10人 赠送该玩家礼券
	if (tmep.length >= 10) {
		var data = db.get_user_data_by_userid(userId);
		//如果礼券活动状态 == 0未 赠送,状态等于1 代表已兑换10人赠送礼券
		if (data && data.firstcoupon == 0) {
			var coupon1 = 600;
			//更新礼券活动状态
			db.coupon_activity_stat(userId, 1);
			//给玩家添加礼券
			db.add_user_coupon(userId, coupon1);
			var DK1 = 'BK' + Date.now() + Math.floor(Math.random() * 1000) + userId;
			//1.玩家id 2.创建礼券单号 3.礼券数量 4.房卡数量 5.1代表 活动状态 2代表 税换状态
			db.create_pay_coupon(userId, DK1, coupon1, null, 1);
		}
	}

	http.send(res, RET_OK, { invitors: tmep });
});

//绑定代理得房卡  ----这个接口没有绑定代理功能,实际功能是绑定玩家
encryptRoutMgr.get('/bind_agent', function (req, res) {
	var userdata = check_account(req, res);
	if (userdata == null) {
		return;
	}

	if (userdata.agent != null) {
		http.send(res, HALL_ERRS.HAS_BOUND_AGENT);
		return;
	}

	var agentId = req.query.agent;
	//TODO判定代理是否存在
	if (agentId == null || agentId == '') {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}

	var configs = db.get_configs();
	var bonusGems = 10;
	if (configs) {
		bonusGems = configs.bind_agent_gems != null ? configs.bind_agent_gems : 10;
	}

	var ret = db.bind_agent(userdata.account, agentId, bonusGems);
	if (!ret) {
		http.send(res, HALL_ERRS.BIND_AGENT_FAILED);
		return;
	}

	var gems = db.get_gems(userdata.account);
	http.send(res, RET_OK, { gems: gems.gems, agent: agentId });
});
//绑定礼包码 相当于 绑定代理
encryptRoutMgr.get('/bind_to_agent', function (req, res) {
	if (!check_account(req, res)) {
		return;
	}
	var bonusGems = 2;//绑定代理送2张房卡
	var account = req.query.account;
	var agent = req.query.agent;
	if (agent == null) {
		http.send(res, 1, "agent参数为空");
		return;
	}
	var bind_agent = function () {
		var ret = db.is_user_bind_to_agent(account);
		if (ret == 0) {
			var err = db.set_agent_of_user(account, agent)
			if (err === 0) {
				var tempdata = db.get_user_data(account);
				if (tempdata) {
					var addgame = db.add_user_gems(tempdata.userid, bonusGems);
					if (addgame) {
						http.send(res, RET_OK, { gems: tempdata.gems, deltagems: bonusGems, agent: agent });
					}
				}
			} else {
				http.send(res, { code: 3, msg: "绑定失败" });
			}
		}
		else if (ret == 2) {
			http.send(res, { code: 2, msg: "已有代理商" });
		}

	};
	//暂时注销，随便一个号码都可以申请绑定代理，因为还没有和代理系统　对接请求
	var SIGN_KEY = "^&*#$%()@333";
	var data = { agent: agent, sign: crypto.md5(agent + SIGN_KEY) };
	http.get(config.DAILI_HOST, config.DAILI_PORT, '/search_dealer_by_id', data, function (err, data) {
		if (err && data.code === 0) {
			console.log('代理有效', data);
			fibers(() => {
				bind_agent();
			}).run();
		} else {
			console.log('代理无效:', err, data);
			// http.send(res, 2, "代理账号无效");
			http.send(res, { code: 1, msg: "代理账号无效" });
		}
	});
});

/**
 * 通过roomid查询所有游戏房间信息,不依赖gametype，因为前端加入房间入口只有一个了
 * roomid为唯一标志，
 */
encryptRoutMgr.get('/query_room_info', function (req, res) {
	var userdata = check_account(req, res);
	if (!userdata) {
		console.log('[Error] check account failed.');
		return;
	}

	var roomId = req.query.room_id;
	var gameType = req.query.game_type;
	var gameMode = req.query.game_mode;

	if (roomId == null || gameType == null || gameMode == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		console.log('[Error] invalid parameters.');
		return;
	}

	var roomData = db.get_room_data2(gameType, gameMode, roomId);
	if (roomData == null) {
		console.log('[Error] can\'t get room data, type:' + gameType + ', mode:' + gameMode + ', id:' + roomId);
		http.send(res, GAME_ERRS.ROOM_IS_NOT_EXISTED);
		return;
	}

	var roomInfo = null;
	try {
		roomInfo = JSON.parse(roomData.base_info);
		if (roomInfo.club_id > 0) {
			var get_user_club = db.get_user_club(userdata.userid, roomInfo.club_id);
			get_user_club
				.then(data => {
					if (data && data.length > 0 && data[0].state >= 10) {
						console.log('玩家在此俱乐部，可以进入俱乐部包房。');
						http.send(res, RET_OK, roomInfo);
					} else {
						http.send(res, { code: 1, msg: "此房间为俱乐部豪华包房,请先加入俱乐部" });
						return;
					}
				})
				.catch(err => {
					console.error(err.stack);
					return http.send(res, { code: 1, msg: "此房间为俱乐部豪华包房,请先加入俱乐部" });
				})
		} else {
			http.send(res, RET_OK, roomInfo);
		}
	} catch (e) {
		console.log('JSON parse error -> ' + e + '\n\t|--->original json string -> ' + roomData.base_info);
		http.send(res, SYS_ERRS.GET_ROOM_INFO_FAILED);
		return;
	}
});

encryptRoutMgr.get('/exit_room', function (req, res) {
	var userdata = check_account(req, res);
	if (!userdata) {
		console.log('[Error] check account failed.');
		return;
	}

	var roomId = req.query.room_id;
	var gameType = req.query.game_type;
	var gameMode = req.query.game_mode;

	if (roomId == null
		|| gameType == null
		|| gameMode == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		console.log('[Error] invalid parameters.');
		return;
	}

	var ret = room_service.exitRoom(gameType, gameMode, roomId, userdata.userid);
	http.send(res, ret);
});


encryptRoutMgr.get('/get_shop_data', function (req, res) {
	if (!check_account(req, res)) {
		return;
	}
	var shopid = req.query.shopid;
	shopid = parseInt(shopid);
	if (!shopid) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}

	var data = db.get_shop_data(shopid);
	if (data != null) {
		http.send(res, RET_OK, { data: data });
	} else {
		http.send(res, HALL_ERRS.GET_MESSAGE_FAILED);
	}
});

encryptRoutMgr.get('/request_charge', function (req, res) {
	var accData = check_account(req, res)
	if (accData == null) {
		return;
	}

	var userId = accData.userid;
	var orderId = req.query.order_id;
	var cost = req.query.cost;
	var itemId = req.query.item_id;
	if (orderId == null || cost == null || itemId == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}

});

encryptRoutMgr.get('/get_gems', function (req, res) { //申请刷新游戏币
	var accData = check_account(req, res)
	if (accData == null) {
		return;
	}
	var account = req.query.account;
	var temp = db.get_gems(account);
	if (temp.gems >= 0) {
		http.send(res, RET_OK, { gems: temp.gems, coupon: temp.coupon, luckynum: temp.luckynum, gamedaynum: temp.gamedaynum });
	} else {
		http.send(res, HALL_ERRS.GET_GEMS_INFO_FAILED);
	}
});

// 苹果内购支付完成 ---接口
encryptRoutMgr.get('/apple_iap_finish', function (req, res) {
	var accData = check_account(req, res)
	if (accData == null) {
		return;
	}

	var temp = req.query;
	console.log("苹果支付接口1", temp);
	console.log("苹果支付接口2", temp.product);

	var num = 0;
	for (let i = 0; i < PAY_IDS.length; i++) {
		if (PAY_IDS[i] == temp.product) {
			num = i;
			break;
		}
	}
	console.log("苹果支付接口3", PAY_GEMS[num]);
	console.log("苹果支付接口4", temp.userid);

	var suc = db.add_user_gemstow(temp.userid, PAY_GEMS[num]);
	console.log("苹果支付接口5", suc);
	if (suc) {
		http.send(res, RET_OK, { gems: PAY_GEMS[num] });
	} else {
		http.send(res, HALL_ERRS.PAY_ADD_GEMS);
	}
});
// 苹果支付 接口 - ---end

//--第三方网页支付充值----------------
//多宝通
// encryptRoutMgr.get('/get_pay_url', function (req, res) {
// 	var userdata = check_account(req, res);
// 	if (!userdata) {
// 		return;
// 	}
// 	var account = req.query.account;

// 	var callbackurl = config.PAY_CALL_BACK_URL;
// 	var hrefbackurl = config.PAY_HREF_BACK_URL;
// 	var SHOPID = config.SHOPID;
// 	var SH_KEY = config.SH_KEY;
// 	//获取购买数据信息
// 	var itemId = req.query.item_id;
// 	var payType = req.query.pay_type;
// 	if (itemId == null || payType == null) {
// 		http.send(res, SYS_ERRS.INVALID_PARAMETER);
// 		console.log("请求充值失败a", SYS_ERRS.INVALID_PARAMETER);
// 		return;
// 	}

// 	var itemData = db.get_item_data(itemId);
// 	if (itemData == null) {
// 		http.send(res, GAME_ERRS.GET_ITEM_DATA_FAILED);
// 		console.log("请求充值失败b", GAME_ERRS.GET_ITEM_DATA_FAILED);
// 		return;
// 	}

// 	//此路径必须是RMB购买方式
// 	if (itemData.price_type != 3) {
// 		http.send(res, GAME_ERRS.INCORRECT_ITEM_PRICE_TYPE);
// 		console.log("请求充值失败c",GAME_ERRS.INCORRECT_ITEM_PRICE_TYPE);
// 		return;
// 	}

// 	//判断支付类型
// 	if (payType != 'wechat' && payType != 'alipay') {
// 		http.send(res, 1004, "支付类型错误:failed");
// 		console.log("请求充值失败d",1004);
// 		return;
// 	}
// 	var type = 0;
// 	if (payType == 'wechat') {
// 		type = 41;
// 		var url = 'http://www.dbt100.com//gateway/weixin/wap-weixinpay.asp';
// 	} else if (payType == 'alipay') {
// 		type = 44;
// 		var url = 'http://www.zhifuka.net/gateway/alipay/wap-alipay.asp';

// 	} else {
// 		console.log("请求充值失败g",1005);
// 		return;
// 	}
// 	var data = {
// 		customerid: SHOPID,
// 		cardno: type,
// 		orderAmount: Number(itemData.price)*100,
// 		//orderAmount: 1,

// 		sdcustomno: 'BK' + Date.now() + Math.floor(Math.random() * 1000) + userdata.userid,
// 		noticeurl: callbackurl,
// 		backurl: hrefbackurl,
// 		sign: 'ddd',
// 		mark: '1024',
// 		remarks: 'test',
// 	};
// 	// console.log(JSON.stringify(data));
// 	console.log(JSON.stringify(data));
// 	var signFields = ['customerid', 'sdcustomno', 'orderAmount', 'cardno', 'noticeurl', 'backurl'];
// 	var signStr = '';
// 	var sep = '';
// 	for (var i = 0; i < signFields.length; ++i) {
// 		var k = signFields[i];
// 		signStr += sep + k + '=' + data[k];
// 		sep = '&';
// 	}
// 	signStr += SH_KEY;
// 	console.log(signStr)
// 	data.sign = crypto.md5(signStr).toUpperCase();
// 	var urlStr = '';
// 	var sep = '';
// 	for (var k in data) {
// 		urlStr += sep + k + '=' + data[k];
// 		sep = '&';
// 	}
// 	var ret = url + '?' + urlStr;
// 	var price = '' + itemData.price + '元';

// 	if (db.create_pay_record(userdata.userid,
// 		userdata.agent_id,
// 		data.sdcustomno,
// 		itemData.price,
// 		itemData.item_id)) {
// 		console.log(ret);
// 		console.log("=请求充值网址成功==",itemData);
// 		console.log("=请求充值网址成功==2",price);
// 		http.send(res,
// 			RET_OK,
// 			{ url: ret, item: itemData.name, price: price, orderid: data.sdcustomno});
// 	} else {
// 		console.log("请求充值失败k",GAME_ERRS.CREATE_PAY_RECORD_FAILED);
// 		http.send(res, GAME_ERRS.CREATE_PAY_RECORD_FAILED);
// 	}
// });

// //多宝通
// encryptRoutMgr.get('/pay_back', function (req, res) {
// 	console.log("向支付平台汇报支付情况1", req.body);
// 	var opstate  = parseInt(req.query.state);
//     var customerid = req.query.customerid;
//     var sd51no = req.query.sd51no;
//     var sdcustomno  = req.query.sdcustomno ;
//     var ordermoney = req.query.ordermoney;
//     var mark = req.query.mark;
// 	var sign = req.query.sign;

// 	 //检查MD5

//     var str = "customerid="+customerid+"&sd51no="+sd51no+"&sdcustomno="+sdcustomno+"&mark="+mark+"&key="+config.SH_KEY;
//     var md5 = crypto.md5(str).toUpperCase();
//     if (md5 != sign) {
// 		console.log(md5)
// 		console.log(sign)
//         //向支付平台汇报错误情况
//         res.send('<result>0</result>')
//         return;
// 	}

// 	var changeStateOK = false;

// 	var payData = db.get_pay_data(sdcustomno);
// 	console.log("=================", payData);
// 	if (payData == null) {
// 		http.send(res, '<result>1</result>');
// 		return;
// 	}

// 	if (payData.state == 1) {
// 		var state = 2;
// 		if (opstate == 1) {
// 			state = 3;
// 		}
// 		changeStateOK = db.update_pay_state(payData.order_id, state);

// 		if (changeStateOK) {
// 			var itemData = db.get_item_data(payData.item_id);
// 			if (itemData) {
// 				if (itemData.gain_type == 1) {//coins
// 					db.add_user_coins(payData.user_id, itemData.gain, '+ bought by RMB');
// 				} else if (itemData.gain_type == 2) {//gems
// 					var gain = itemData.gain;
// 					var userdata = db.get_user_data_by_userid(payData.user_id);
// 					var try_count = 3;
// 					function notify_daili_server() { //向代理系统汇报充值
// 						function md5(msg) {
// 							return cp.createHash('md5').update(msg).digest('hex');
// 						}
// 						// 通知代理服务器
// 						var temp = {
// 							ord: payData.order_id, // 唯一订单号
// 							money: payData.cost, // 金额, 单位元
// 							user: payData.user_id, // t_users表中的主键 userid
// 							agent: userdata.agent, // t_users表中的agent
// 						};
// 						var SIGN_KEY = "^&*#$%()@333";
// 						temp.sign = md5(temp.ord + temp.user + temp.money + temp.agent + SIGN_KEY);
// 						console.log('通知代理服务器前打印3', temp);
// 						http.get(config.DAILI_HOST, config.DAILI_PORT, '/player_pay_sure', temp, function (ok, temp) {
// 							if (ok) {
// 								console.log('通知代理服务器ok', temp);
// 							} else {
// 								console.log('通知代理服务器失败');
// 								if (--try_count > 0) notify_daili_server();
// 							}
// 						});
// 					}
// 					//代理不等于空才调用
// 					if (userdata.agent != null) {
// 						notify_daili_server();
// 						// if (gain == 11) { //如果绑定代理 房卡加送!
// 						//     gain += 1;
// 						// } else if (gain == 36) {
// 						//     gain += 6;
// 						// } else if (gain == 65) {
// 						//     gain += 10;
// 						// }
// 					}
// 					db.add_user_gems(payData.user_id, gain, '+ bought by RMB');
// 				}

// 			}
// 		}
// 	}
// 	//向支付平台汇报成功消息
// 	res.send('<result>1</result>');

// });

encryptRoutMgr.get('/get_pay_state', function (req, res) {
	var userdata = check_account(req, res);
	if (!userdata) {
		return;
	}

	var orderId = req.query.orderid;
	var payData = db.get_pay_data(orderId);
	if (payData == null) {
		http.send(res, GAME_ERRS.GET_PAY_RECORD_FAILED);
		return;
	}

	if (payData.state == 3) {
		console.log("===支付成功===1");
		//支付成功
		http.send(res, { code: 0, msg: 'ok' });
		return;
	} else if (payData.state == 2) {
		//支付失败
		http.send(res, { code: 1, msg: 'failed' });
		return;
	}
	http.send(res, { code: 1, msg: 'failed' });
});

//--网页调用支付---------------
encryptRoutMgr.get('/get_pay_url', function (req, res) {
	var userdata = check_account(req, res);
	if (!userdata) {
		return;
	}
	var account = req.query.account;

	var callbackurl = config.PAY_CALL_BACK_URL;
	console.log(callbackurl)
	var hrefbackurl = config.PAY_HREF_BACK_URL;
	var SHOPID = config.SHOPID;
	//var appKey = config.appKey;
	//console.log("-----充值appkey-----", appKey);
	var SH_KEY = config.SH_KEY;
	var ip = req.ip;
	try {
		if (!ip) {
			console.error("充值---ip---错误", ip);
		}
		ip = ip.replace('::ffff:', '');
		console.log("打印充值接口3", req.ip);
	} catch (error) {
		console.error("充值异常" + error);
	}

	//获取购买数据信息
	var itemId = req.query.item_id;
	var payType = req.query.pay_type;
	if (itemId == null || payType == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		console.log("请求充值失败a", SYS_ERRS.INVALID_PARAMETER);
		return;
	}

	var itemData = db.get_item_data(itemId);
	if (itemData == null) {
		http.send(res, GAME_ERRS.GET_ITEM_DATA_FAILED);
		console.log("请求充值失败b", GAME_ERRS.GET_ITEM_DATA_FAILED);
		return;
	}

	//此路径必须是RMB购买方式
	if (itemData.price_type != 3) {
		http.send(res, GAME_ERRS.INCORRECT_ITEM_PRICE_TYPE);
		console.log("请求充值失败c", GAME_ERRS.INCORRECT_ITEM_PRICE_TYPE);
		return;
	}

	//判断支付类型
	if (payType != 'wechat' && payType != 'alipay') {
		http.send(res, 1004, "支付类型错误:failed");
		console.log("请求充值失败d", 1004);
		return;
	}
	var type = 0;
	if (payType == 'wechat') {
		type = 1006;
	} else if (payType == 'alipay') {
		type = 1010;

	} else {
		console.log("请求充值失败g", 1005);
		return;
	}

	var url = 'http://pay.55555pay.com/chargebank.aspx';
	//var url = 'https://snpayapi.aijinfu.cn/pay/payment.do';

	//var data = {
	//	appKey: appKey,
	//	bussOrderNum: 'BK' + Date.now() + Math.floor(Math.random() * 1000) + userdata.userid,
	//	orderName: 'test',
	//	notifyUrl: callbackurl,
	//	returnUrl: hrefbackurl,
	//	ip: ip,
	//	payMoney: Number(itemData.price),
	//	appType: 1,
	//	payPlatform: type,
	//	sign: 'ddd',
	//};
	//
	//console.log(JSON.stringify(data));
	//var signFields = ['appKey', 'appType', 'bussOrderNum', 'ip', 'notifyUrl', 'orderName', 'payMoney', 'payPlatform', 'returnUrl'];
	//var signStr = '';
	//var sep = '&';
	//for (var i = 0; i < signFields.length; ++i) {
	//	var k = signFields[i];
	//	signStr += sep + k + '=' + data[k];
	//}
	//
	//signStr = 'keyValue=' + SH_KEY + signStr;
	//signStr = signStr.toString().toUpperCase()
	//data.sign = crypto.md5(signStr);//.toUpperCase();
	//console.log("签名", data.sign)
	//var urlStr = '';
	//var sep = '';
	//for (var k in data) {
	//	urlStr += sep + k + '=' + data[k];
	//	sep = '&';
	//}
	//
	//var ret = url + '?paramStr=' + escape(urlStr);
	//var price = '' + itemData.price + '元';
	var data = {
		parter: SHOPID,
		type: type,
		value: itemData.price,
		//value:0.01,
		orderid: 'BK' + Date.now() + Math.floor(Math.random() * 1000) + userdata.userid,
		callbackurl: callbackurl,
		hrefbackurl: hrefbackurl,
		payerIp: ip,
		attach: 'bk',
		sign: 'ddd',
		agent: '1024',
	};
	console.log(data);
	var signFields = ['parter', 'type', 'value', 'orderid', 'callbackurl'];
	var signStr = '';
	var sep = '';
	for (var i = 0; i < signFields.length; ++i) {
		var k = signFields[i];
		signStr += sep + k + '=' + data[k];
		sep = '&';
	}
	signStr += SH_KEY;
	console.log('signStr', signStr);
	data.sign = crypto.md5(signStr);
	console.log('签名', data.sign);
	var urlStr = '';
	var sep = '';
	for (var k in data) {
		urlStr += sep + k + '=' + data[k];
		sep = '&';
	};
	console.log(urlStr);
	var ret = url + '?' + urlStr;
	var price = '' + itemData.price + '元';
	console.log(price);

	if (db.create_pay_record(userdata.userid,
		userdata.agent,
		data.orderid,
		itemData.price,
		itemData.item_id)) {
		console.log(ret);
		console.log("=请求充值网址成功==", itemData);
		console.log("=请求充值网址成功==2", price);
		http.send(res,
			RET_OK,
			{ url: ret, item: itemData.name, price: price, orderid: data.orderid });
	} else {
		console.log("请求充值失败k", GAME_ERRS.CREATE_PAY_RECORD_FAILED);
		http.send(res, GAME_ERRS.CREATE_PAY_RECORD_FAILED);
	}
});

//app.post('/pay_back', function (req, res) {
//	console.log("向支付平台汇报支付情况1", req.body);
//
//	var orderid = req.body.buss_order_num;
//	var result_code = parseInt(req.body.result_code);
//	var changeStateOK = false;
//	var payData = db.get_pay_data(orderid);
//	console.log("=================", payData);
app.get('/pay_back', function (req, res) {
	console.log("向支付平台汇报支付情况", req.query);
	// var orderid = req.body.buss_order_num;
	// var  result_code = parseInt(req.body.result_code);
	var orderid = req.query.orderid;
	var opstate = parseInt(req.query.opstate);
	var ovalue = req.query.ovalue;
	var sysorderid = req.query.sysorderid;
	var completiontime = req.query.completiontime;
	var attach = req.query.atach;
	var sign = req.query.sign;
	var payData = db.get_pay_data(orderid);
	console.log("支付数据", payData);
	//检查MD5
	var str = 'orderid=' + orderid + '&opstate=' + opstate + '&ovalue=' + ovalue + config.SH_KEY;
	var md5 = crypto.md5(str);
	if (md5 != sign) {
		//向支付平台汇报错误情况
		http.send(res, {}, { opstate: -1 }, true);
		return;
	}

	if (payData == null) {
		http.send(res, '<result>1</result>');
		return;
	}

	if (payData.state == 1) {
		var state = 2;
		//if (result_code == 200) {
		//	state = 3;
		//}
		if (opstate == 0) {
			state = 3;
		}
		changeStateOK = db.update_pay_state(payData.order_id, state);

		if (changeStateOK) {
			var itemData = db.get_item_data(payData.item_id);
			if (itemData) {
				if (itemData.gain_type == 1) {//coins
					db.add_user_coins(payData.user_id, itemData.gain, '+ bought by RMB');
				} else if (itemData.gain_type == 2) {//gems
					var gain = itemData.gain;
					var userdata = db.get_user_data_by_userid(payData.user_id);
					var try_count = 3;
					function notify_daili_server() { //向代理系统汇报充值
						function md5(msg) {
							return cp.createHash('md5').update(msg).digest('hex');
						}
						// 通知代理服务器
						var temp = {
							ord: payData.order_id, // 唯一订单号
							money: payData.cost, // 金额, 单位元
							user: payData.user_id, // t_users表中的主键 userid
							agent: userdata.agent, // t_users表中的agent
						};
						var SIGN_KEY = "^&*#$%()@333";
						temp.sign = md5(temp.ord + temp.user + temp.money + temp.agent + SIGN_KEY);
						console.log('通知代理服务器前打印3', temp);
						http.get(config.DAILI_HOST, config.DAILI_PORT, '/player_pay_sure', temp, function (ok, temp) {
							if (ok) {
								console.log('通知代理服务器ok', temp);
							} else {
								console.log('通知代理服务器失败');
								if (--try_count > 0) notify_daili_server();
							}
						});
					}
					//代理不等于空才调用
					if (userdata.agent != null) {
						notify_daili_server();
						// if (gain == 11) { //如果绑定代理 房卡加送!
						//     gain += 1;
						// } else if (gain == 36) {
						//     gain += 6;
						// } else if (gain == 65) {
						//     gain += 10;
						// }
					}
					db.add_user_gems(payData.user_id, gain, '+ bought by RMB');
				}

			}
		}
	}
	//向支付平台汇报成功消息
	res.send('SUCCESS');

});

encryptRoutMgr.get('/get_pay_record', function (req, res) { //请求流水记录
	if (!check_account(req, res)) {
		return;
	}
	var userid = req.query.userid;
	var data = db.get_pay_liushui(userid)
	if (data == null) {
		http.send(res, GAME_ERRS.GET_PAY_RECORD);
	} else {
		http.send(res, RET_OK, data);
	}
});
//---end---------------------

/**
 * 俱乐部
 */


/* ---------------------俱乐部 接口---------------start----------neng-----*/
//俱乐部id生成器
function generateClubId() {
	var Id = "";
	for (var i = 0; i < 6; ++i) {
		if (i > 0) {
			Id += Math.floor(Math.random() * 10);
		}
		else {
			Id += Math.floor(Math.random() * 9) + 1;
		}
	}
	return Id;
}
/**
 * 玩家请求进入当前俱乐部，并连接聊天系统
 */
encryptRoutMgr.get('/enter_private_club', function (req, res) {
	var data = req.query;
	var club_id = data.club_id;
	var userid = data.userid;

	if (club_id == null ||
		userid == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		return;
	}
	var userdata = db.get_user_base_info(userid);
	if (!userdata) {
		return;
	}
	var data = {
		club_id: club_id,
		userid: userid,
		name: userdata.name,
		headimg: userdata.headimg
	}
	//进入房间
	var enterInfo = clubMgr.enterClubRoom(data);
	if (enterInfo) {
		var retdata = {
			club_id: club_id,
			ip: enterInfo.ip,
			port: enterInfo.port,
			token: enterInfo.token,
			time: Date.now()
		};
		retdata.sign = crypto.md5(club_id + retdata.token + retdata.time + config.ROOM_PRI_KEY);
		http.send(res, RET_OK, retdata);
	} else {
		http.send(res, { code: 1, msg: 'enterclub faile' });
	}
});
//玩家退出俱乐部聊天，进入上一层
encryptRoutMgr.get('/exit_club', function (req, res) {
	var userdata = check_account(req, res);
	if (!userdata) {
		console.log('[Error] check account failed.');
		return;
	}

	var roomId = req.query.room_id;
	var gameType = req.query.game_type;
	var gameMode = req.query.game_mode;

	if (roomId == null
		|| gameType == null
		|| gameMode == null) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		console.log('[Error] invalid parameters.');
		return;
	}

	var ret = room_service.exitRoom(gameType, gameMode, roomId, userdata.userid);
	http.send(res, ret);
});
//创建俱乐部
encryptRoutMgr.get('/create_club', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }
	console.log('create_club:', req.query);
	var userid = req.query.userid;
	var club_name = crypto.toBase64(req.query.club_name);
	var description = req.query.description;
	var hotpush = req.query.hotpush;

	if (!userid || !club_name) {
		http.send(res, { code: -1, msg: "userid和club_name不能为空" });
		return;
	}
	function createClub() {
		fibers(() => {
			var create_time = Math.ceil(Date.now() / 1000);
			var limit = 10;   //限制创建房间失败次数,防止陷入死循环
			var club_id = generateClubId();
			var create_club = db.create_club(club_id, club_name, userid, create_time, description, hotpush);
			create_club
				.then(data => {
					http.send(res, RET_OK, { data })
				})
				.catch(err => {
					limit--;
					if (limit <= 0) {
						http.send(res, { code: 1, msg: "创建房间失败，服务器出错！" });
						return;
					}
					createClub();
					console.error(err.stack);
				})
		}).run();
	};
	var get_user_club = db.get_user_club(userid);
	get_user_club
		.then(ret => {
			if (ret) {
				for (let index = 0; index < ret.length; index++) {
					const element = ret[index];
					if (element.state == 999) {
						http.send(res, { code: 2, msg: '您已开通过一个俱乐部，无法再开通！' });
						return;
					}
				}
			}

			createClub();
		})
		.catch(err => {
			console.error(err.stack);
			return http.send(res, { code: 1, msg: "查看俱乐部出错" });
		})
})
//代理花费1000房卡增加一个包间位
encryptRoutMgr.get('/add_maxrooms', function (req, res) {
	var creator = req.query.creator;
	var club_id = req.query.club_id;
	if (!creator || !club_id) {
		http.send(res, { code: -1, msg: "支付失败！参数错误！" });
		return;
	}
	var userdata = db.get_user_data_by_userid(creator);
	if (userdata && userdata.gems < 1000) {
		http.send(res, { code: 2, msg: "支付失败！房卡不足！" });
		return;
	}
	var get_club_by_id = db.get_club_by_id(creator, club_id);
	get_club_by_id.then(clubdata => {
		fibers(() => {
			var cost = db.cost_gems(creator,
				1000,
				'add max club rooms by' + userdata.isagent);
			if (cost) {
				var add_maxrooms = db.add_maxrooms(club_id, creator);
				add_maxrooms
					.then(data => {
						return http.send(res, RET_OK, { maxrooms: (clubdata[0].maxrooms + 1) });
					})
					.catch(err => {
						console.error(err.stack);
						return http.send(res, { code: 1, msg: "支付失败！网络异常！" });
					})
			} else {
				http.send(res, { code: 3, msg: "支付失败！数据异常3！" });
			}
		}).run();
	}).catch(err => {
		console.error(err.stack);
		http.send(res, { code: 4, msg: "支付失败！数据异常4！" });
	})

})
//修改俱乐部名称
encryptRoutMgr.get('/update_club_creator', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }
	var userid = req.query.userid;
	var creator = req.query.creator;//crypto.toBase64();
	var club_id = req.query.club_id;
	if (!userid || !creator || !club_id) {
		http.send(res, { code: -1, msg: "userid和creator和club_id不能为空" });
		return;
	}
	var userdata = db.get_user_data_by_userid(creator);
	if (userdata == null || userdata.isagent == null || userdata.isagent == 0) {
		return http.send(res, { code: 5, msg: "转让圈主失败,此玩家不是代理，无法转出！" });
	}
	var check_club_member = db.check_club_member(club_id, creator);
	var update_club_creator = db.update_club_creator(club_id, creator);
	var ret999 = db.update_user_state(club_id, creator, 999)
	var ret10 = db.update_user_state(club_id, userid, 10);
	check_club_member.then(data => {
		if (data[0].state == 10) {
			update_club_creator.then(data => {
				return http.send(res, RET_OK, { data });
			}).catch(err => {
				console.error(err.stack);
				return http.send(res, { code: 1, msg: "转让圈主异常,请稍后再试！或联系管理员" });
			})
		} else if (data[0].state == 999) {
			return http.send(res, { code: 3, msg: "不能转让给自己" });
		} else {
			return http.send(res, { code: 4, msg: "转让圈主异常,请稍后再试！或联系管理员" });
		}
	}).catch(err => {
		console.error(err.stack);
		return http.send(res, { code: 2, msg: "此玩家不是俱乐部成员" });
	})



})
//修改俱乐部名称
encryptRoutMgr.get('/update_club_des', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }
	var userid = req.query.userid;
	var description = req.query.description;//crypto.toBase64();
	var club_id = req.query.club_id;
	if (!userid || !description || !club_id) {
		http.send(res, { code: -1, msg: "userid和description和club_id不能为空" });
		return;
	}

	var update_club_des = db.update_club_des(club_id, description);
	update_club_des
		.then(data => {
			return http.send(res, RET_OK, { data });
		})
		.catch(err => {
			console.error(err.stack);
			return http.send(res, { code: 1, msg: "更新俱乐部介绍出错" });
		})
})
//修改俱乐部名称
encryptRoutMgr.get('/update_club_name', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }
	var userid = req.query.userid;
	var club_name = crypto.toBase64(req.query.club_name);
	var club_id = req.query.club_id;
	if (!userid || !club_name || !club_id) {
		http.send(res, { code: -1, msg: "userid和club_name和club_id不能为空" });
		return;
	}

	var update_club_name = db.update_club_name(club_id, club_name);
	update_club_name
		.then(data => {
			return http.send(res, RET_OK, { data });
		})
		.catch(err => {
			console.error(err.stack);
			return http.send(res, { code: 1, msg: "更新俱乐部名称出错" });
		})
})
//修改俱乐部热门推荐
encryptRoutMgr.get('/update_club_hotpush', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }
	var userid = req.query.userid;
	var hotpush = req.query.hotpush;
	var club_id = req.query.club_id;
	if (!userid || hotpush == null || !club_id) {
		http.send(res, { code: -1, msg: "userid和hotpush和club_id不能为空" });
		return;
	}

	var update_club_hotpush = db.update_club_hotpush(club_id, hotpush);
	update_club_hotpush
		.then(data => {
			return http.send(res, RET_OK, { data });
		})
		.catch(err => {
			console.error(err.stack);
			return http.send(res, { code: 1, msg: "更新俱乐部热门推荐出错" });
		})
})
//查看玩家创建或加入的俱乐部
encryptRoutMgr.get('/get_user_club', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }
	var userid = req.query.userid;
	if (!userid) {
		http.send(res, { code: -1, msg: "userid不能为空" });
		return;
	}

	var get_user_club = db.get_user_club(userid);
	get_user_club
		.then(data => {
			return http.send(res, RET_OK, { data });
		})
		.catch(err => {
			console.error(err.stack);
			return http.send(res, { code: 1, msg: "查看俱乐部出错" });
		})

})
//查看玩家创建或加入的俱乐部
encryptRoutMgr.get('/get_hotpush_club', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }
	var hotpush = req.query.hotpush;

	var get_hotpush_club = db.get_hotpush_club(hotpush);
	get_hotpush_club
		.then(data => {
			return http.send(res, RET_OK, { data });
		})
		.catch(err => {
			console.error(err.stack);
			return http.send(res, { code: 1, msg: "查看俱乐部出错" });
		})

})

//获取玩家所在俱乐部的信息
encryptRoutMgr.get('/get_club_by_id', function (req, res) {

	var userid = req.query.userid;
	var club_id = req.query.club_id;
	if (!userid || !club_id) {
		http.send(res, { code: -1, msg: "userid和club_id不能为空" });
		return;
	}

	var get_club_by_id = db.get_club_by_id(userid, club_id);
	var get_club_users = db.get_club_users(club_id);
	var get_club_room_info = db.get_club_room_info(club_id);//获取当前俱乐部所开的房间信息
	get_club_by_id.then(data => {
		get_club_users.then(userdata => {
			if (!data) {
				http.send(res, { code: -1, msg: "data 为null" });
				console.error('[HALLBUG] get_club_by_id -- data is null [userid]:' + userid + '[club_id]:' + club_id);
				return;
			}
			data[0].members = userdata;
			get_club_room_info.then(roomdata => {
				roomdata.sort((a, b) => {
					return a.create_time - b.create_time;
				});
				data[0].rooms = roomdata;
				return http.send(res, RET_OK, { data });
			}).catch(err => {
				console.error(err);
				return http.send(res, { code: 3, msg: '查询俱乐部房间信息出错' });
			})
		}).catch(err => {
			console.error(err.stack);
			return http.send(res, { code: 2, msg: '查询俱乐部用户信息出错' });
		})
	}).catch(err => {
		console.error(err.stack);
		return http.send(res, { code: 1, msg: '查询俱乐部信息出错' });
	})

})

//获取玩家所在俱乐部所开房间信息
encryptRoutMgr.get('/get_club_rooms', function (req, res) {

	var userid = req.query.userid;
	var club_id = req.query.club_id;
	if (!userid || !club_id) {
		http.send(res, { code: -1, msg: "userid和club_id不能为空" });
		return;
	}
	var get_club_room_info = db.get_club_room_info(club_id);//获取当前俱乐部所开的房间信息
	get_club_room_info.then(data => {
		// console.log('get_club_room_info', data)
		return http.send(res, RET_OK, { data });
	}).catch(err => {
		console.error(err);
		return http.send(res, { code: 3, msg: '查询俱乐部房间信息出错' });
	})
})
//获取俱乐部当前游戏房间信息
encryptRoutMgr.get('/get_club_game_data', function (req, res) {

	var gametype = req.query.gametype;
	var club_id = req.query.club_id;
	var roomid = req.query.roomid;
	if (!gametype || !club_id || !roomid) {
		http.send(res, { code: -1, msg: "serverid和club_id和roomid不能为空" });
		return;
	}
	var get_club_game_data = db.get_club_room_info(club_id, gametype, roomid);
	get_club_game_data.then(data => {
		if (!data || !data[0]) {
			http.send(res, { code: -1, msg: "找不到房间" });
			console.error('[HALLBUG] get_club_game_data room Can.t find [roomid]:' + roomid);
			return;
		}
		var seatinfo = data[0].seats_info;
		if (typeof seatinfo == 'string') {
			seatinfo = JSON.parse(seatinfo);
		}
		fibers(() => {
			for (let index = 0; index < seatinfo.length; index++) {
				const element = seatinfo[index];
				if (element && element.user > 0) {
					var userdata = db.get_user_data_by_userid(element.user);
					if (userdata) {
						element.headimg = userdata.headimg;
						element.name = userdata.name;
					} else {
						element.headimg = null;
						element.name = null;
					}
				}
			}
			data[0].seats_info = seatinfo;
			return http.send(res, RET_OK, { data });
		}).run();
	}).catch(err => {
		console.error(err);
		return http.send(res, { code: 3, msg: '查询房间数据出错' });
	})

})
//获取俱乐部的信息
encryptRoutMgr.get('/get_club_msg', function (req, res) {
	var club_id = req.query.club_id;
	if (!club_id) {
		http.send(res, { code: -1, msg: "club_id不能为空" });
		return;
	}

	var get_club_msg = db.get_club_msg(club_id);
	get_club_msg.then(data => {
		if (data && data.length > 0) {
			return http.send(res, RET_OK, { data });
		} else {
			return http.send(res, { code: 2, msg: '此牌友圈还未建立！' });
		}
	}).catch(err => {
		console.error(err.stack);
		return http.send(res, { code: 1, msg: '查询俱乐部信息出错' });
	})

})
//申请加入俱乐部
encryptRoutMgr.get('/apply_join_club', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }
	var userid = req.query.userid;
	var club_id = req.query.club_id;

	if (!userid || !club_id) {
		http.send(res, { code: -1, msg: "userid和club_id不能为空" });
		return;
	}

	var get_user_club = db.get_user_club(userid, club_id, true);//查询用户在俱乐部可能的状态
	var apply_time = Math.ceil(Date.now() / 1000);
	get_user_club
		.then(data => {
			var applyState = false; //是否已经申请过

			if (data && data.length > 0) {
				if (data[0].state == -1) {
					console.log(`该玩家已被俱乐部屏蔽 {userid:${userid},club_id:${club_id}}`)
					return http.send(res, { code: 3, msg: '您已被俱乐部屏蔽' });
				}
				if (data[0].state == 10) {
					console.log(`该玩家已加入俱乐部 {userid:${userid},club_id:${club_id}}`)
					return http.send(res, { code: 4, msg: '您已加入俱乐部' });
				}
				if (data[0].state == 999) {
					console.log(`该玩家是群主 {userid:${userid},club_id:${club_id}}`)
					return http.send(res, { code: 5, msg: "您是群主！" });
				}
				if (data[0].state == 0) {
					console.log(`已经申请过加入俱乐部 {userid:${userid},club_id:${club_id}}`)
					applyState = true;
				}
			}
			fibers(() => {
				var apply_join_club = db.apply_join_club(userid, club_id, apply_time, applyState);
				apply_join_club
					.then(data => {
						return http.send(res, RET_OK, { data });
					})
					.catch(err => {
						console.error(err.stack);
						return http.send(res, { code: 1, msg: '申请加入俱乐部出错' });
					})
			}).run();

		})
		.catch(err => {
			console.error(err.stack);
			return http.send(res, { code: 2, msg: '查找俱乐部出错' });
		})

})

//获取申请加入俱乐部名单
encryptRoutMgr.get('/get_apply_club', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }
	var club_id = req.query.club_id;
	if (!club_id) {
		http.send(res, { code: -1, msg: 'club_id不能为空' });
		return;
	}
	var get_apply_club = db.get_apply_club(club_id);

	get_apply_club
		.then(data => {
			return http.send(res, RET_OK, { data });
		})
		.catch(err => {
			console.error(err.stack);
			return http.send(res, { code: 1, msg: '获取加入俱乐部申请名单出错' });
		})

})

//获取俱乐部玩家名单
encryptRoutMgr.get('/get_club_users', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }
	var club_id = req.query.club_id;
	if (!club_id) {
		http.send(res, { code: -1, msg: 'club_id不能为空' });
		return;
	}
	var get_club_users = db.get_club_users(club_id);

	get_club_users
		.then(data2 => {
			var data = new Array();
			data[0] = {
				members: data2
			};
			return http.send(res, RET_OK, { data });
		})
		.catch(err => {
			console.error(err.stack);
			return http.send(res, { code: 1, msg: '获取俱乐部玩家名单出错' });
		})

})


//处理俱乐部申请名单
encryptRoutMgr.get('/deal_club_apply', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }
	console.log(req.query);
	var userid = req.query.userid;
	var club_id = req.query.club_id;
	var id = req.query.id;
	var state = req.query.state;   //{-1：屏蔽（不可再次申请），0:申请加入，1：拒绝加入（可再次申请),10:接受加入，999:表示该玩家是群主}

	if (!userid || !club_id || !id || state == null) {
		return http.send(res, { code: -1, msg: '传入参数不足' });
	}

	if (state == -1 || state == 0 || state == 1 || state == 10) {
		var get_apply_club = db.get_apply_club(club_id, userid);
		var deal_club_apply = db.update_user_club_state(id, state);
		get_apply_club
			.then(data => {
				if (data && data.length > 0) {
					deal_club_apply
						.then(data => {
							return http.send(res, RET_OK, { data });
						})
						.catch(err => {
							console.error(err.stack);
							return http.send(res, { code: 2, msg: '获取加入俱乐部申请名单出错' });
						})
				} else {
					return http.send(res, { code: 1, msg: '玩家不在申请列表，无法处理！' });
				}
			})
			.catch(err => {
				console.error(err.stack);
				return http.send(res, { code: 1, msg: '玩家不在申请列表，无法处理！' });
			})
	} else {
		return http.send(res, { code: -2, msg: 'state传入超过范围' });
	}

})

//退出俱乐部
encryptRoutMgr.get('/quit_club', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }

	var club_id = req.query.club_id;
	var userid = req.query.userid;

	if (!club_id || !userid) {
		http.send(res, { code: -1, msg: 'club_id/userid不能为空' });
		return;
	}

	var delete_club_user = db.delete_club_user(club_id, userid);
	delete_club_user
		.then(data => {
			return http.send(res, RET_OK, { data });
		})
		.catch(err => {
			console.error(err.stack);
			return http.send(res, { code: 1, msg: '退出俱乐部出错' });
		})

})

//解散俱乐部
encryptRoutMgr.get('/dissolve_club', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }

	var userid = req.query.userid;
	var club_id = req.query.club_id;

	if (!userid || !club_id) {
		http.send(res, { code: -1, msg: 'club_id不能为空' });
		return;
	}

	var get_user_club = db.get_user_club(userid, club_id);
	var dissolve_club = db.dissolve_club(club_id);

	get_user_club
		.then(data => {
			if (data && data.length > 0) {
				if (data[0].state == 999) {
					dissolve_club
						.then(data => {
							return http.send(res, RET_OK, { data });
						})
						.catch(err => {
							console.error(err.stack);
							return http.send(res, { code: 4, msg: '解散俱乐部出错' });
						})
				} else {
					return http.send(res, { code: 3, msg: "您不是群主！" });
				}
			} else {
				return http.send(res, { code: 2, msg: '您不是该俱乐部成员' });
			}
		})
		.catch(err => {
			console.error(err.stack);
			return http.send(res, { code: 1, msg: '踢出俱乐部出错' });
		})

})

//踢出俱乐部玩家
encryptRoutMgr.get('/kick_club_user', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }
	var userid = req.query.userid;
	var club_id = req.query.club_id;

	if (!userid || !club_id) {
		http.send(res, { code: -1, msg: '传入参数不足' });
		return;
	}
	var get_user_club = db.get_user_club(userid, club_id);
	var delete_club_user = db.delete_club_user(club_id, userid);
	get_user_club.then(userclub => {
		if (userclub && userclub.length > 0) {
			if (userclub[0].state == 10) {
				delete_club_user
					.then(data => {
						return http.send(res, RET_OK, { data });
					})
					.catch(err => {
						console.error(err.stack);
						return http.send(res, { code: 1, msg: '踢出俱乐部玩家出错' });
					})
			} else if (userclub[0].state == 999) {
				return http.send(res, { code: 2, msg: "群主不能踢自己！" });
			} else {
				return http.send(res, { code: 3, msg: "此人还不是成员！" });
			}
		} else {
			return http.send(res, { code: 4, msg: '踢出俱乐部玩家出错' });
		}
	}).catch(err => {
		return http.send(res, { code: 5, msg: '踢出俱乐部玩家出错' });
	})
})

//查看俱乐部房间（废弃）
// encryptRoutMgr.get('/get_club_rooms', function (req, res) {
encryptRoutMgr.get('/get_club_rooms11', function (req, res) {
	// if (!check_account(req, res)) {
	// 	return;
	// }
	var club_id = req.query.club_id;
	if (!club_id) {
		http.send(res, { code: -1, msg: 'club_id不能为空' });
		return;
	}
	var get_club_rooms = db.get_club_rooms(club_id);
	var get_apply_club = db.get_apply_club(club_id);

	Promise.all([get_club_rooms, get_club_rooms])
		.then(data => {
			var apply = false;
			if (data[1] && data[1].length > 0) {
				apply = true;
			}

			return http.send(res, RET_OK, { data: data[0], apply: apply });
		})
		.catch(err => {
			console.error(err.stack);
			return http.send(res, { code: 1, msg: '查看俱乐部房间出错' });
		})

})
//解散俱乐部内创建的游戏房间
// encryptRoutMgr.get('/get_club_rooms', function (req, res) {
encryptRoutMgr.get('/dissolve_club_room', function (req, res) {
	var club_id = req.query.club_id;
	var roomid = req.query.roomid;
	var uuid = req.query.uuid;
	var gametype = req.query.gametype;
	var gamemode = req.query.gamemode;
	var type = req.query.type;
	if (!club_id || !roomid || !uuid || !gametype || !gamemode || !type) {
		http.send(res, SYS_ERRS.INVALID_PARAMETER);
		console.log('[Error] invalid parameters.');
		return;
	}
	var get_club_game_data = db.get_club_room_info(club_id, type, roomid);
	get_club_game_data.then(data => {
		if (data != null && data.length != 0) {
			var maxChair = 3;
			if (type == 'dht') {
				maxChair = JSON.parse(data[0].base_info).numPeople;
			} else if (type == 'thirteen') {
				maxChair = JSON.parse(data[0].base_info).maxChair;
			}
			// if (data[0].num == maxChair) {
			if (false) {
				return http.send(res, { code: 2, msg: '此房间正在游戏，无法删除！' });
			} else {
				fibers(() => {
					var httpres = null;
					if (data[0].num > 0) {
						var userIdList = [];
						for (let index = 0; index < data[0].seats_info.length; index++) {
							const element = data[0].seats_info[index];
							if (element && element.user > 0) {
								userIdList.push(element.user);
							}
						}
						// console.log('userIdList', userIdList);
						//var httpres = room_service.kick_user(gametype, gamemode, roomid, userIdList);
					}
					var deleteret = db.delete_room(gametype, gamemode, uuid);
					if (deleteret) {
						return http.send(res, RET_OK);
					} else {
						return http.send(res, { code: 3, msg: '删除房间失败！' });
					}
				}).run();
			}
		} else {
			return http.send(res, { code: 4, msg: '数据操作异常！' });
		}
	}).catch(err => {
		console.error(err.stack);
		return http.send(res, { code: 1, msg: '删除房间失败！' });
	})
})


/* ---------------------俱乐部 接口----------------end--------------*/

/*----------------------实名认证--------------------------------------*/
encryptRoutMgr.get('/get_smrz_info', function (req, res) {
	var userid = req.query.userid;
	if (!userid) {
		http.send(res, { code: -1, msg: '传入参数不足' });
		return;
	}
	var userdata = check_account(req, res);
	if (userdata && userdata.smrz) {
		http.send(res, RET_OK, userdata.smrz);
	} else {
		http.send(res, { code: 1, msg: '还未进行实名认证' });
	}
})
encryptRoutMgr.get('/update_smrz_info', function (req, res) {
	var userid = req.query.userid;
	var idcard = req.query.idcard;
	var tel = req.query.tel;
	var realname = req.query.realname;

	// var validate = req.query.validate;//是否已验证（如果要求不高的话，可以不用验证,验证要调用第三方数据，要收费）
	if (!userid || !idcard || !tel || !realname) {
		http.send(res, { code: -1, msg: '传入参数不足' });
		return;
	}
	var smrzdata = db.check_idcard(idcard);
	if (smrzdata) {
		console.log('idcard：' + idcard + ' 实名认证失败,此身份证号已经绑定!');
		http.send(res, { code: 2, msg: '实名认证失败,此身份证号已经绑定' });
		return;
	} else {
		console.log('idcard：' + idcard + ' 可用于实名认证绑定!');
	}
	var data = {
		idcard: idcard,//身份证
		tel: tel,//电话
		realname: realname,//真实姓名
		// validate: validate,//
	}
	var smrz = db.update_smrz_info(userid, JSON.stringify(data), idcard);
	if (smrz) {
		http.send(res, RET_OK, { smrz: data });
	} else {
		http.send(res, { code: 1, msg: '实名认证失败' });
	}
})
encryptRoutMgr.get('/get_user_info', function (req, res) {
	var userid = req.query.userid;
	if (!userid) {
		return http.send(res, { code: -1, msg: '传入参数不足' });
	}
	var userdata = db.get_user_data_by_userid(userid);
	if (userdata) {
		http.send(res, RET_OK, { userdata: userdata });
	} else {
		http.send(res, { code: 1, msg: '获取用户信息失败' });
	}
})
//加密 用于接受客户端请求
encryptRoutMgr.get('/send_msg_to_club', function (req, res) {
	var type = req.query.type;
	var sender = req.query.sender;
	var data = req.query.data;
	var club_id = req.query.club_id;
	var name = req.query.name;
	var roomId = req.query.roomId;
	if (!type || !sender || !data || !club_id || !name || !roomId) {
		console.log('游戏房间发送消息到俱乐部数据出错');
		return http.send(res, { code: -1, msg: 'data err.' });
	}
	var userdata = type == 'RoomInfoChange' ? { headimg: null } : db.get_user_base_info(sender);
	if (userdata) {
		var ret = clubMgr.sendRoomMsgtToClub(type, sender, data, name, club_id, userdata.headimg, roomId);
		if (ret) {
			console.log('游戏房间发送消息到俱乐部成功！');
			return http.send(res, RET_OK);
		} else {
			console.log('游戏房间发送消息到俱乐部失败，俱乐部没有运行！');
			return http.send(res, { code: 1, msg: 'club is not running .' });
		}
	} else {
		console.log('获取用户信息失败，无法发送消息到俱乐部聊天室！');
	}
})
//不加密 用于接受游戏端请求
app.get('/send_msg_to_club', function (req, res) {
	var type = req.query.type;
	var sender = req.query.sender;
	var data = req.query.data;
	var club_id = req.query.club_id;
	var name = req.query.name;
	var roomId = req.query.roomId;
	if (!type || !sender || !data || !club_id || !name || !roomId) {
		console.log('游戏房间发送消息到俱乐部数据出错');
		return http.send(res, { code: -1, msg: 'data err.' });
	}
	var userdata = type == 'RoomInfoChange' ? { headimg: null } : db.get_user_base_info(sender);
	if (userdata) {
		var ret = clubMgr.sendRoomMsgtToClub(type, sender, data, name, club_id, userdata.headimg, roomId);
		if (ret) {
			console.log('游戏房间发送消息到俱乐部成功！');
			return http.send(res, RET_OK);
		} else {
			console.log('游戏房间发送消息到俱乐部失败，俱乐部没有运行！');
			return http.send(res, { code: 1, msg: 'club is not running .' });
		}
	} else {
		console.log('获取用户信息失败，无法发送消息到俱乐部聊天室！');
	}
})

/*----------------------实名认证--------------------------------------*/

//=====================麻将排行榜接口=====================Start
//本周排行榜
encryptRoutMgr.get('/get_this_rank_list', function (req, res) {
	console.log(req.query);
	if (!check_account(req, res)) {
		return;
	}
	//本周排行榜
	var thisrank = db.get_this_week_rank_list();
	if (thisrank) {
		http.send(res, RET_OK, { thisrank: thisrank });
	} else {
		return http.send(res, { code: 1, msg: '查询排行榜 failed' });
	}
})
//上周排行榜
encryptRoutMgr.get('/get_last_rank_list', function (req, res) {
	console.log(req.query);
	if (!check_account(req, res)) {
		return;
	}
	//上周排行榜
	var lastrank = db.get_last_week_rank_list();
	if (lastrank) {
		http.send(res, RET_OK, { lastrank: lastrank });
	} else {
		return http.send(res, { code: 1, msg: '查询排行榜 failed' });
	}
})
//=====================麻将排行榜接口=====================end


//=====================比赛场接口=====================start
var bscPORT = 8500; //比赛场 跨域http 端口
//获取比赛场的列表   跨域
encryptRoutMgr.get('/get_match_list', function (req, res) {
	if (req.query.type === null || req.query.game_type === null) {
		return
	}
	//跨域 获取比赛场的列表
	http.get(config.HALL_FOR_GAME_IP, bscPORT, '/get_match_list', req.query, (ret, data) => {
		console.log('======获取比赛场的列表1======');
		if (ret && data && data.errcode == 0) {
			http.send(res, RET_OK, data);
		} else {
			http.send(res, { code: 3333, msg: '错误' });
		}
	})
});

//报名事件，判断是否已经报名进行操作   跨域
encryptRoutMgr.get('/get_baoming', function (req, res) {
	if (req.query.userId === null || req.query.matchId === null) {
		return
	}
	//跨域到比赛场进程 进行报名
	http.get(config.HALL_FOR_GAME_IP, bscPORT, '/get_baoming', req.query, (ret, data) => {
		console.log('======报名事件，判断是否已经报名进行操作======', data);
		if (ret && data && data.errcode == 0) {
			http.send(res, RET_OK, data);
		} else {
			http.send(res, { code: 3333, msg: data.errmsg });
		}
	})
});

//比赛场跨域请求加入房间  比赛场进程请求到这里
app.get('/get_bsc_enterRoom', function (req, res) {
	if (req.query.roomId === null) {
		return
	}
	console.log('======比赛场开始加入加入房间=======');
	let ret = room_service.enterRoom(req.query.i, req.query.user_name, req.query.roomId, req.query.gametype, req.query.gamemode, req.query.ip, req.query.gps);
	http.send(res, RET_OK, ret, true);
});

//这里返回比赛场详细信息 跨域
encryptRoutMgr.get('/get_match_details', function (req, res) {
	console.log('req', req.query)
	if (req.query.userId === null || req.query.matchId === null) {
		return
	}
	//从客户端请求到这 在跨域到比赛场进程请求 比赛详细信息
	http.get(config.HALL_FOR_GAME_IP, bscPORT, '/get_match_details', req.query, (ret, data) => {
		console.log('======这里返回比赛场详细信息======', data);
		http.send(res, RET_OK, data);
	})
});

//进入大厅后检查 是否报名 比赛场
encryptRoutMgr.get('/get_bisai_state', function (req, res) {
	if (req.query.userId === null) {
		return
	}

	//大厅跨域比赛场进程 检查是否报名
	http.get(config.HALL_FOR_GAME_IP, bscPORT, '/get_bisai_state', req.query, (ret, data) => {
		console.log('======大厅检查 是否报名 比赛场======ret', ret);
		console.log('======大厅检查 是否报名 比赛场======data', data);
		if (ret && data && data.errcode == 0) {
			if (parseInt(data.roomId) > 0) {
				http.send(res, RET_OK, { roomId: data.roomId });
			} else {
				http.send(res, RET_OK, data);
			}
			return;
		}
		http.send(res, { code: 3333, msg: "This user is not doing any match." });
	})
});

//以下比赛场接口不需要 跨域
//获取比赛场的ip端口
encryptRoutMgr.get('/get_match_ip_port', function (req, res) {
	if (config == null) {
		return
	}
	let data = {
		ip: config.HALL_FOR_MATCH_IP,
		port: config.MATCH_FOR_CLIENT_PORT
	}
	http.send(res, RET_OK, { data: data });
});


//中奖记录 直接查询数据库 不需要跨域到比赛进程
encryptRoutMgr.get('/get_reward_list', function (req, res) {
	if (req.query.userId === null) {
		return
	}
	let db_get_reward_list = db.get_reward_list(req.query.userId)
	db_get_reward_list.then(data => {
		if (data) {
			http.send(res, RET_OK, { data: data });
		} else {
			http.send(res, { code: 3333, msg: "没有中奖记录" });
		}
	})
		.catch(err => {
			console.log(err)
		})
});

//=====================比赛场接口=====================end


//20秒刷新一下作用到了凌晨00:00 更新数据库
var timebool = true;
function update() {
	var tDate = new Date();
	var tTxtTime = "";
	tTxtTime += ((tDate.getHours() < 10) ? "0" : "") + tDate.getHours();                                           //时
	tTxtTime += ":" + ((tDate.getMinutes() < 10) ? "0" : "") + tDate.getMinutes();
	if ((tTxtTime == '00:00' || tTxtTime == '00:01') && timebool) {
		console.log('=============clear 00:00============：' + tTxtTime);
		fibers(() => {
			//到指定时间清空玩家 开房对局次数
			db.clear_gemsdayNum();
			/**清空所有玩家抽奖次数次数 */
			db.clear_luckynum();
			timebool = false;
		}).run();
	}
	if (!timebool && tTxtTime > '00:02') {
		timebool = true;
	}
}
setInterval(update, 20000);


//每周六00:00  自动更新本周和上周排行榜
function updateRank() {
	var time = 7 * 1000 * 60 * 60 * 24;   //1天存储一次
	var currentDay = new Date().getDay();
	console.log('今天星期' + currentDay)
	var day = 6 - currentDay
	if (day == 0) {
		day = 7
	}
	var today = new Date();
	today.setHours(0);
	today.setMinutes(0);
	today.setSeconds(0);
	var nextTime = today.getTime() + day * 1000 * 60 * 60 * 24;
	console.log("下个星期六凌晨0点0时0分0秒的时间戳：" + day);
	var nowTime = new Date().getTime();
	var subTime = nextTime - nowTime;
	console.log("现在到下个星期六凌晨0点0时0分0秒的毫秒差：" + subTime)
	console.log("现在到下个星期六凌晨0点0时0分0秒的小时差：" + subTime / 1000 / 60 / 60)
	fibers(() => {
		sleep(subTime);
		var bb = true;
		while (bb) {
			var suc = db.update_lastweek_rank_scores();
			if (suc) {
				bb = false
				db.clear_thisweek_rank_scores();
				updateRank()
				console.log("rank--更新排行榜成功");
			}
			sleep(100);
		}
	}).run();
}
setTimeout(() => {
	updateRank();
}, 5000);

exports.start = function (conf) {
	config = conf;
	app.listen(config.HALL_FOR_CLIENT_PORT);
	console.log("client service is listening on port " + config.HALL_FOR_CLIENT_PORT);
	return { encryptRoutMgr: encryptRoutMgr, app: app };
};
