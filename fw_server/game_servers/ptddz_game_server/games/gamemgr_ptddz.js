'use strict';
var _ = require('lodash');

var roomMgr = require("../roommgr");
// var userMgr = require("../usermgr");
var userMgr = (require('../../../externals/game_utils/usermgr')).getUserMgr('ptddz');
var ddzutils = require('./ddzutils');
var commonUtils = require('../commonUtils');
var db = require('../../../externals/utils/dbsync');
var crypto = require('../../../externals/utils/crypto');
var fibers = require('fibers');
var games = {};

var ACTION_CHUPAI = 1;
var ACTION_OVER = 2;

var consts = require('../../../externals/utils/consts');
const GAMETYPE = consts.GameType.PTDDZ;
const GAMEMODE = consts.GameMode.NORM;
const CASH_CHANGE_RESONS = consts.CashChangeResons;

var gameSeatsOfUsers = {};

var userIdLocation = {};

var TUO_GUAN_TIME = 1000;//托管倒计时出牌


function shuffle(game) {

    var cards = game.cards;

    for (var i = 0; i < 54; ++i) {
        cards[i] = i;
    }

    for (var i = 0; i < cards.length; ++i) {
        var lastIndex = cards.length - 1 - i;
        var index = Math.floor(Math.random() * lastIndex);
        var t = cards[index];
        cards[index] = cards[lastIndex];
        cards[lastIndex] = t;
    }

    // game.cards = [
    //     3, 4, 5, 6, 7, 8, 9, 10,11,12,0, 1, 14,27,40,52,53,
    //     15,16,17,18,19,20,21,22,23,24,25,13,2, 49,50,51,39,
    //     28,29,30,31,32,33,34,35,36,37,38,26,44,45,46,47,48,
    //     41,42,43,
    // ];

    // game.cards = [
    //     52,53,37,11,49,48,47,20,7,44,18,5,43,28,2,15,16,
    //     27,40,1,39,13,38,50,35,22,9,32,33,34,19,30,4,29,
    //     0,39,14,28,3,29,17,6,45,8,21,10,23,36,24,12,51,
    //     46,25,31
    // ];



}

//发牌
function deal(game) {

    //每人17张 一共 17*3 ＝ 51张 剩下3张 地主牌
    for (var i = 0; i < game.gameSeats.length; ++i) {
        var holds = game.gameSeats[i].holds;
        if (holds == null) {
            holds = [];
        }
        holds = game.cards.slice(i * 17, (i + 1) * 17);
        game.gameSeats[i].holds = holds;
        //判断手牌中是否有双王4个2
        var tempCount1 = 0;
        var tempCount2 = 0;
        for (var j = 0; j < 17; j++) {//4个2
            if (holds[j] === 1
                || holds[j] === 14
                || holds[j] === 27
                || holds[j] === 40
            ) {
                tempCount1++;
            }
            if (holds[j] === 52 || holds[j] === 53) {//双王
                tempCount2++;
            }
        }
        // if (tempCount1 === 4 || tempCount2 === 2) {
        //     game.fourTwoSeat = game.gameSeats[i];
        // }
        if (tempCount2 === 2) {
            game.twoKing = game.gameSeats[i];
        }

    }
    game.dizhuPaiArr = game.cards.slice(51, 54);

}

//随机癞子牌（1--13）
function dealLZ(game) {
    var laiziValue = parseInt(Math.random() * 13) + 1;   //1--13
    //去重
    if (game.laiziPaiArr.length > 0 && game.laiziPaiArr[0] === laiziValue) {
        dealLZ(game);
    } else {
        game.laiziPaiArr.push(laiziValue);
    }
}

