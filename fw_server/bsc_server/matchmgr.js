//比赛场数据库字段名
//game_type:比赛场游戏类型
//type:比赛场类型
//title:比赛场标题
//isCycle:是否循环创建
//match_type:比赛类型{0:瑞士移位定局积分制(非淘汰)，1:瑞士移位定局打立出局制(淘汰)}
//base_turns:设置的最大游戏轮数
//people_limit:满人开赛
//consume:选择消耗的数据{'coins':2000,'gems':3}
//rewards:奖励
//isPlay:比赛场状态
//turns:当前游戏轮数
var fibers = require('fibers');
var crypto = require('../externals/utils/crypto');
var db = require('../externals/utils/dbsync')
//var userMgr = (require('../../externals/game_utils/usermgr')).getUserMgr('match');
var userMgr = require('./bsc_usermgr');
var room_service = require('../hall_server/room_service')
var { chunk, map, sortBy } = require("lodash")
var http = require('../externals/utils/http');

//初始化积分
var score = 100

//定义比赛场房间信息
// var match_rooms = {787879:{seat:[811537]},456456:{seat:[]},554333:{seat:[]},546321:{seat:[]}}
var match_rooms = {}
exports.match_rooms = match_rooms;

var config = null
var configs = null
exports.setConfig = function (conf, confs) {
    config = conf;
    configs = confs;
    console.log('新进程--------------', configs.ptddz_game_server_conf().GAME_FOR_HALL_PORT);
    console.log('新进程--------------', configs.srddz_game_server_conf().GAME_FOR_HALL_PORT);
    console.log('新进程--------------', configs.dht_game_server_conf().GAME_FOR_HALL_PORT);
    console.log('新进程--------------', config.BSC_FOR_GAME_IP);
    console.log('新进程--------------', config.ROOM_PRI_KEY);
    console.log('新进程--------------', config.BSC_FOR_CLIENT_PORT);
};

//比赛类型{0:瑞士移位定局积分制(非淘汰)，1:瑞士移位定局打立出局制(淘汰)}
var match_type = {
    DINJU_JIFEN: 0,
    DINJU_CHUJU: 1
}

//初始化比赛场信息，缓存于本地对象中
exports.initMatchRoomInfo = (matchData, callback) => {
    if (!matchData || matchData.id <= 0) {
        return
    }

    let matchData_id = matchData.id
    let matchData_people_num = 0
    let matchData_people_limit = matchData.people_limit
    let matchData_isPlay = matchData.isPlay
    let matchData_consume = JSON.parse(matchData.consume)
    let matchData_isCycle = matchData.isCycle
    let matchData_type = matchData.type
    let matchData_title = matchData.title
    let matchData_rewards = JSON.parse(matchData.rewards)
    let matchData_game_type = matchData.game_type
    let matchData_base_turns = matchData.base_turns
    let matchData_match_type = matchData.match_type

    let match_icon = matchData.match_icon
    let order_weight = matchData.order_weight
    let game_conf = matchData.game_conf || null
    console.log('新进程--initMatchRoomInfo--')
    fibers(function () {
        let db_get_has_match = db.get_has_match(matchData_id)
        db_get_has_match.then(back_data => {
            if (back_data && !match_rooms[matchData_id]) {
                let data = {
                    seat: {},
                    people_num: matchData_people_num,
                    people_limit: matchData_people_limit,
                    isPlay: matchData_isPlay,
                    consume: matchData_consume,
                    isCycle: matchData_isCycle,
                    type: matchData_type,
                    title: matchData_title,
                    rewards: matchData_rewards,
                    game_type: matchData_game_type,
                    turns: 0,
                    base_turns: matchData_base_turns,
                    match_type: matchData_match_type,
                    match_icon: match_icon,
                    order_weight: order_weight,
                    game_conf: game_conf,
                    room_arr: {}
                };
                match_rooms[matchData_id] = data;
                callback(true)
            }
            else if (back_data && match_rooms[matchData_id]) {
                callback(false)
            }

        }).catch(err => {
            console.error(err)
        })
    }).run();
};

