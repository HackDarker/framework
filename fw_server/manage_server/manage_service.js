var crypto = require('../externals/utils/crypto');
var express = require('express');
var db = require('../externals/utils/dbsync');
var http = require('../externals/utils/http');
var fibers = require('fibers');
var consts = require('../externals/utils/consts');
const CASH_CHANGE_RESONS = consts.CashChangeResons;

var app = express();
var config = null;

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

////////////////////////////////////////////////////Dealer API BEGIN
/**
 * 获取玩家数据
 */
app.get('/get_user_info', function(req, res) {
    var userId = parseInt(req.query.userid);
    userId = isNaN(userId) ? null : userId;
    var start = parseInt(req.query.start);
    start = isNaN(start) ? null : start;
    var rows = parseInt(req.query.rows);
    rows = isNaN(rows) ? null : rows;

    var ret =  {};
    if (userId != null) {
        ret = db.get_user_base_info(userId)
        if (ret == null) {
            http.send(res, ACC_ERRS.GET_ACC_INFO_FAILED, null, true);
            return;
        }
    }

    //获取所有游戏记录
    var histories = [];
    for (var typeIdx in config.GAME_TYPES) {
        var gameType = config.GAME_TYPES[typeIdx];
        if (gameType == null) {
            continue;
        }

        for (var modeIdx in config.GAME_MODES) {
            var gameMode = config.GAME_MODES[modeIdx];
            if (gameMode == null) {
                continue;
            }

            var items = [];
            var datas = db.get_user_history(gameType, gameMode, userId);
            if (datas == null) {
                continue;
            } else {
                for (var dataIdx in datas) {
                    var data = datas[dataIdx];
                    var item = { time: data.create_time,
                                 game_type: gameType, 
                                 room_id: data.id, 
                                 seats_info: JSON.parse(data.seats_info) };
                    
                    if (item.seats_info) {
                        for (var idx in item.seats_info) {
                            var seat = item.seats_info[idx];
                            if (seat == null) {
                                continue;
                            }

                            var data = db.get_user_base_info(seat.user);
                            seat.name = data ? data.name : '';
                        }
                    }

                    items.push(item);
                }
            }
            histories = histories.concat(items);
        }
    }

    histories.sort(function (a, b) {
        return a.create_time > b.create_time;
    })

    var cnt = histories.length;
    
    if (start != null && rows != null) {
        start = parseInt(start);
        start = start < 0 ? 0 : start;
        rows = parseInt(rows);
        histories = histories.slice(start, start + rows);
    }

    ret.histories = { cnt: cnt, list: histories };
    http.send(res, RET_OK, ret, true);
});

/**
 * 查询代理直属玩家列表
 */
app.get('/get_userlist_by_bind_agents', function(req, res) {
    var agents = req.query.agents;
    var start = parseInt(req.query.start);
    start = isNaN(start) ? null : start;
    var rows = req.query.rows;
    rows = isNaN(rows) ? null : rows;
    var startTime = req.query.start_time;
    var endTime = req.query.end_time;

    if (agents == null) {
        http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
        return;
    }

    agents = JSON.parse(agents);

    if (startTime == null || startTime == '' || endTime == null || endTime == '') {
        startTime = null;
        endTime = null;
    }

    var ret = {};
    var users = db.get_users_by_agent(agents, start, rows);
    if (users != null) {
        for (var userIdx in users) {
            var user = users[userIdx];
            if (ret[user.agent] == null) {
                ret[user.agent] = {};
            }
            var list = ret[user.agent];
            list[user.userid] = { total_pay: 0 };
        }
    }

    var pays = db.get_user_pays_by_agents(agents, startTime, endTime);
    if (pays != null) {
        for (var payIdx in pays) {
            var pay = pays[payIdx];
            if (pay.user_id == null || pay.total_pay == null) {
                continue;
            }
            
            var data = ret[pay.agent];
            if (data) {
                data[pay.user_id] = { total_pay: pay.total_pay };
            } else {
                var list = {};
                list[pay.user_id] = { total_pay: pay.total_pay };
                ret[pay.agent] = list;
            }
        }
    }

    for (var userIdx in agents) {
        var agentId = agents[userIdx];
        var num = db.get_users_num_by_agent(agentId);
        var item = ret[agentId];
        if (item) {
            item.all = num;
        }
    }
    http.send(res, RET_OK, ret, true);
});

/**
 * 给玩家充值
 */
app.get('/add_user_gems', function (req, res) {
    var userId = parseInt(req.query.userid);
    userId = isNaN(userId) ? null : userId;
    if (userId == null) {
        http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
        return;
    }

    var gems = req.query.gems;
    var suc = db.add_user_gems(userId, gems, CASH_CHANGE_RESONS.ADD_DEALER);
    if (suc) {
        http.send(res, RET_OK, null, true);
    } else {
        http.send(res, GAME_ERRS.ADD_GEMS_FAILED, null, true);
    }
});
//////////////////////////////////////////////////////////////Dealer API END