function doGameOver(game, userId, dissolve, tiQian) {
    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        return;
    }

    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }

    var results = [];
    var dbresult = [0, 0, 0];
    var resultData = {};

    var fnNoticeResult = function (isEnd) {
        var endinfo = null;
        if (isEnd || dissolve) {
            endinfo = [];
            for (var i = 0; i < roomInfo.seats.length; ++i) {
                var rs = roomInfo.seats[i];
                endinfo.push({
                    scores: rs.scoreOfRounds
                });
            }
            resultData.endinfo = endinfo;
        }
        userMgr.broacastInRoom('ddz_over_push', resultData, roomInfo, userId, true);
        //如果局数已够，则进行整体结算，并关闭房间
        if (isEnd || dissolve) {
            setTimeout(function () {
                fibers(function () {
                    if (roomInfo.numOfGames > 1) {
                        store_history(roomInfo);
                    }
                    userMgr.kickAllInRoom(roomInfo);
                    // //俱乐部房间游戏结束发送游戏数据到俱乐部聊天室
                    // if (roomInfo.conf.club_id > 0) {
                    //     roomMgr.sendMsgToClub(roomInfo.conf.club_id,resultData);
                    // }
                    roomMgr.destroy(roomId);
                    db.archive_games(GAMETYPE, GAMEMODE, roomInfo.uuid);
                }).run();
            }, 1500);
        }
    };
    if (game != null) {
        if (!dissolve) {
            //计算输赢分数
            var seatData = gameSeatsOfUsers[userId];
            var score = game.conf.baseScore * game.bei;

            if (seatData.isDizhu) {
                //春天
                if (game.nongOutCount === 0) {
                    score *= 2;
                    game.bei *= 2;
                }

                score *= 2;
                var other1 = game.gameSeats[(seatData.seatIndex + 1) % 3];
                var other2 = game.gameSeats[(seatData.seatIndex + 2) % 3];
                if (!tiQian) {
                    seatData.score += score;

                    other1.score -= score / 2;
                    other2.score -= score / 2;
                } else {
                    if (game.twoKing == game.gameSeats[seatData.seatIndex]) {
                        seatData.score += score;
                        other1.score -= score / 2;
                        other2.score -= score / 2;
                    } else {
                        seatData.score -= score;

                        other1.score += score / 2;
                        other2.score += score / 2;
                    }
                }
            } else {
                //反春天
                if (game.dizhuOutCount === 1) {
                    score *= 2;
                    game.bei *= 2;
                }

                var other1 = game.gameSeats[(seatData.seatIndex + 1) % 3];
                var other2 = game.gameSeats[(seatData.seatIndex + 2) % 3];
                seatData.score += score;
                if (other1.isDizhu) {
                    other2.score += score;
                    other1.score -= score * 2;
                } else {
                    other2.score -= score * 2;
                    other1.score += score;
                }
            }
        }

        for (var i = 0; i < roomInfo.seats.length; ++i) {
            var rs = roomInfo.seats[i];
            var sd = game.gameSeats[i];
            fibers(() => {
                db.add_games_and_scores(GAMETYPE, GAMEMODE, sd.userId, sd.score);
            }).run();

            rs.ready = false;
            rs.score += sd.score;
            rs.scoreOfRounds[roomInfo.numOfGames - 1] = sd.score;

            var userRT = {
                userId: sd.userId,
                isLoader: sd.isDizhu,
                // userName: crypto.toBase64(rs.name),//rs.name,
                bombCount: sd.bombCount,
                score: sd.score,
                paiArr: sd.holds,
                totalscore: rs.score,
                actions: sd.actions
            };

            results.push(userRT);

            dbresult[i] = sd.score;
        }
        resultData.results = results;
        resultData.bei = game.bei;

        game.state = 'over';

    }
    if (dissolve || game == null) {
        // console.log('game==null:值相等，类型不相等返回true')
        fnNoticeResult(true);
    }
    else {
        // console.log('game===null：值不相等，类型不相等返回false')

        // 回放添加结算页面，将每局结算数据存入数据库
        //  console.log("Log_Json",game.baseInfoJson)
        var baseInfo = JSON.parse(game.baseInfoJson);
        //  console.log("Log_baseInfo",baseInfo);
        // console.log('result:',results)
        baseInfo.results = results;
        baseInfo.ReplayData = {
            bei: game.bei,
            dizhuPaiArr: game.dizhuPaiArr,
            laiziPaiArr: game.laiziPaiArr,
        }
        //  console.log("Log_baseInfo_result",baseInfo);
        game.baseInfoJson = JSON.stringify(baseInfo);
        fibers(() => {
            //保存游戏
            var ret = store_game(game);
            if (ret) {
                db.update_game_result(GAMETYPE, GAMEMODE, roomInfo.uuid, game.gameIndex, dbresult);

                //记录打牌信息
                var str = JSON.stringify(game.actionList);
                db.update_game_action_records(GAMETYPE, GAMEMODE, roomInfo.uuid, game.gameIndex, str);

                //保存游戏局数
                db.update_num_of_turns(GAMETYPE, GAMEMODE, roomId, roomInfo.numOfGames);

                //如果是第一次
                if (roomInfo.numOfGames == 1) {
                    // db.cost_gems(game.gameSeats[0].userId,game.conf.cost);
                    if (roomInfo.conf.srzf) {
                        for (var i = 0; i < game.gameSeats.length; i++) {
                            db.cost_gems(game.gameSeats[i].userId,
                                roomInfo.conf.cost,
                                CASH_CHANGE_RESONS.COST_CREATE_ROOM.format(roomId));
                        }
                    }
                    // else if (!roomInfo.conf.dkfj) {
                    else {
                        fibers(() => {
                            db.cost_gems(game.gameSeats[0].userId,
                                roomInfo.conf.cost,
                                CASH_CHANGE_RESONS.COST_CREATE_ROOM.format(roomId));
                        }).run();
                    }
                }
                // else if (dissolve) {
                //     //代开房间第一局未结算直接申请解散，返还开房者房卡
                //     // console.log('roomInfo',roomInfo);
                //     if (roomInfo.numOfGames == 1) {
                //         if (roomInfo.conf.dkfj && !roomInfo.conf.club_id) {//俱乐部代开房间，且为AA支付时，不用返还开房者房卡
                //             // // 代开房间, 扣除开房者的房卡
                //             console.log('代开房间第一局申请解散返回开房者钻石', roomInfo.conf.creator);
                //             if (roomInfo.conf.creator) {
                //                 db.add_user_gems(roomInfo.conf.creator,
                //                     roomInfo.conf.cost,
                //                     CashChangeResons.RETURN_DISSOLVE_ROOM.format(roomId));
                //             } else {
                //                 console.log('代开房间返钻失败');
                //             }
                //         }
                //     }
                // }

                var isEnd = (roomInfo.numOfGames >= roomInfo.conf.maxGames);
                fnNoticeResult(isEnd);
            } else {
                console.log('store_game failure')
            }
        }).run();

    }
}
exports.doGameOver = doGameOver;

function recordUserAction(game, seatData, type, target) {
    var d = { type: type, targets: [] };
    if (target != null) {
        if (typeof (target) == 'number') {
            d.targets.push(target);
        }
        else {
            d.targets = target;
        }
    }
    else {
        for (var i = 0; i < game.gameSeats.length; ++i) {
            var s = game.gameSeats[i];
            if (i != seatData.seatIndex) {
                d.targets.push(i);
            }
        }
    }

    seatData.actions.push(d);
    return d;
}

function recordGameAction(game, si, action, pai) {
    game.actionList.push(si);
    game.actionList.push(action);
    if (pai != null) {
        game.actionList.push(pai);
    }
}