//判断比赛是否可以开始
exports.getIfCanBegin = (matchId, userId) => {
    if (!matchId || matchId <= 0) {
        return
    }
    if (exports.getMatchPeopleNum(matchId) == match_rooms[matchId].people_limit) {
        console.log('新进程--update_isPlay--')
        fibers(function () {
            let db_update_isPlay = db.update_match_isPlay(matchId)
            db_update_isPlay.then(suc => {
                if (suc) {
                    match_rooms[matchId].isPlay = 1
                    let backData = match_rooms[matchId].seat[userId]
                    userMgr.broacastMatch('match_begin_push', backData, matchId, userId, true, () => {
                        //人数已满,通知比赛开始！！
                        exports.totalMatchRooms(matchId)
                    })

                }
            }).catch(err => {
                console.log(err)
            })
        }).run();
    }
};

//淘汰用户,创建房间,分配房间
exports.totalMatchRooms = (matchId) => {
    fibers(function () {
        if (matchId === null) {
            return
        }
        let num = null
        let chunkCountries = null
        let deleteSeatArr = null
        let SeatArr = exports.getMatchAllSeat(matchId)
        switch (match_rooms[matchId].game_type) {
            case 'srddz':
                num = 4
                break
            case 'ptddz':
                num = 3
                break
            default:
                num = 4
                break
        }
        console.log('matchId.game_type', match_rooms[matchId].game_type)
        //比赛场首次创建房间
        if (match_rooms[matchId].turns === 0) {
            //调用lodash的chunk方法把所有报名的用户登分    
            if (SeatArr % num === 0) {
                chunkCountries = chunk(SeatArr, num)
            } else {
                //这是避免进程堵塞超过限制人数会通知用户
                let deleteSeat = SeatArr.splice(SeatArr.length - 1, SeatArr % num)
                for (let i of deleteSeat) {
                    delete match_rooms[matchId].seat[i]
                    match_rooms[matchId].people_num--
                    let data = {
                        errMsg: '比赛场出错，未扣除报名费用，请重新报名！'
                    }
                    userMgr.sendMsg(i, 'exit_match_push', data)
                }
                chunkCountries = chunk(SeatArr, num)
            }
            deleteSeatArr = []
            //扣除报名比赛的费用
            exports.deductCost(matchId)
        }
        //比赛场第二次起创建房间
        else {
            //主要的计算方式
            let rankingSeatsArr = null
            //返回积分排序后的用户数组        
            if (match_rooms[matchId].match_type === match_type.DINJU_JIFEN) {
                rankingSeatsArr = exports.sortRanking(matchId)
                if (match_rooms[matchId].turns == match_rooms[matchId].base_turns) {
                    deleteSeatArr = rankingSeatsArr.splice(-(rankingSeatsArr.length - 3))
                } else {
                    deleteSeatArr = []
                }
            }
            //返回删除出局用户的积分排序后的用户数组        
            else if (match_rooms[matchId].match_type === match_type.DINJU_CHUJU) {
                rankingSeatsArr = exports.sortRanking(matchId)
                let match_people_limit = match_rooms[matchId].people_limit
                //最主要的淘汰机制计算方式--start
                let need_delete_num = match_people_limit - parseInt(match_people_limit * (match_rooms[matchId].turns / (match_rooms[matchId].base_turns + 1)))
                let zon_need_delete_num = need_delete_num % num == 0 ? need_delete_num : need_delete_num + (num - (need_delete_num % num))
                //最主要的淘汰机制计算方式--end
                console.log('当前总需要删除的玩家数', zon_need_delete_num)
                if (match_rooms[matchId].turns == match_rooms[matchId].base_turns) {
                    deleteSeatArr = rankingSeatsArr.splice(-(rankingSeatsArr.length - 3))
                } else {
                    if (rankingSeatsArr.length - zon_need_delete_num === 0) {
                        deleteSeatArr = []
                    } else {
                        deleteSeatArr = rankingSeatsArr.splice(-(rankingSeatsArr.length - zon_need_delete_num))
                    }
                }
            }
            //瑞士移位分配房间
            chunkCountries = chunk(rankingSeatsArr, num)
        }
        console.log('chunkCountries', chunkCountries)
        console.log('chunkCountries--1-', match_rooms[matchId].turns + ' [==] ' + match_rooms[matchId].base_turns)
        //创建所有的房间
        if (match_rooms[matchId].turns == match_rooms[matchId].base_turns) {
            //保存前三名玩家获奖信息并通知前端
            let rankingSeatsArr = exports.sortRanking(matchId)
            for (let i of rankingSeatsArr) {
                let title = match_rooms[matchId].title
                let top = match_rooms[matchId].seat[i].top
                let userid = i
                let rewards = null
                // switch (top) {
                //     case 1:
                //         rewards = match_rooms[matchId].rewards.one
                //         break
                //     case 2:
                //         rewards = match_rooms[matchId].rewards.two
                //         break
                //     case 3:
                //         rewards = match_rooms[matchId].rewards.three
                //         break
                // }
                //获取获奖人数
                let getObjLength = function (object) {
                    let count = 0;
                    for (const key in object) {
                        if (object.hasOwnProperty(key)) {
                            let winner_num = parseInt(object[key].winner_num);
                            if (object[key].winner_num) {
                                count += winner_num;
                            }
                        }
                    }
                    return count;
                }
                //top玩家排名
                //rank奖励等级
                //根据玩家排名获取奖励
                let getRankRewardByTop = function (object, top) {
                    let count = 1;
                    let reward = null;
                    for (const key in object) {
                        if (object.hasOwnProperty(key)) {
                            let winner_num = parseInt(object[key].winner_num);
                            if (count <= top && top < count + winner_num) {
                                reward = object[key];
                                break;
                            } else {
                                count += winner_num;
                            }
                        }
                    }
                    return reward;
                }
                let game_type = match_rooms[matchId].game_type
                let type = match_rooms[matchId].type
                if (top > getObjLength(match_rooms[matchId].rewards)) {
                    exports.eliminate(matchId, [i])
                } else {
                    // rewards = match_rooms[matchId].rewards[top];
                    rewards = getRankRewardByTop(match_rooms[matchId].rewards, top);
                    let is_delivery = 0
                    let save_ranking_info = () => {
                        let reward = rewards.name + 'x' + rewards.prize_num;
                        let db_save_ranking_info = db.save_ranking_info(title, top, userid, reward, game_type, type, matchId, is_delivery)
                        db_save_ranking_info.then(() => {
                            exports.eliminate(matchId, [i])
                        })
                            .catch(err => {
                                console.log(err)
                            })
                    }
                    // if (rewards.substr(0, rewards.lastIndexOf('x')) === '金币') {
                    if (rewards.prize_type === 'jb') {
                        let db_add_user_coins = db.add_user_coins(i, rewards.prize_num)
                        db_add_user_coins.then(() => {
                            is_delivery = 1
                            console.log('金币发放成功！')
                            save_ranking_info()
                        })
                            .catch(err => {
                                console.log(err)
                            })
                    }
                    // else if (rewards.substr(0, rewards.lastIndexOf('x')) == '房卡') {
                    //     let db_add_user_gems = db.add_user_gems(i, rewards.substr(rewards.lastIndexOf('x') + 1))
                    else if (rewards.prize_type === 'fk') {
                        let db_add_user_gems = db.add_user_gems(i, rewards.prize_num)
                        db_add_user_gems.then(() => {
                            is_delivery = 1
                            console.log('房卡发放成功！')
                            save_ranking_info()
                        })
                    }
                    else {//其他奖品 红包 或商家提供的实物
                        save_ranking_info()
                    }
                }
            }
            setTimeout(() => {
                exports.matchOver(matchId)
            }, 400)
        } else {
            //跨域请求
            //创建房间
            function createMatchRoom() {
                return new Promise((resolve, reject) => {
                    let data = match_rooms[matchId]
                    data.matchId = matchId
                    let seat = []
                    for (let i in data.seat) {
                        data.seat[i].id = i
                        //比赛房间里面有一个前十名的排行榜
                        if (data.seat[i].top < 11) {
                            seat.push(data.seat[i])
                        }
                    }
                    console.log('新进程2--------------', configs);
                    data.seatArr = JSON.stringify(seat)
                    let PORT = null;
                    if (match_rooms[matchId].game_type == 'ptddz') {
                        PORT = configs.ptddz_game_server_conf().GAME_FOR_HALL_PORT;
                    }
                    else if (match_rooms[matchId].game_type == 'srddz') {
                        PORT = configs.srddz_game_server_conf().GAME_FOR_HALL_PORT;
                    }
                    else {
                        PORT = configs.dht_game_server_conf().GAME_FOR_HALL_PORT;
                    }
                    http.get(config.BSC_FOR_GAME_IP, PORT, '/createMatchRoom', data, (ret, backData) => {
                        console.log('=======23=======', backData.roomId);
                        if (ret) {
                            resolve(backData.roomId)
                        }
                    })

                    // let HALL_FOR_GAME_IP = match_rooms[matchId].game_type === 'ddz' ? configs.ptddz_game_server_conf().HALL_FOR_GAME_IP : configs.dht_game_server_conf().HALL_FOR_GAME_IP
                    // let HALL_FOR_GAME_PORT = match_rooms[matchId].game_type === 'ddz' ? configs.ptddz_game_server_conf().HALL_FOR_GAME_PORT : configs.dht_game_server_conf().HALL_FOR_GAME_PORT
                    // let url = 'http://' + HALL_FOR_GAME_IP + HALL_FOR_GAME_PORT;
                    // let backData = http.getSync(url + '/createMatchRoom', data);
                    // console.log('=======24=======',backData);
                    // if(backData){
                    //     resolve(backData.errmsg.roomId)
                    // }
                })
            }

            //获取玩家信息
            function getUserData(roomId, num_i) {
                return new Promise((resolve, reject) => {
                    let userDataArr = []
                    let num = 0
                    fibers(function () {
                        for (let i of chunkCountries[num_i]) {
                            let userData = db.get_user_data_by_userid(i)
                            if (userData) {
                                userDataArr.push({ name: userData.name, userid: userData.userid })
                                num++
                                if (num >= chunkCountries[num_i].length) {
                                    resolve({ userDataArr: userDataArr, roomId: roomId })
                                }
                            }
                        }
                    }).run();
                })
            }

            //进入房间
            function enterRoom(roomId, userDataArr, num_i) {
                return new Promise((resolve, reject) => {
                    let enterInfoArr = {}
                    let num = 0
                    fibers(function () {
                        for (let i of chunkCountries[num_i]) {
                            let user_name = ''
                            for (let j in userDataArr) {
                                if (userDataArr[j].userid == i) {
                                    user_name = userDataArr[j].name
                                }
                            }
                            let gametype = match_rooms[matchId].game_type.indexOf('mj') !== -1 ? '0020001' : '0010002'
                            let gamemode = 'norm'
                            let temp = {
                                i: i,
                                user_name: user_name,
                                roomId: roomId,
                                gametype: gametype,
                                gamemode: gamemode,
                                ip: match_rooms[matchId].seat[i].ip,
                                gps: match_rooms[matchId].seat[i].gps,
                            }
                            //跨域大厅请求加入房间
                            http.get(config.BSC_FOR_GAME_IP, 9000, '/get_bsc_enterRoom', temp, (ret, data) => {
                                console.log('=======请求加入房间=======1', ret);
                                console.log('=======请求加入房间=======2', data.enterInfo);
                                if (data.enterInfo) {
                                    enterInfoArr[i] = data.enterInfo
                                    num++
                                    if (num >= chunkCountries[num_i].length) {
                                        resolve({ enterInfoArr: enterInfoArr, roomId: roomId })
                                    }
                                }
                            })
                        }
                    }).run();
                })
            }

            //通知前端
            function emit_begin(enterInfoArr, roomId, num_i) {
                return new Promise((resolve, reject) => {
                    let gametype = match_rooms[matchId].game_type.indexOf('mj') !== -1 ? '0020001' : '0010002'
                    let gamemode = 'norm'
                    let num = 0
                    for (let i of chunkCountries[num_i]) {
                        //通知前端进入房间
                        let push_ret = {
                            roomid: roomId,
                            ip: enterInfoArr[i].ip,
                            port: enterInfoArr[i].port,
                            token: enterInfoArr[i].token,
                            time: Date.now(),
                            gametype: gametype,
                            gamemode: gamemode,
                        };
                        push_ret.sign = crypto.md5(push_ret.roomid + push_ret.token + push_ret.time + config.ROOM_PRI_KEY);
                        userMgr.sendMsg(i, 'match_enter_room_push', push_ret)
                        num++
                        console.log('通知用户' + i + '成功！！')
                        if (num >= chunkCountries[num_i].length) {
                            resolve({ roomId: roomId })
                        }
                    }
                })
            }

            //链式总控制执行
            function for_num(i) {
                return new Promise((resolve, reject) => {
                    createMatchRoom().then(data => {
                        console.log('1', data + ' [i]:' + i)
                        return getUserData(data, i)
                    })
                        .then(data => {
                            console.log('2', data)
                            let roomId = data.roomId
                            let userDataArr = data.userDataArr
                            return enterRoom(roomId, userDataArr, i)
                        })
                        .then(data => {
                            console.log('3')
                            //分配给玩家对应的房间
                            let enterInfoArr = data.enterInfoArr
                            let roomId = data.roomId
                            match_rooms[matchId].room_arr[roomId] = chunkCountries[i]
                            return setTimeout(() => {
                                emit_begin(enterInfoArr, roomId, i)
                            }, 5000)
                        }).then((data) => {
                            console.log('4')
                            console.log('deleteSeatArr', deleteSeatArr, typeof deleteSeatArr)
                            if (deleteSeatArr.length > 0) {
                                exports.eliminate(matchId, deleteSeatArr)
                            }
                        }).catch(err => {
                            console.log(err)
                        })
                })
            }

            let for_num_arr = []
            for (let i = 0; i < chunkCountries.length; i++) {
                for_num_arr.push(for_num(i))
            }
            Promise.all(for_num_arr).then(value => {
                //淘汰玩家并通知前端
                console.log(value)
                //淘汰玩家
            })
        }
    }).run();
}