//////////////////////////////////////////////////////////////Manage API BEGIN
app.get('/player_buy_gems_all', function (req, res) {
    //充值钻石总数 2 - gems
    var totalGems = db.get_total_pay(2);

    http.send(res, RET_OK, { buy_gems_all: totalGems }, true);
});

app.get('/get_user_ranking', function (req, res) {
    var numOfUsers = db.get_num_of_users();
    var userId = parseInt(req.query.user_id);
    userId = isNaN(userId) ? null : userId;

    var start = parseInt(req.query.start);
    start = isNaN(start) ? null : start;

    var rows = parseInt(req.query.rows);
    rows = isNaN(rows) ? null : rows;

    var users = db.get_user_list(userId, start, rows);
    if(users) {
        for (var idx in users) {
            var user = users[idx];
            user.score = 0;
            user.rank = 1;
            user.total_games = 0;
            user.total_score = 0;
            user.name = crypto.fromBase64(user.name);
            user.state = user.forbidden;
        }
    }
users[0].cnt=numOfUsers
data = users
    http.send(res, RET_OK,data, true);
});


app.get('/rooms', function (req, res) {
    var url = 'http://' + config.HALL_FOR_GAME_IP +':' + config.HALL_FOR_GAME_PORT + '/get_num_of_playing_rooms';
    var ret = http.getSync(url);
    var num = ret.data ? ret.data.num : 0;
    http.send(res, RET_OK, {rooms: [{ cnt: num }] }, true);
});

app.get('/majiang_rooms',function(req,res){
	var start = req.query.start;
	var rows = req.query.rows;
	var roomid = req.query.roomid;
    if(start == null){
		http.send(res,-1,"failed");
        return ;
    }
    if(rows == null){
		http.send(res,-1,"failed");
        return ;
    }   

	var suc =db.get_rooms_dht(start,rows,roomid)
		if(suc!== null){
			http.send(res,RET_OK, suc);
		}
		else{
			http.send(res,1,"failed");
		}
});

app.get('/shisanshui_rooms',function(req,res){
	var start = req.query.start;
	var rows = req.query.rows;
	var roomid = req.query.roomid;
    if(start == null){
		http.send(res,-1,"failed");
        return ;
    }
    if(rows == null){
		http.send(res,-1,"failed");
        return ;
    }   

	var suc =db.get_rooms(start,rows,roomid)
		if(suc!== null){
			http.send(res,RET_OK, suc);
		}
		else{
			http.send(res,1,"failed");
		}
});
app.get('/userForbidden', function (req, res) {
    var userId = parseInt(req.query.userid);
    userId = isNaN(userId) ? null : userId;
    var gemsList = db.forbiddenUser(userId);//, start, rows);
    http.send(res, RET_OK);
});
app.get('/deleteUserF', function (req, res) {
    var userId = parseInt(req.query.userid);
    userId = isNaN(userId) ? null : userId;
    var gemsList = db.deleteUserF(userId);//, start, rows);
    http.send(res, RET_OK);
});
app.get('/get_gem_consume_records', function (req, res) {
    var userId = parseInt(req.query.userid);
    userId = isNaN(userId) ? null : userId;
    var start = parseInt(req.query.start);
    start = isNaN(start) ? null : start;
    var rows = parseInt(req.query.rows);
    rows = isNaN(rows) ? null : rows;

    var data = db.get_gem_consume_records(userId,start,rows);//, start, rows);

    http.send(res, RET_OK, data, true);
});

//获取中奖纪录
app.get('/get_welfare_records',function(req,res){
	var start = req.query.start;
	var rows = req.query.rows;
	var state = req.query.state;
	var start_time = req.query.start_time;
	var end_time = req.query.end_time;
	var user_id = req.query.user_id;
	db.get_welfare_records(start,rows,state,start_time,end_time,user_id,function(data){

		if(data){
		http.send(res,0,"ok",data);	
		}
		else{
			http.send(res,1,"null");
		}

	})
})

app.get('/update_user_agent',function(req,res){
	var userid = req.query.userid;
	var agent = req.query.agent;

	var data =db.update_user_agent(userid,agent)
		if(data){
			http.send(res,0,"ok");	
		}
		else{
			http.send(res,1,"fail");
		}

	
})


//处理中奖纪录
app.get('/deal_welfare_records',function(req,res){
	var id = req.query.id;

	var data =db.deal_welfare_record(id)
		if(data){
			http.send(res,0,"ok");	
		}
		else{
			http.send(res,1,"fail");
		}

	
})

//获取转盘商品信息
app.get('/get_awards_config',function(req,res){
	var start = req.query.start;
	var rows = req.query.rows;
	var data = db.get_awards_config(start,rows)

		if(data){
		http.send(res,0,"ok",data);	
		}
		else{
			http.send(res,1,"null");
		}

})

//更新转盘商品信息
app.get('/update_awards_config',function(req,res){
	var id = req.query.id;
	var type = req.query.type;
	var num = req.query.num;
	var name = req.query.name;
	var prop = req.query.prop;
	var cnt = req.query.cnt;

	var data =db.update_awards_config(id,type,num,name,prop,cnt)
		if(data){
			http.send(res,0,"ok");	
		}
		else{
			http.send(res,1,"fail");
		}

	
})