exports.setReady = function (userId, ready) {
    console.log('setReady:', userId)
    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }
    roomMgr.setReady(userId, true);
    var game = games[roomId];
    if (_.isUndefined(game) || game === null || game.state === 'over') {

        var playerCount = roomInfo.conf.playerCount;
        if (!playerCount) {
            playerCount = 3;
        }
        if (roomInfo.seats.length == playerCount) {
            var begin = true;
            for (var i = 0; i < roomInfo.seats.length; ++i) {
                var s = roomInfo.seats[i];
                if (s.ready == false) {
                    begin = false;
                    break;
                }
            }
            if (begin) {
                if (_.isUndefined(game)) {
                    roomInfo.firstEnter = true;
                }
                //人到齐了，并且都准备好了，则开始新的一局
                exports.begin(roomId);
                return;
            }
        }
    }
}
exports.gameSync = function (userId, isSync) {
    console.log('gameSync:', userId + '  :  ' + isSync)
    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }

    //通知还剩多少局
    userMgr.sendMsg(userId, 'ddz_game_num_push', roomInfo.numOfGames);
    var game = games[roomId];

    if (isSync && !(_.isUndefined(game) || game === null)) {
        var data = {};
        if (game.state === 'idle') {//初始状态
            data.state = 'idle';
            return;
        } else if (game.state === 'begin') {
            data.state = 'begin';
            return;
        } else if (game.state === 'jiaofen') {//叫分状态
            data.state = 'jiaofen';

            data.laizi = game.laiziPaiArr;
            data.left_round = (game.conf.maxGames - roomInfo.numOfGames);
            data.total_round = game.conf.maxGames;
            data.bei = game.bei;
            data.unused_paiArr = game.dizhuPaiArr;
            data.paiArr = gameSeatsOfUsers[userId].holds;

            data.curUserId = game.curUserId;
            data.nextUserId = game.nextUserId;
            data.jiaofenmodel = game.conf.jiaofenmodel;
            data.score = game.score;
            data.maxScore = game.score;

            data.jiaofenData = {};

            for (var i = 0; i < game.gameSeats.length; i++) {
                var _userId = game.gameSeats[i].userId;
                data.jiaofenData[_userId] = gameSeatsOfUsers[_userId].jiaofenScore;
            }

        } else if (game.state === 'chupai') {//出牌状态
            data.state = 'chupai';
            data.laizi = game.laiziPaiArr;
            data.left_round = (game.conf.maxGames - roomInfo.numOfGames);
            data.total_round = game.conf.maxGames;
            data.bei = game.bei;
            data.unused_paiArr = game.dizhuPaiArr;

            data.dizhu_uid = game.dizhuId;
            data.paiData = {};
            data.lastChuPaiData = {};
            data.tuoGuanList = {};

            for (var i = 0; i < game.gameSeats.length; i++) {
                var _userId = game.gameSeats[i].userId;
                if (_userId == userId) {
                    data.paiData[_userId] = gameSeatsOfUsers[_userId].holds;
                } else {
                    data.paiData[_userId] = gameSeatsOfUsers[_userId].holds.length;
                }
                data.lastChuPaiData[_userId] = gameSeatsOfUsers[_userId].lastChuPai;
                data.tuoGuanList[_userId] = exports.getUserTuoGuanState(_userId);
            }

            data.curUserId = game.curUserId;
            data.nextUserId = game.nextUserId;

            data.lastPaiData = game.lastPaiData;

            data.bei = game.bei;


        } else if (game.state === 'over') {//结束状态
            data.state = 'over';
            data.laizi = game.laiziPaiArr;
            data.left_round = (game.conf.maxGames - roomInfo.numOfGames);
            data.total_round = game.conf.maxGames;
            data.bei = game.bei;
            data.unused_paiArr = game.dizhuPaiArr;

            data.dizhu_uid = game.dizhuId;
            data.paiData = {};
            data.lastChuPaiData = {};

            for (var i = 0; i < game.gameSeats.length; i++) {
                var _userId = game.gameSeats[i].userId;
                data.paiData[_userId] = gameSeatsOfUsers[_userId].holds;
                data.lastChuPaiData[_userId] = gameSeatsOfUsers[_userId].lastChuPai;
            }


        }

        //同步整个信息给客户端
        userMgr.sendMsg(userId, 'ddz_sync_push', data);
        if (game.state === 'over') {
            //玩家断线重连恰好上局结束
            console.log('roomInfo.numOfGames', roomInfo.numOfGames);
            if (roomInfo.numOfGames > 0) {
                exports.setReady(userId);
            }
        }
    }


};

function store_single_history(userId, history) {
    var data = db.get_user_history(GAMETYPE, GAMEMODE, userId);

    if (data == null) {
        data = [];
    }
    while (data.length >= 10) {
        data.shift();
    }
    data.push(history);
    db.update_user_history(userId, data);
}

function store_history(roomInfo) {
    var seats = roomInfo.seats;
    var history = {
        uuid: roomInfo.uuid,
        id: roomInfo.id,
        time: roomInfo.createTime,
        seats: new Array(3)
    };

    for (var i = 0; i < seats.length; ++i) {
        var rs = seats[i];
        var hs = history.seats[i] = {};
        hs.userid = rs.userId;
        hs.name = crypto.toBase64(rs.name);
        hs.score = rs.score;
    }

    for (var i = 0; i < seats.length; ++i) {
        var s = seats[i];
        store_single_history(s.userId, history);
    }
}

function construct_game_base_info(game) {
    var baseInfo = {
        type: game.conf.type,
        button: game.button,
        index: game.gameIndex,
        cards: game.cards,
        game_seats: new Array(game.gameSeats.length),
        roomInfo: game.roomInfo.conf,
        results: game.results,
        ReplayData: null,
    }

    for (var i = 0; i < baseInfo.game_seats.length; ++i) {
        baseInfo.game_seats[i] = game.gameSeats[i].holds;
    }
    game.baseInfoJson = JSON.stringify(baseInfo);
}

function store_game(game) {

    return db.create_game(GAMETYPE, GAMEMODE, game.roomInfo.uuid, game.gameIndex, game.baseInfoJson);
}

//开始新的一局
exports.begin = function (roomId) {
    console.log('begin');
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }

    if (games[roomId]) {
        var lastGame = games[roomId];
        for (var i = 0; i < lastGame.gameSeats.length; i++) {
            var sd = lastGame.gameSeats[i];
            delete gameSeatsOfUsers[sd.userId];
        }
        delete games[roomId];
    }

    var seats = roomInfo.seats;

    var game = {
        conf: roomInfo.conf,
        roomInfo: roomInfo,
        gameIndex: roomInfo.numOfGames,
        cards: new Array(54),
        gameSeats: new Array(seats.length),
        state: "idle",
        //当前轮到玩家index
        turn: 0,
        //最终地主获得的3张牌
        dizhuPaiArr: [],
        //癞子牌
        laiziPaiArr: [],
        /*
         * 叫抢的标志:0--不叫、1--叫地主、2--抢地主、3--不抢
         * 叫分的标志:0--不叫、1--1分、2--2分、3--3分
         */
        score: 0,
        //叫抢的标志:0--不叫、1--叫地主、2--抢地主、3--不抢
        jiaoState: [-1, -1, -1],
        //当前游戏叫地主次数
        jiaoFenCount: 0,
        //地主Id
        dizhuId: null,
        //桌面上的最后出牌的玩家Id与牌
        lastPaiData: {
            userId: null,
            paiArr: []
        },
        //倍数
        bei: 1,
        //炸弹数
        curBombCount: 0,
        actionList: [],

        //地主出牌次数
        dizhuOutCount: 0,
        //农民出牌次数
        nongOutCount: 0,

        //重连数据记录
        curUserId: -1,
        nextUserId: -1,
    };

    roomInfo.numOfGames++;

    for (var i = 0; i < seats.length; ++i) {
        var data = game.gameSeats[i] = {};
        data.game = game;
        data.seatIndex = i;
        data.userId = seats[i].userId;
        data.isDizhu = false;
        //持有的牌
        data.holds = [];
        //打出的牌
        data.folds = [];
        //最后出的牌
        data.lastChuPai = null;
        data.bombCount = 0;
        data.actions = [];
        data.score = 0;
        data.jiaofenScore = -1;
        data.tuoguan = false;
        gameSeatsOfUsers[data.userId] = data;
    }

    games[roomId] = game;

    game.state = 'begin';
    userMgr.broacastInRoom('ddz_begin_push', {}, roomInfo, game.gameSeats[0].userId, true);
    //开始
    beginPlay(game);

    // setTimeout(function () {
    //     game.state = 'begin';
    //     userMgr.broacastInRoom('ddz_begin_push', {}, game.gameSeats[0].userId, true);
    //     //开始
    //     beginPlay(game);
    // },delayTime);


};