//关闭比赛场
exports.matchOver = (matchId) => {
    //删除比赛场,判断是否开启自动循环创建功能
    console.log('matchOver')
    if (match_rooms[matchId].isCycle) {
        exports.creatMatch(matchId)
    } else {
        delete match_rooms[matchId]
    }
}

//同步排名信息并且清除玩家
exports.eliminate = (matchId, seatArr) => {
    console.log('通知淘汰的玩家', seatArr)
    fibers(function () {
        for (let i of seatArr) {
            let match_score = match_rooms[matchId].seat[i].match_score
            let match_top = match_rooms[matchId].seat[i].top
            let matchData = match_rooms[matchId]
            let data = {
                match_score: match_score,
                match_top: match_top,
                matchData: JSON.stringify(matchData),
                userId: i
            }
            http.get(config.BSC_FOR_GAME_IP, configs.dht_game_server_conf().GAME_FOR_HALL_PORT, '/ranking_match_push', data, (ret, backData) => {
                console.log('===通知淘汰的玩家===', ret);
                if (ret) {
                    delete match_rooms[matchId].seat[i]
                    match_rooms[matchId].people_num--
                }
            })
        }
    }).run();
}

//创建新的比赛场
exports.creatMatch = (matchId) => {
    //这里在数据库创建一场同样的比赛
    //数据库储存操作(比赛场ID创建)
    console.log('执行创建新的比赛场！！！')
    let newMatch = () => {
        let generateMatchId = new Promise((resolve, reject) => {
            let match_id = '';
            for (var i = 0; i < 6; ++i) {
                match_id += Math.floor(Math.random() * 10);
                if (i == 5) {
                    resolve(match_id)
                }
            }
        })
        generateMatchId.then(id => {
            fibers(() => {
                let db_get_has_match = db.get_has_match(id)
                console.log('执行创建新的比赛场1！！！')
                db_get_has_match.then(data => {
                    if (data) {
                        newMatch()
                    } else {
                        fibers(() => {
                            let matchdata = {
                                id: id,
                                type: match_rooms[matchId].type,
                                title: match_rooms[matchId].title,
                                rewards: match_rooms[matchId].rewards,
                                people_limit: match_rooms[matchId].people_limit,
                                consume: match_rooms[matchId].consume,
                                game_type: match_rooms[matchId].game_type,
                                isCycle: match_rooms[matchId].isCycle,
                                base_turns: match_rooms[matchId].base_turns,
                                match_type: match_rooms[matchId].match_type,
                                order_weight: match_rooms[matchId].order_weight,
                                match_passwor: match_rooms[matchId].match_passwor,
                                match_icon: match_rooms[matchId].match_icon,
                                game_conf: match_rooms[matchId].game_conf,
                                isPlay: 0
                            }
                            let db_add_match_list = db.add_match_list(matchdata);
                            db_add_match_list.then(str => {
                                fibers(() => {
                                    if (str !== null) {
                                        let db_delete_match = db.delete_match(matchId)
                                        db_delete_match.then(back => {
                                            if (back) {
                                                delete match_rooms[matchId]
                                            }
                                        }).catch(err => {
                                            console.log(err)
                                        })
                                    }
                                }).run();
                            }).catch(err => {
                                console.log(err)
                            })
                        }).run();
                    }
                }).catch(err => {
                    console.log(err)
                })
            }).run();
        })
    }
    newMatch()
};