app.get('/get_pay_list', function (req, res) {
    console.log(1111)
    var userId = parseInt(req.query.userid);
    var start = parseInt(req.query.start);
    var rows = parseInt(req.query.rows);
    var end_time = parseInt(req.query.end_time);
    var start_time = parseInt(req.query.start_time);

    var data = db.get_pay_list(start,rows,userId,start_time,end_time);
    http.send(res, RET_OK, data, true);

    
});
app.get('/get_message', function (req, res) {
    var start = parseInt(req.query.start);
    start = isNaN(start) ? null : start;
    var rows = parseInt(req.query.rows);
    rows = isNaN(rows) ? null : rows;

    var data = db.get_message('all', null,start,rows);

    http.send(res, RET_OK,data, true);
});

app.get('/update_message', function (req, res) {
    var type = req.query.type;
    var message = req.query.message;
    var version = req.query.version;

    if (type == null || message == null) {
        http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
        return;
    }

    var ret = db.update_message(type, message, version);
    if(ret) {
        http.send(res, RET_OK, null, true);
    } else {
        http.send(res, { code: -1, msg: 'failed' }, null, true);
    }
});

app.get('/add_message', function (req, res) {
    var type = req.query.type;
    var message = req.query.message;
    var version = req.query.version;

    if (type == null || message == null) {
        http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
        return;
    }

    var ret = db.create_message(type, message, version) 
    if(ret) {
        http.send(res, RET_OK, null, true);
    } else {
        http.send(res, { code: -1, msg: 'failed' }, null, true);
    }
});

app.get('/del_message', function (req, res) {
    var type = req.query.type;
    var message = req.query.message;
    var version = req.query.version;

    if (type == null) {
        http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
        return;
    }

    var ret = db.delete_message(type, message, version);
    if(ret) {
        http.send(res, RET_OK, null, true);
    } else {
        http.send(res, { code: -1, msg: 'failed' }, null, true);
    }
});
// 强制解散房间
app.get('/dissolveRoom', function (req, res) {
    var roomid = req.query.roomid;
    var type = req.query.type;
    if (roomid == null) {
        http.send(res, -1, "failed");
        return;
    }
    var suc = db.dissolve_room(roomid,type);
		if (suc !== null) {
			http.send(res, 0, "ok");
		}
		else {
			http.send(res, 1, "failed");
		}
});

app.get('/get_shop_data', function (req, res) {
    var start = parseInt(req.query.start);
    start = isNaN(start) ? null : start;
    var rows = parseInt(req.query.rows);
    rows = isNaN(rows) ? null : rows;

    var data = db.get_shop_data('all');

    http.send(res, RET_OK, data, true);
});

app.get('/update_shop_data', function (req, res) {
    var itemId = req.query.item_id;
    var shopId = req.query.shop_id;
    var icon = req.query.icon;
    var name = req.query.name;
    var priceType = req.query.price_type;
    var price = req.query.price;
    var gainType = req.query.gain_type;
    var gain = req.query.gain;
    var desc = req.query.desc;

    if (shopId == null || itemId == null || name == null || priceType == null 
        || price == null || gainType == null || gain == null) {
        http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
        return;
    }

    var attrs = {};
    attrs['item_id'] = itemId;
    attrs['shop_id'] = shopId;
    attrs['icon'] = icon;
    attrs['name'] = name;
    attrs['price_type'] = priceType;
    attrs['price'] = price;
    attrs['gain_type'] = gainType;
    attrs['gain'] = gain;
    attrs['desc'] = desc;
    
    var ret = db.update_shop_data(itemId, attrs);
    if(ret) {
        http.send(res, RET_OK, null, true);
    } else {
        http.send(res, { code: -1, msg: 'failed' }, null, true);
    }
});

app.get('/add_shop_data', function (req, res) {
    var itemId = req.query.item_id;
    var shopId = req.query.shop_id;
    var icon = req.query.icon;
    var name = req.query.name;
    var priceType = req.query.price_type;
    var price = req.query.price;
    var gainType = req.query.gain_type;
    var gain = req.query.gain;
    var desc = req.query.desc;

    if (shopId == null || itemId == null || name == null || priceType == null 
        || price == null || gainType == null || gain == null) {
        http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
        return;
    }

    var ret = db.create_shop_data(shopId, itemId, icon, name, priceType, price, gainType, gain, desc);
    if(ret) {
        http.send(res, RET_OK, null, true);
    } else {
        http.send(res, { code: -1, msg: 'failed' }, null, true);
    }
});

app.get('/del_shop_data', function (req, res) {
    var itemId = req.query.item_id;

    if (itemId == null) {
        http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
        return;
    }

    var ret = db.delete_shop_data(itemId);
    if(ret) {
        http.send(res, RET_OK, null, true);
    } else {
        http.send(res, { code: -1, msg: 'failed' }, null, true);
    }
});

exports.start = function(conf) {
    config = conf;
	app.listen(config.MANAGE_PORT);
    console.log('manage_server start on '+ config.MANAGE_PORT)
    
};