/**
 * 初始化数据 开始发牌
 * @param game
 */
function beginPlay(game) {

    game.cards = new Array(54);
    //当前轮到玩家index
    game.turn = parseInt(Math.random() * 3);
    //最终地主获得的3张牌
    game.dizhuPaiArr = [];
    //癞子牌
    game.laiziPaiArr = [];
    /*
     * 叫抢的标志:0--不叫、1--叫地主、2--抢地主
     * 叫分的标志:0--不叫、1--1分、2--2分、3--3分
     */
    game.score = 0;
    //本次游戏不叫地主次数
    game.noCallCount = 0;
    //地主Id
    game.dizhuId = null;
    //倍数
    game.bei = 1;

    game.jiaoFenCount = 0;
    game.jiaoState = [-1, -1, -1];

    for (var i = 0; i < game.gameSeats.length; ++i) {
        var data = game.gameSeats[i];
        data.isDizhu = false;
        //持有的牌
        data.holds = [];
        //打出的牌
        data.folds = [];
        //最后出的牌
        data.lastChuPai = null;
        data.bombCount = 0;
        data.actions = [];
        data.score = 0;
        data.jiaofenScore = -1;
    }

    //洗牌
    shuffle(game);
    //发牌
    deal(game);

    //天地癞子发牌时确认一张癞子牌
    if (game.conf['gamemodel'] === GAME_MODEL[2]) {
        dealLZ(game);
    }

    var seats = game.gameSeats;
    var roomInfo = game.roomInfo;
    console.log('beginPlay:');
    for (var i = 0; i < seats.length; ++i) {
        //开局时，通知前端必要的数据
        var s = seats[i];
        //天地癞子通知玩家癞子牌
        if (game.conf['gamemodel'] === GAME_MODEL[2]) {
            userMgr.sendMsg(s.userId, 'ddz_laizi_push', { laizi: game.laiziPaiArr });
        }

        //通知玩家手牌
        userMgr.sendMsg(s.userId, 'ddz_fapai_push', {
            left_round: (game.conf.maxGames - roomInfo.numOfGames), total_round: game.conf.maxGames,
            paiArr: seats[i].holds, unused_paiArr: game.dizhuPaiArr
        });

    }
    start(game);
}



function start(game) {
    console.log('start:');
    construct_game_base_info(game);

    //叫3分模式下,是否有人持有双王4个2
    // if(game.conf.fourTow && game.conf.jiaofenmodel === JIAO_FEN_MODEL[0] && game.fourTwoSeat){
    //     var seatData = game.fourTwoSeat;
    //     //叫3分，直接确认为地主
    //     seatData.isDizhu = true;
    //     //地主牌加到地主手里
    //     seatData.holds = seatData.holds.concat(game.dizhuPaiArr);

    //     game.turn = seatData.seatIndex;

    //     game.score = 3;

    //     game.bei = 3;

    //     //发送叫分消息
    //     sendJiaoFenMsg(seatData.userId, -1, game.conf.jiaofenmodel, 3, game);

    //     //通知叫地主结果
    //     sendDizhuMsg(seatData.userId, game);
    //     console.log('有双王4个2直接确认地主');
    //     return;
    // }

    var turnSeat = game.gameSeats[game.turn];
    //通知玩家叫地主
    sendJiaoFenMsg(turnSeat.userId, turnSeat.userId, game.conf.jiaofenmodel, game.score, game);
    game.state = 'jiaofen';
}

function sendJiaoFenMsg(curUserId, nextUserId, jiaofenmodel, score, game) {

    game.curUserId = curUserId;
    game.nextUserId = nextUserId;

    var jiaofen_data = {};
    jiaofen_data.curUserId = curUserId;
    jiaofen_data.nextUserId = nextUserId;
    jiaofen_data.jiaofenmodel = jiaofenmodel;
    jiaofen_data.score = score;
    jiaofen_data.maxScore = game.score;
    jiaofen_data.bei = game.bei;

    var roomId = roomMgr.getUserRoom(curUserId);
    var roomInfo = roomMgr.getRoom(roomId);
    userMgr.broacastInRoom('ddz_jiaofen_push', jiaofen_data, roomInfo, curUserId, true);
}
//发送确认地主身份消息
function sendDizhuMsg(dizhu_uid, game) {
    var roomId = roomMgr.getUserRoom(dizhu_uid);
    var roomInfo = roomMgr.getRoom(roomId);
    //判断是否为癞子斗地主
    if (game.conf['gamemodel'] !== GAME_MODEL[0]) {
        dealLZ(game);
        //通知癞子牌
        userMgr.broacastInRoom('ddz_laizi_push', { laizi: game.laiziPaiArr }, roomInfo, dizhu_uid, true);
    }
    //通知叫地主结果
    userMgr.broacastInRoom('ddz_dizhu_push', { dizhu_uid: dizhu_uid }, roomInfo, dizhu_uid, true);

    game.nextUserId = dizhu_uid;
    game.dizhuId = dizhu_uid;
    game.state = 'chupai';

}

function sendChuPaiMsg(curUserId, nextUserId, lastPaiData, paiArr, left_pai_cnt, game) {

    if (_.isArray(paiArr) && paiArr.length > 0) {
        if (curUserId === game.dizhuId) {
            game.dizhuOutCount++;
        } else {
            game.nongOutCount++;
        }
    }

    game.curUserId = curUserId;
    game.nextUserId = nextUserId;

    gameSeatsOfUsers[curUserId].lastChuPai = paiArr;

    var chupai_data = {};
    chupai_data.curUserId = curUserId;
    chupai_data.nextUserId = nextUserId;
    chupai_data.lastPaiData = lastPaiData;
    chupai_data.paiArr = paiArr;
    chupai_data.left_pai_cnt = left_pai_cnt;
    chupai_data.bei = game.bei;

    var roomId = roomMgr.getUserRoom(curUserId);
    var roomInfo = roomMgr.getRoom(roomId);
    //通知出牌
    userMgr.broacastInRoom('ddz_chupai_push', chupai_data, roomInfo, curUserId, true);
}

/**
 * 叫3分
 */
