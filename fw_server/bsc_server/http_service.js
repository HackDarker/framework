require('../externals/utils/sys');
var crypto = require('../externals/utils/crypto');
var express = require('express');
var db = require('../externals/utils/dbsync');
var cp = require('crypto');
var http = require('../externals/utils/http');
var fibers = require('fibers');

var matchMgr = require('./matchmgr');//比赛场

var app = express();
var config = null;

//加密路由
var encryptRoutMgr = ((global.HTTP_AES_KEY != null) ? new http.HttpRoutMgr() : app);

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




//=====================比赛场接口=====================start
//获取比赛场的列表
app.get('/get_match_list', function (req, res) {
    console.log('======获取比赛场的列表0======', req.query)
    if (req.query.type == null || req.query.game_type == null) {
        return
    }

    let match_list = new Promise((resolve, reject) => {
        let game_type = req.query.game_type;
        let db_get_match_list = db.get_match_list(game_type, req.query.type, req.query.matchId)
        db_get_match_list.then(data => {
            if (data) {
                resolve(data)
            }
        }).catch(err => {
            console.log(err)
        })
    })

    match_list.then(data => {
        if (data.length <= 0) {
            http.send(res, { code: 2222, msg: "ok" }, {}, true);
            return
        }
        if (req.query.type == 'all' && req.query.game_type == 'all') {
            let match_list = [];
            for (let i in data) {
                let temp = {};
                temp.id = data[i].id
                temp.type = data[i].type
                temp.game_type = data[i].game_type
                temp.match_icon = data[i].match_icon || null
                temp.match_password = data[i].match_password || null
                match_list.push(temp);
            }
            match_list.sort();
            let match_data = {
                data: match_list,
                game_type: req.query.game_type,
                type: req.query.type
            }
            http.send(res, RET_OK, match_data, true)
        } else {
            for (let i in data) {
                //console.log('========》》》', data[i])
                // 本地对象是否存在某比赛场信息
                matchMgr.initMatchRoomInfo(data[i], (str) => {
                    fibers(function () {
                        let isBaoming = matchMgr.getMatchBaoming(req.query.userId, data[i].id)
                        let people_num = matchMgr.match_rooms[data[i].id].people_num
                        data[i].isBaoming = isBaoming
                        data[i].people_num = people_num
                        data[i].consume = JSON.parse(data[i].consume)
                        data[i].rewards = JSON.parse(data[i].rewards)
                        if (parseInt(i) + 1 == data.length) {
                            let match_data = {
                                data: data,
                                game_type: req.query.game_type,
                                type: req.query.type
                            }
                            setTimeout(() => {
                                http.send(res, RET_OK, match_data, true)
                                // console.log(match_data)
                            }, 100)
                        }
                    }).run();
                })
            }
        }
    }).catch(err => {
        console.error(err)
    })
});

//报名事件，判断是否已经报名进行操作
app.get('/get_baoming', function (req, res) {
    console.log('======报名事件，判断是否已经报名进行操作======', req.query);
    if (req.query.userId === null || req.query.matchId === null) {
        return
    }
    let userId = req.query.userId
    let matchId = req.query.matchId
    let payment = req.query.payment
    let account = req.query.account
    if (!matchMgr.getIfCanBaoming(matchId)) {
        http.send(res, { code: 3333, msg: "比赛人数已满！" }, {}, true);
        return
    }
    //用户是否报名了某比赛场
    let isBaoming = matchMgr.getMatchBaoming(userId, matchId)
    let baoming = null
    let fun = (str) => {
        let isPlay = matchMgr.getIfCanBaoming(matchId)
        let data = matchMgr.match_rooms[matchId]
        data.id = matchId
        data.isPlay = !isPlay
        let backData = {
            id: data.id,
            consume: data.consume,
            isPlay: data.isPlay,
            people_num: data.people_num,
            people_limit: data.people_limit,
            baoming: baoming,
            turns: data.turns,
            base_turns: data.base_turns,
            title: data.title
        }
        if (str) {
            //报名成功或者退赛成功
            http.send(res, RET_OK, backData, true);
            matchMgr.userMgrInMatch('bisai_baoming_info_push', backData, matchId, userId, true, () => {
                matchMgr.getIfCanBegin(matchId, userId)
            })
        } else {
            //余额不足支付
            http.send(res, { code: 2222, msg: "ok" }, backData, true);
        }
    }
    console.log('matchMgr.match_rooms[matchId].isPlay', matchMgr.match_rooms[matchId].isPlay)
    if (!matchMgr.match_rooms[matchId].isPlay) {
        if (isBaoming) {
            delete matchMgr.match_rooms[matchId].seat[userId]
            matchMgr.match_rooms[matchId].people_num--
            baoming = false
            fun(true)
        } else {
            if (matchMgr.getIsBaoming(userId)) {
                http.send(res, { code: 3333, msg: "您还有一场比赛正在进行！如想继续报名本场，需取消之前的报名！" }, {}, true);
            } else {
                if (matchMgr.getIfCanBaoming(matchId)) {
                    //let db_get_user_data = db.get_user_data(account)
                    let db_get_user_data = db.match_user_data(account);
                    db_get_user_data.then(data => {
                        let addData = {
                            data: data,
                            matchId: matchId
                        }
                        let isAdd = matchMgr.addUserInMatch(payment, addData)
                        baoming = true
                        fun(isAdd)
                    })
                        .catch(err => {
                            console.log(err)
                        })
                }
            }
        }
    } else {
        //比赛已经开始，不可进行任何操作
        http.send(res, { code: 3333, msg: "比赛已经开始，不可进行任何操作" }, {}, true);
    }
});