//扣除报名比赛的费用
exports.deductCost = (matchId) => {
    if (matchId === null) {
        return
    }
    fibers(function () {
        let searArr = exports.getMatchAllSeat(matchId)
        for (let i of searArr) {
            console.log('match_rooms[matchId].seat[i].payment', match_rooms[matchId].seat[i].payment)
            if (match_rooms[matchId].seat[i].payment == 'coins') {
                let ret = db.add_user_coins(i, -match_rooms[matchId].consume.coins)
                if (ret) {
                    console.log('扣除金币成功！')
                }
            }
            else if (match_rooms[matchId].seat[i].payment == 'gems') {
                let ret = db.add_user_gems(i, -match_rooms[matchId].consume.gems)
                if (ret) {
                    console.log('扣除房卡成功！')
                }
            }
        }
    }).run();
}

// //通知用户信息
exports.userMgrInMatch = (event, backData, matchID, userId, includingUserId, callback) => {
    userMgr.broacastMatch(event, backData, matchID, userId, includingUserId, () => {
        //人数已满,通知比赛开始！！
        callback(true)
    })
};

//获取单场比赛信息
exports.getMatchMsg = (matchId) => {
    return match_rooms[matchId]
};

//获取单场比赛的所有用户
exports.getMatchAllSeat = (matchId) => {
    return Object.keys(match_rooms[matchId].seat)
}