function jiao3Fen(game, score, seatData) {
    if (score > 0 && score <= game.score || score > 3) {
        userMgr.sendMsg(seatData.userId, 'ddz_jiaofen_push', { error: 1, msg: "jiaofen score error." });
        console.log("jiaofen score error");
        return;
    }

    if (score > game.score) {
        //记录地主userId
        game.dizhuId = seatData.userId;
    }

    seatData.jiaofenScore = score;

    if (score === 3) {
        //叫3分，直接确认为地主
        seatData.isDizhu = true;
        //地主牌加到地主手里
        seatData.holds = seatData.holds.concat(game.dizhuPaiArr);

        game.turn = seatData.seatIndex;

        if (score > game.score) {
            game.score = score;
        }

        // game.bei = score;
        game.bei = 1;//叫分只用于确定地主，不计算倍率

        //发送叫分消息
        sendJiaoFenMsg(seatData.userId, -1, game.conf.jiaofenmodel, score, game);

        //通知叫地主结果
        sendDizhuMsg(seatData.userId, game);

    } else {

        //叫分次数
        game.jiaoFenCount += 1;

        //3人都叫过分数
        if (game.jiaoFenCount === 3) {
            //3人都不叫
            if (score === 0 && game.score === 0) {

                //发送叫分消息
                sendJiaoFenMsg(seatData.userId, -1, game.conf.jiaofenmodel, score, game);

                //重新开始发牌
                beginPlay(game);
            } else {

                var dizhuSeatData = null;

                //记录当前分数
                if (score > game.score) {
                    game.score = score;
                    game.bei = score;
                    dizhuSeatData = seatData;
                } else {
                    dizhuSeatData = seatData;

                    for (var i = 0; i < game.gameSeats.length; i++) {
                        var _userId = game.gameSeats[i].userId;
                        if (gameSeatsOfUsers[_userId].jiaofenScore > dizhuSeatData.jiaofenScore) {
                            dizhuSeatData = gameSeatsOfUsers[_userId];
                        }
                    }
                }

                //确认地主
                dizhuSeatData.isDizhu = true;
                //地主牌加到地主手里
                dizhuSeatData.holds = dizhuSeatData.holds.concat(game.dizhuPaiArr);
                game.turn = dizhuSeatData.seatIndex;

                //发送叫分消息
                sendJiaoFenMsg(seatData.userId, -1, game.conf.jiaofenmodel, score, game);

                //通知叫地主结果
                sendDizhuMsg(dizhuSeatData.userId, game);

            }
        } else {

            //记录当前分数
            if (score > game.score) {
                game.score = score;
                game.bei = score;
            }

            //计算下一个叫地主玩家
            game.turn = (game.turn + 1) % 3;
            var turnSeat = game.gameSeats[game.turn];
            //发送叫分消息
            sendJiaoFenMsg(seatData.userId, turnSeat.userId, game.conf.jiaofenmodel, score, game);

        }

    }
}
/**
 * 不叫、不抢
 */
function buJiaoQiang(game, seatData, score) {
    //所有人叫地主状态
    var jiaoState = game.jiaoState;

    if (jiaoState[seatData.seatIndex] === 0
        || jiaoState[seatData.seatIndex] === 2) {

        userMgr.sendMsg(seatData.userId, 'ddz_jiaofen_push', { error: 1, msg: "jiaofen state error." });

        console.log('jiaofen state error：' + jiaoState[seatData.seatIndex]);
        return;
    }

    seatData.jiaofenScore = score;

    //上下家index
    var upIdx = (seatData.seatIndex + 2) % 3;
    var downIdx = (seatData.seatIndex + 1) % 3;

    //找出上下家
    var upState = jiaoState[upIdx];
    var downState = jiaoState[downIdx];
    var ownState = jiaoState[seatData.seatIndex];

    //设置为不叫、不抢状态
    jiaoState[seatData.seatIndex] = score;
    game.score = score;

    //上下家都不叫，重新发牌（不叫）
    if (upState === 0 && downState === 0) {
        //发送叫地主消息
        sendJiaoFenMsg(seatData.userId, -1, game.conf.jiaofenmodel, score, game);
        //重新发牌
        beginPlay(game);
        return;
    }

    //上下家都没叫过，轮到下家叫地主 | 上家不叫，下家未叫，轮到下家叫地主
    if (((upState === -1 || upState === 0) && downState === -1)
        || (upState === 1 && downState === -1)
        || (upState === 2 && downState === 1)) {
        //发送叫地主消息
        game.turn = downIdx;
        sendJiaoFenMsg(seatData.userId, game.gameSeats[downIdx].userId, game.conf.jiaofenmodel, score, game);
        return;
    }


    var dizhu = null;

    if (upState === 1 || upState === 2) {
        //地主
        dizhu = game.gameSeats[upIdx];
    }

    if (upState === 0 || upState === 3) {
        //地主
        dizhu = game.gameSeats[downIdx];
    }

    if (dizhu) {
        //确认地主
        dizhu.isDizhu = true;
        //地主牌加到地主手里
        dizhu.holds = dizhu.holds.concat(game.dizhuPaiArr);
        game.turn = dizhu.seatIndex;

        //发送叫分消息
        sendJiaoFenMsg(seatData.userId, -1, game.conf.jiaofenmodel, game.score, game);

        //通知叫地主结果
        sendDizhuMsg(dizhu.userId, game);

        return;
    }

    userMgr.sendMsg(seatData.userId, 'ddz_jiaofen_push', { error: 1, msg: "jiaofen state error." });
    console.log('++++++jiaofen state error');
}

/**
 * 叫地主
 */
function jiaoDiZhu(game, seatData, score) {

    //所有人叫地主状态
    var jiaoState = game.jiaoState;
    console.log('--seatData.seatIndex--', seatData.seatIndex)
    if (jiaoState[seatData.seatIndex] !== -1) {
        userMgr.sendMsg(seatData.userId, 'ddz_jiaofen_push', { error: 1, msg: "jiaofen state error." });

        console.log('叫地主状态错误：' + jiaoState[seatData.seatIndex]);
        return;
    }

    seatData.jiaofenScore = score;

    //上下家index
    var downIdx = (seatData.seatIndex + 1) % 3;

    //找出上下家
    var downState = jiaoState[downIdx];

    //设置当前状态为叫地主
    jiaoState[seatData.seatIndex] = score;
    game.score = score;

    //下家未叫地主，轮到下家叫地主
    if (downState === -1) {
        //发送叫地主消息
        game.turn = downIdx;
        sendJiaoFenMsg(seatData.userId, game.gameSeats[downIdx].userId, game.conf.jiaofenmodel, score, game);
        return;
    }

    //下家不叫，则直接为地主
    if (downState === 0) {
        //确认地主
        seatData.isDizhu = true;
        //地主牌加到地主手里
        seatData.holds = seatData.holds.concat(game.dizhuPaiArr);
        game.turn = seatData.seatIndex;

        //发送叫分消息
        sendJiaoFenMsg(seatData.userId, -1, game.conf.jiaofenmodel, game.score, game);

        //通知叫地主结果
        sendDizhuMsg(seatData.userId, game);
        return;
    }

    userMgr.sendMsg(seatData.userId, 'ddz_jiaofen_push', { error: 1, msg: "jiaofen state error." });
    console.log('叫地主状态错误--叫');

}
/**
 * 抢地主
 */