//这里返回比赛场详细信息
app.get('/get_match_details', function (req, res) {
    console.log('====这里返回比赛场详细信息====', req.query)
    if (req.query.userId === null || req.query.matchId === null) {
        return
    }
    let data = matchMgr.match_rooms[req.query.matchId]
    data.id = req.query.matchId
    http.send(res, RET_OK, { id: data.id, people_num: data.people_num, people_limit: data.people_limit, consume: data.consume, rewards: data.rewards }, true);
})

//不加密用于内部游戏接收 这里更新比赛场用户分数信息
app.get('/update_match_user_score', function (req, res) {
    if (req.query.userId === null || req.query.score === null || req.query.matchId === null) {
        return
    }
    matchMgr.match_rooms[req.query.matchId].seat[req.query.userId].match_score += parseInt(req.query.score)
    console.log('/update_match_user_score 本局比赛结束 更新玩家比赛分数成功', req.query.score)
    http.send(res, RET_OK);
})

//不加密用于游戏内部接收 //这里更新比赛场信息，判断是否下一轮比赛
app.get('/update_match_info', function (req, res) {
    if (req.query.roomId === null || req.query.matchId === null) {
        return
    }
    let room_arr = matchMgr.match_rooms[req.query.matchId].room_arr[req.query.roomId]
    for (let i of room_arr) {
        matchMgr.match_rooms[req.query.matchId].seat[i].turns++
    }
    delete matchMgr.match_rooms[req.query.matchId].room_arr[req.query.roomId]
    console.log('===>比赛ID:'+req.query.matchId);
    console.log('删除房间后判断是否还有在进行比赛的房间ONE!', Object.keys(matchMgr.match_rooms[req.query.matchId].room_arr).length)
    if (Object.keys(matchMgr.match_rooms[req.query.matchId].room_arr).length == 0) {//
        console.log('游戏总轮数：', matchMgr.match_rooms[req.query.matchId].base_turns)
        console.log('本轮游戏结束时 当前轮数：', matchMgr.match_rooms[req.query.matchId].turns)
        matchMgr.match_rooms[req.query.matchId].turns++
        console.log('本轮游戏结束后 下一局轮数：', matchMgr.match_rooms[req.query.matchId].turns)
        //matchMgr.match_rooms[req.query.matchId].turns = matchMgr.match_rooms[req.query.matchId].base_turns
        matchMgr.totalMatchRooms(req.query.matchId)
    }
    http.send(res, RET_OK);
})

//不加密用于游戏内部接收
app.get('/get_detail_match', function (req, res) {
    if (req.query.userId === null) {
        return
    }
    let matchData = matchMgr.getMatchData(req.query.userId)
    console.log('get_detail_match');
    console.log('玩家['+req.query.userId+']获取自己的比赛分：',matchData.userData);
    http.send(res, RET_OK, { matchData: matchData });
})

//不加密用于游戏内部接收
app.get('/get_match_room_info', function (req, res) {
    if (req.query.roomId == null || req.query.matchId == null) {
        return
    }
    let match_room = {}
    console.log('matchMgr.match_rooms', matchMgr.match_rooms);
    try {
        let room_user_arr = matchMgr.match_rooms[req.query.matchId].room_arr[req.query.roomId]
        for (let i of room_user_arr) {
            match_room[i] = matchMgr.match_rooms[req.query.matchId].seat[i]
        }
        http.send(res, RET_OK, { match_room: match_room });
    } catch (error) {
        http.send(res, { code: 2, msg: "room_arr is null." }, {});
    }

})

//没有用的接口
// app.get('/get_user_is_baoming', function (req, res) {
//     console.log('req', req.query)
//     if (req.query.userId === null) {
//         return
//     }
//     let matchData = matchMgr.getMatchData(parseInt(req.query.userId))
//     http.send(res, RET_OK, {matchData:matchData});
// })
//进入大厅后检查 是否报名 比赛场
app.get('/get_bisai_state', function (req, res) {
    if (req.query.userId === null) {
        return
    }
    var account = req.query.account;
    var userId = req.query.userId;
    let db_get_user_data = db.match_user_data(account);
    db_get_user_data.then(data => {
        console.log('====检查比赛用户是否报名====', matchMgr.getIsBaoming(userId));
        if (matchMgr.getIsBaoming(userId)) {
            let getMatchData = matchMgr.getMatchData(userId);
            if (parseInt(data.roomid) > 0) {
                http.send(res, RET_OK, { roomId: data.roomid, matchData: getMatchData.matchData }, true);
            } else {
                http.send(res, RET_OK, { matchData: getMatchData.matchData }, true);
            }
        } else {
            http.send(res, { code: 3333, msg: "This user is not doing any match." }, {}, true);
        }
    }).catch(err => {
        console.log(err)
    })
})

//=====================比赛场接口=====================end

exports.start = function (conf) {
    config = conf;
    app.listen(config.BSC_FOR_HALL_PORT, config.BSC_FOR_GAME_IP);
    console.log("client service is listening on port " + config.BSC_FOR_HALL_PORT);
    return { app: app };
};
// exports.start = function (conf) {
// 	config = conf;

// 	//
// 	gameServerInfo = {
// 		id: config.SERVER_ID,
// 		type: config.GAME_TYPE,
// 		mode: config.GAME_MODE,
// 		clientip: config.GAME_FOR_CLIENT_IP,
// 		clientport: config.GAME_FOR_CLIENT_PORT,
// 		httpPort: config.GAME_FOR_HALL_PORT,
// 		load: roomMgr.getTotalRooms(),
// 	};

// 	setInterval(update, 1000);
// 	app.listen(config.GAME_FOR_HALL_PORT, config.GAME_FOR_HALL_IP);
// 	console.log("http service is listening on " + config.GAME_FOR_HALL_IP + ":" + config.GAME_FOR_HALL_PORT);
// };