//获取所有比赛场的ID
exports.getMatchAllId = () => {
    // console.log('有多少比赛场', Object.keys(match_rooms), match_rooms)
    return Object.keys(match_rooms)
}

//判断比赛是否还可以报名
exports.getIfCanBaoming = (matchId) => {
    if (!matchId || matchId <= 0) {
        return
    }
    if (exports.getMatchPeopleNum(matchId) < match_rooms[matchId].people_limit) {
        return true
    } else {
        return false
    }
};

//新增用户
exports.addUserInMatch = (payment, addData) => {
    let userId = addData.data.userid
    let matchId = addData.matchId
    let userData = {
        payment: payment,
        match_score: score,
        name: addData.data.name,
        ip: addData.data.ip,
        gps: addData.data.gps,
        top: 0,
        turns: 0
    }
    if (addData.data[payment] >= match_rooms[matchId].consume[payment]) {
        match_rooms[matchId].seat[userId] = userData
        match_rooms[matchId].people_num++
        return true
        //足够支付报名费用
    } else {
        return false
        //不足支付报名费用
    }
};

//用户是否报名了某比赛场
exports.getMatchBaoming = (userId, matchId) => {
    if (userId <= 0 || matchId <= 0) {
        return
    }
    let match_seat = match_rooms[matchId].seat
    if (match_seat[userId] !== undefined) {
        return true
    } else {
        return false
    }
};