function qiangDiZhu(game, seatData, score) {
    //所有人叫地主状态
    var jiaoState = game.jiaoState;

    if (jiaoState[seatData.seatIndex] !== -1 && jiaoState[seatData.seatIndex] !== 1) {
        userMgr.sendMsg(seatData.userId, 'ddz_jiaofen_push', { error: 1, msg: "jiaofen state error." });
        console.log('叫地主状态错误：' + jiaoState[seatData.seatIndex]);
        return;
    }

    seatData.jiaofenScore = score;

    //上下家index
    var upIdx = (seatData.seatIndex + 2) % 3;
    var downIdx = (seatData.seatIndex + 1) % 3;

    //找出上下家
    var upState = jiaoState[upIdx];
    var downState = jiaoState[downIdx];
    var ownState = jiaoState[seatData.seatIndex];

    //设置当前状态
    jiaoState[seatData.seatIndex] = score;
    game.score = score;

    //上家叫地主，下家不叫，则轮到上家抢地主
    if (upState === 1 && downState === 0) {
        game.turn = upIdx;
        //发送抢地主消息
        sendJiaoFenMsg(seatData.userId, game.gameSeats[upIdx].userId, game.conf.jiaofenmodel, score, game);
        return;
    }

    //上家叫地主,下家未叫地主，轮到下家抢地主 | 上家不抢,下家叫，轮到下家抢
    if ((upState === 1 && downState === -1)
        || (upState === 3 && downState === 1)
        || (upState === 2 && downState === 1)
    ) {
        game.turn = downIdx;
        //发送抢地主消息
        sendJiaoFenMsg(seatData.userId, game.gameSeats[downIdx].userId, game.conf.jiaofenmodel, score, game);
        return;
    }

    //自己叫过地主，自己为地主
    if (ownState === 1) {
        //确认地主
        seatData.isDizhu = true;
        //地主牌加到地主手里
        seatData.holds = seatData.holds.concat(game.dizhuPaiArr);
        game.turn = seatData.seatIndex;

        //发送叫分消息
        sendJiaoFenMsg(seatData.userId, -1, game.conf.jiaofenmodel, score, game);

        //通知叫地主结果
        sendDizhuMsg(seatData.userId, game);
        return;
    }

    userMgr.sendMsg(seatData.userId, 'ddz_jiaofen_push', { error: 1, msg: "jiaofen state error." });
    console.log('叫地主状态错误--抢');
}

exports.jiaofen = function (userId, data) {

    var seatData = gameSeatsOfUsers[userId];
    if (seatData == null) {
        userMgr.sendMsg(userId, 'ddz_jiaofen_push', { error: 1, msg: "can't find user game data." });
        console.log("can't find user game data.");
        return;
    }

    var game = seatData.game;

    if (game.turn != seatData.seatIndex) {
        userMgr.sendMsg(userId, 'ddz_jiaofen_push', { error: 1, msg: "jiaofen index error." });
        console.log("jiaofen index error");
        return;
    }

    var score = Number.parseInt(data.score);
    if (game.conf.jiaofenmodel === JIAO_FEN_MODEL[0]) {
        //叫3分模式
        jiao3Fen(game, score, seatData);
        // if(score==3){//三人斗地主双王不直接赢
        //     if(game.twoKing){
        //         doGameOver(game,userId,false,true);
        //     }
        // }

    } else if (game.conf.jiaofenmodel === JIAO_FEN_MODEL[1]) {
        //抢地主模式
        switch (score) {
            case 0: //不叫
            case 3: //不抢
                buJiaoQiang(game, seatData, score);
                break;
            case 1: //叫地主
                jiaoDiZhu(game, seatData, score);
                break;
            case 2: //抢地主
                game.bei = game.bei * 2;
                qiangDiZhu(game, seatData, score);
                break;
        }
    }


};

exports.getJushuCost = function (jushu, FZzhifu) {
    if (FZzhifu) {
        return JU_SHU_COST[jushu];
    } else {
        if (jushu >= 0 && jushu < JU_SHU_COST_AA.length)
            return JU_SHU_COST_AA[jushu] * 3;
    }

    return Math.MAX_VALUE;
};

exports.chaoJiJiaBei = function (userId) {

    game.bei *= 2;

    var data = {
        bei: game.bei,
        userId: userId
    }

    userMgr.broacastInRoom('chaoJiJiaBei_push', data, userId, true);
}

exports.chuPai = function (userId, data) {

    var seatData = gameSeatsOfUsers[userId];
    if (seatData == null) {
        userMgr.sendMsg(seatData.userId, 'ddz_chupai_push', { error: 1, msg: "can't find user game data." });
        console.log("can't find user game data.");
        return;
    }

    var game = seatData.game;
    var seatIndex = seatData.seatIndex;

    //此局游戏结束
    if (game.state === 'end') {
        console.log("game over.");
        userMgr.sendMsg(seatData.userId, 'ddz_chupai_push', { error: 1, msg: "game over." });
        return;
    }

    //如果不该他出，则忽略
    if (game.turn != seatIndex) {
        userMgr.sendMsg(seatData.userId, 'ddz_chupai_push', { error: 1, msg: "not your turn." });
        console.log("not your turn.");
        return;
    }

    var paiArr = data.paiArr;

    //不出
    if (paiArr.length === 0) {
        if (!game.lastPaiData.userId || game.lastPaiData.userId === userId) {
            userMgr.sendMsg(seatData.userId, 'ddz_chupai_push', { error: 1, msg: "chupai index error." });
            console.log("出牌错误，最后出牌玩家必须出牌.");
        } else {
            //此玩家不出，计算下一个出牌玩家，通知所有玩家
            game.turn = (game.turn + 1) % 3;
            var turnSeat = game.gameSeats[game.turn];
            //发送出牌消息
            sendChuPaiMsg(seatData.userId, turnSeat.userId, game.lastPaiData, paiArr, seatData.holds.length, game);
            console.log(new Date().getHours() + ':' + new Date().getMinutes() + ':' + '记录玩家：' + seatData.userId + ' 出牌：' + paiArr);
            recordGameAction(game, seatData.seatIndex, ACTION_CHUPAI, paiArr);

            console.log('玩家托管状态：', gameSeatsOfUsers[turnSeat.userId].tuoguan);
            if (gameSeatsOfUsers[turnSeat.userId].tuoguan) {
                exports.autoChupai(turnSeat, game);
            }
        }
        return;
    }

    //判断此人手中是否含有出的牌
    var tempArr = [];
    for (var i = 0; i < paiArr.length; i++) {
        tempArr[i] = paiArr[i] % 100;
    }

    var contained = commonUtils.isContained(seatData.holds, tempArr);
    if (!contained) {
        userMgr.sendMsg(seatData.userId, 'ddz_chupai_push', { error: 1, msg: "not cards error." });
        console.log("出牌错误，出牌与玩家手牌冲突.");
        return;
    }


    //出牌，验证出牌是否合法(牌型、大小)
    if (game.lastPaiData.userId !== userId) {
        var resultTypes = ddzutils.checkCards(game.lastPaiData.paiArr, tempArr, false, game.laiziPaiArr);
        if (resultTypes.length <= 0) {
            userMgr.sendMsg(seatData.userId, 'ddz_chupai_push', { error: 1, msg: "not resultTypes error." });
            console.log("出牌错误，牌型与桌上牌型大小或类型不匹配.");
            return;
        }
    }
    var playerCardType = ddzutils.judgeType(paiArr);
    if (playerCardType === ddzutils.CardType.c0) {
        userMgr.sendMsg(seatData.userId, 'ddz_chupai_push', { error: 1, msg: "error resultTypes." });
        console.log("出牌错误，牌型错误.");
        return;
    }

    //从此人牌中扣除
    var result = seatData.holds.filter(item => {
        return tempArr.indexOf(item) < 0;
    });
    seatData.holds = result;

    //更新数据
    game.lastPaiData.userId = userId;
    game.lastPaiData.paiArr = paiArr;

    if (playerCardType === ddzutils.CardType.c4
        || playerCardType === ddzutils.CardType.c42) {
        game.curBombCount++;
        if (game.curBombCount <= game.conf.maxbombcount) {
            game.bei *= 2;
        }
        seatData.bombCount += 1;
    }


    console.log(new Date().getHours() + ':' + new Date().getMinutes() + ':' + '记录玩家：' + seatData.userId + ' 出牌：' + paiArr);
    recordGameAction(game, seatData.seatIndex, ACTION_CHUPAI, paiArr);

    //判断扣除牌后是否打完，打完则没有下一个人出牌了
    if (result.length === 0) {
        sendChuPaiMsg(seatData.userId, -1, game.lastPaiData, paiArr, seatData.holds.length, game);
        console.log(new Date().getHours() + ':' + new Date().getMinutes() + ':' + '玩家：' + seatData.userId + ' 出牌：' + paiArr + ' 牌打完游戏结束');
        recordGameAction(game, seatData.seatIndex, ACTION_OVER, -1);
        //游戏结算
        // setTimeout(function () {
        doGameOver(game, userId);
        // }, 500);

    } else {
        game.turn = (game.turn + 1) % 3;
        var turnSeat = game.gameSeats[game.turn];
        sendChuPaiMsg(seatData.userId, turnSeat.userId, game.lastPaiData, paiArr, seatData.holds.length, game);
        //下一个用户为托管的话 时间一到 自动打牌
        console.log('玩家托管状态 出：', gameSeatsOfUsers[turnSeat.userId].tuoguan);
        if (gameSeatsOfUsers[turnSeat.userId].tuoguan) {
            exports.autoChupai(turnSeat, game);
        }
    }

};
exports.setUserTuoGuanState = function (userId, tuoguan) {
    console.log('用户托管' + userId, tuoguan);
    if (gameSeatsOfUsers[userId] != null) {
        gameSeatsOfUsers[userId].tuoguan = tuoguan;
        var game = gameSeatsOfUsers[userId].game;
        var turnSeat = game.gameSeats[game.turn];
        if (game && userId == turnSeat.userId && tuoguan) {//点击准备时，如果是自己出牌则自动出牌
            console.log('玩家点击准备 且是自己出牌 则自动出牌：');
            exports.autoChupai(turnSeat, game);
        }
    }
};
exports.getUserTuoGuanState = function (userId) {
    return gameSeatsOfUsers[userId].tuoguan;
};
exports.autoChupai = function (turnSeat, game) {
    //玩家托管，自动打牌
    console.log('玩家 ' + turnSeat.userId + ' 托管，5s后自动打牌');
    setTimeout((turnSeat, game) => {
        var lastPaiData = game.lastPaiData
        if (turnSeat.userId != game.dizhuId && lastPaiData.userId != turnSeat.userId && lastPaiData.userId != game.dizhuId) {//农民队友
            var resultCards = [];
        } else {
            var playerCardType = ddzutils.judgeType(lastPaiData.paiArr);
            var mycards = gameSeatsOfUsers[turnSeat.userId].holds;
            // console.log('mycards', mycards);
            // console.log('paiArr', lastPaiData.paiArr);
            // console.log('playerCardType', playerCardType);
            if (lastPaiData.userId == turnSeat.userId || lastPaiData.paiArr.length == 0) {//1.上一把是自己出的；2.地主一开始就托管
                var resultCards = ddzutils.getPromptCards([41], mycards, false);
                var mycardType = ddzutils.judgeType(mycards);
                if (ddzutils.availableCardTypes.indexOf(mycardType) != -1 &&
                    mycardType != ddzutils.CardType.c1112223344 &&
                    mycardType != ddzutils.CardType.c32 && mycardType != ddzutils.CardType.c422) {
                    resultCards = [mycards];//最后自己出牌  如果剩余牌能组成牌型则全部出完
                }

            } else {
                var resultCards = ddzutils.getPromptCards(lastPaiData.paiArr, mycards, false);
            }
            // console.log('resultTypes:', resultCards);
            resultCards = resultCards.length == 0 ? [] : resultCards[0];
        }
        exports.chuPai(turnSeat.userId, { paiArr: resultCards });
    }, TUO_GUAN_TIME, turnSeat, game);//TUO_GUAN_TIME
}