//返回比赛场信息和个人信息
exports.getMatchData = (userId) => {
    if (userId <= 0) {
        return
    }
    let backData = {
        isBaoming: false,
        matchID: null,
        matchData: null,
        userData: null
    }
    let matchAllId = exports.getMatchAllId()
    if (matchAllId.length > 0) {
        for (let i = 0; i < matchAllId.length; i++) {
            let match_seat = match_rooms[matchAllId[i]].seat
            if (match_seat[userId] !== undefined) {
                backData.isBaoming = true
                backData.matchID = matchAllId[i]
                if (match_rooms[matchAllId[i]].turns > 0) {
                    console.log('执行这里重新排名！！！！')
                    exports.sortRanking(matchAllId[i])
                }
                backData.matchData = match_rooms[matchAllId[i]]
                backData.userData = match_seat[userId]
                console.log('每轮结算详情玩家请求自己的比赛数据：'+userId,backData.userData);
            }
            if (i + 1 === matchAllId.length) {
                return backData
            }
        }
    } else {
        return backData
    }

};

//判断是否报名了其他的比赛场
exports.getIsBaoming = (userId) => {
    if (userId <= 0) {
        return
    }
    let isBaoming = false
    let matchAllId = exports.getMatchAllId()
    if (matchAllId.length > 0) {
        for (let i = 0; i < matchAllId.length; i++) {
            let match_seat = match_rooms[matchAllId[i]].seat
            if (match_seat[userId] !== undefined) {
                isBaoming = true
            }
            if (i + 1 === matchAllId.length) {
                return isBaoming
            }
        }
    } else {
        return isBaoming
    }
};

//获取单场比赛已经报名的人数
exports.getMatchPeopleNum = (matchId) => {
    if (!matchId || matchId <= 0) {
        return
    }
    let arr = exports.getMatchAllSeat(matchId)
    return arr.length
};

//对用户数据进行排序
exports.sortRanking = (matchId) => {
    if (matchId === null) {
        return
    }
    let seatsArr = exports.getMatchAllSeat(matchId)
    let needSortArr = []
    for (let i of seatsArr) {
        let data = {
            userid: i,
            match_score: match_rooms[matchId].seat[i].match_score
        }
        needSortArr.push(data)
    }
    let sortArr = map(sortBy(needSortArr, (item) => {
        return -item.match_score
    }), 'userid');
    //同步用户排名
    for (let i of sortArr) {
        match_rooms[matchId].seat[i].top = sortArr.indexOf(i) + 1
        console.log(`${i}的排名为${sortArr.indexOf(i) + 1}`)
    }
    return sortArr
}