exports.isPlaying = function (userId) {
    var seatData = gameSeatsOfUsers[userId];
    if (seatData == null) {
        return false;
    }

    var game = seatData.game;

    if (game.state == "idle") {
        return false;
    }
    return true;
};


exports.syncLocation = function (userId) {

    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        console.log('没有找到房间id');
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        console.log('没有找到房间');
        return;
    }

    var data = [];

    for (var i = 0; i < roomInfo.seats.length; ++i) {
        var rs = roomInfo.seats[i];
        var loc = userIdLocation[rs.userId];
        if (loc != null) {
            data.push({ userId: rs.userId, location: loc });
        }
    }
    // console.log('给客户端回传的位置信息:', data);
    if (data.length >= 2) {
        userMgr.broacastInRoom('location_push', data, roomInfo, userId, true);
    }
};

exports.setLocation = function (userId, location) {
    userIdLocation[userId] = location;
    exports.syncLocation(userId);
};

exports.hasBegan = function (roomId) {
    var game = games[roomId];
    if (game != null) {
        return true;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo != null) {
        return roomInfo.numOfGames > 0;
    }
    return false;
};

exports.deletehasBegan = function (roomId) {//代开房间删除判断
    var game = games[roomId];
    if (game != null) {
        return true;
    }

    var roomInfo = roomMgr.getRoom(roomId);

    if (roomInfo != null) {
        let index = roomInfo.seats.length;
        for (let i = 0; i < index; i++) {
            if (roomInfo.seats[i].userId > 1) {
                return true;
            }
        }
    }
    return false;
};


var DI_FEN = [1, 2, 5, 10, 20, 30, 50, 100, 200];
var JIAO_FEN_MODEL = { 0: 'jiao3Fen', 1: 'qiangDizhu' }; //0--叫3分、1--抢地主
var GAME_MODEL = { 0: 'jingdian', 1: 'laizi', 2: 'tiandilz' }; //0--经典、1--癞子、2--天地癞子
var MAX_BEI_SHU = [8, 16, 32];
var MAX_BOMB_COUNT = [100000, 2, 3, 4];
var REN_SHU = [2, 3, 4];
var JU_SHU = [5, 10, 15];
var JU_SHU_COST = [3, 6, 9];

// 非AA情况下房卡消耗 等于 AA下房卡消耗 * 人数 2,3,4
var JU_SHU_COST_AA = [1, 2, 3]; // AA情况下房卡消耗
// var JU_SHU_COST_AA = [0, 0, 0]; // AA情况下房卡消耗

exports.checkConf = function (roomConf, gems) {
    if (
        roomConf.type === null
        || roomConf.jushuxuanze === null
        || roomConf.difen === null
        || roomConf.xuanzezhifu === null
        || roomConf.dkfj === null
        || roomConf.srzf === null
        || roomConf.jiaofenmodel === null
        || roomConf.gamemodel === null
    ) {
        return 1;
    }

    if (roomConf.jushuxuanze < 0 || roomConf.jushuxuanze >= JU_SHU.length) {
        return 1;
    }

    if (roomConf.jiaofenmodel < 0 || !JIAO_FEN_MODEL[roomConf.jiaofenmodel]) {
        return 1;
    }
    if (roomConf.gamemodel < 0 || !GAME_MODEL[roomConf.gamemodel]) {
        return 1;
    }
    if (roomConf.difen < 0 || roomConf.difen > DI_FEN.length) {
        return 1;
    }

    var cost;
    if (roomConf.srzf) {
        cost = JU_SHU_COST_AA[roomConf.jushuxuanze];
    } else {
        cost = JU_SHU_COST[roomConf.jushuxuanze];
    }
    if (cost > gems) {
        return 2222;
    }
    return 0;
}

exports.getConf = function (roomConf, creator) {
    // 房卡消耗
    // AA模式下, 8局每人消耗一张; 16局每人消耗两张
    // 非AA模式, 消耗 4, 8 张
    var cost;
    if (roomConf.srzf) {
        cost = JU_SHU_COST_AA[roomConf.jushuxuanze];
    } else {
        cost = JU_SHU_COST[roomConf.jushuxuanze];
    }

    return {
        type: roomConf.type, //游戏类型-斗地主
        jiaofenmodel: JIAO_FEN_MODEL[roomConf.jiaofenmodel],   //选择地主模式
        gamemodel: GAME_MODEL[roomConf.gamemodel], //游戏模式
        baseScore: roomConf.difen <= 0 ? 1 : DI_FEN[roomConf.difen],   //DI_FEN[roomConf.difen]//底分
        maxBei: !roomConf.maxBei ? 100000 : MAX_BEI_SHU[roomConf.maxBei],  //封顶倍数
        maxbombcount: !roomConf.maxbombcount ? 100000 : MAX_BOMB_COUNT[roomConf.maxbombcount],  //封顶炸弹数
        fourTow: roomConf.fourTow,  //双王或者4个2直接经典模式叫分时只显示叫3分为地主
        playerCount: roomConf.numOfPlayers,   //玩家人数
        maxGames: JU_SHU[roomConf.jushuxuanze],  //最大局数
        cost: cost,  //消费房卡数
        creator: creator, //创建者

        //---新增---
        dkfj: roomConf.dkfj, // 代开房间
        srzf: roomConf.srzf,	// 4人支付 AA支付
        xuanzezhifu: roomConf.xuanzezhifu,
        checkIP: roomConf.checkIP,
        daojuStrict: roomConf.daojuStrict,

        club_id: roomConf.club_id ? roomConf.club_id : 0,
    }
}

var dissolvingList = [];

exports.doDissolve = function (roomId) {
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return null;
    }

    var game = games[roomId];
    doGameOver(game, roomInfo.seats[0].userId, true);
};

exports.dissolveRequest = function (roomId, userId) {
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return null;
    }

    if (roomInfo.dr != null) {
        return null;
    }

    var seatIndex = roomMgr.getUserSeat(userId);
    if (seatIndex == null) {
        return null;
    }

    roomInfo.dr = {
        endTime: Date.now() + 30000,
        states: [false, false, false]
    };
    roomInfo.dr.states[seatIndex] = true;

    dissolvingList.push(roomId);

    return roomInfo;
};

exports.dissolveAgree = function (roomId, userId, agree) {
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return null;
    }

    if (roomInfo.dr == null) {
        return null;
    }

    var seatIndex = roomMgr.getUserSeat(userId);
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

function update() {
    for (var i = dissolvingList.length - 1; i >= 0; --i) {
        var roomId = dissolvingList[i];
        var roomInfo = roomMgr.getRoom(roomId);
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

setInterval(update, 1000);