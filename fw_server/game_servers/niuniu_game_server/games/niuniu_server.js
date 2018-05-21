var Server = {};
exports.Server = Server;

var NetAdapter = require("./niuniu_msg_adapter").NetAdapter;
var ChanCheConfig = require("./niuniu_config").ChanCheConfig;
// var SingleSimulator = require("./niuniu_single_simulator").SingleSimulator;
var GameLogic = require("./niuniu_logic");
var userMgr = (require('../../../externals/game_utils/usermgr')).getUserMgr('niuniu');
var db = require("../../../externals/utils/dbsync");
var roomMgr = require("../roommgr");
var consts = require("../../../externals/utils/consts");
var fibers = require('fibers');
var SingleSimulator = null;

const CASH_CHANGE_RESONS = consts.CashChangeResons;

var cardPool = [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D,
    0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D,
    0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D,
    0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D
];

var tempcardPool = [];

var WanFaNiuNiuShangZhuang = {};
var WanFaGuDingZhuangJia = {};
var WanFaZiYouQiangZhuang = {};
var WanFaMingPaiQiangZhuang = {};
var WanFaTongBiNiuNiu = {};

const WAIT_QIANG_ZHUANG = 10 + 1;
const WAIT_XIA_ZHU = 20 + 1;
const WAIT_LIANG_PAI = 20 + 1;
const WAIT_READY = 15 + 1;

function struct_Player() {
    var ret = {};
    ret.chairId = 0;
    ret.cards = [];
    ret.yaScore = 0;
    ret.hasOperate = false;
    ret.multiple = 0;
    ret.hasCuoPai = false;
    ret.joined = false;
    return ret;
};

function clear(self) {
    self.data.state = ChanCheConfig.Enum.GAME_STATE_UNKNOWN;
    self.data.bankerChairId = -2;
    self.data.players = [];
    self.data.cards = [];
    self.data.results = [];
}

function reset(self) {
    if (!self.data) {
        self.data = {};
        self.data.wanFaWrapper = WanFaNiuNiuShangZhuang;
    }
    if (!self.config) {
        self.config = {};
        self.config.maxPlayer = 6;
        self.config.maxplayModePlayer = ChanCheConfig.Enum.GAME_MODE_NIUNIUSHANGZHUANG;
        self.config.batLv = 0;
        self.config.specialTypeOnOff = null;
    }
    self.data.state = ChanCheConfig.Enum.GAME_STATE_UNKNOWN;
    self.data.bankerChairId = -2;
    self.data.players = [];
    self.data.cards = [];
    self.data.results = [];
    for (var i = 0; i < self.config.maxPlayer; ++i) {
        var player = struct_Player();
        self.data.players[i] = player;
        player.chairId = i;
    }
};

function isRobot(server, chairId) {
    return false;
    // return !userMgr.isOnline(server.roomInfo.seats[chairId].userId);
}

function shuffle() {
    GameLogic.randomCards(cardPool);
}

function canDeal(cards, conf) {
    var ret = GameLogic.analyseChanCheCards(cards);
    if (!ret) {
        return true;
    }
    if (!conf.yin && ret.type == ChanCheConfig.Enum.CHAN_CHE_TYPE_YIN_CHAN) {
        return false;
    } else if (!conf.jin && ret.type == ChanCheConfig.Enum.CHAN_CHE_TYPE_JIN_CHAN) {
        return false;
    } else if (!conf.zhiZun && ret.type == ChanCheConfig.Enum.CHAN_CHE_TYPE_ZHI_ZUN_CHAN) {
        return false;
    }
    return true;
}

function deal(self) {
    tempcardPool = [];
    var roomid = self.roomInfo.id;
    for (var j in cardPool) {
        tempcardPool[j] = cardPool[j];
    }

    for (var i = 0; i < self.data.players.length; ++i) {
        if (self.data.players[i].joined) {
            var player = self.data.players[i];
            player.cards = cardPool.slice(i * 5, (i + 1) * 5);
            tempcardPool.splice(i * 5, (i + 1) * 5);

        }
    }
    var list = self.roomInfo.seats;
    if (list) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].userId > 0) {
                var qut = db.finduserid(list[i].userId);
                if (qut) {
                    if (qut[0].mark = 1) {
                console.log("---------i"+i);
                console.log("----i"+list[i].userId);
               userMgr.sendMsg(list[i].userId,"push_mark",list[i].userId);
                    }
                }
            }
        }
    }

   
    roomMgr.savecard(roomid, tempcardPool);


}

function pushGameBegin(self) {
    self.data.wanFaWrapper.pushGameBegin(self);
};

function autoFinishOperate(self) {
    if (self.data.state == ChanCheConfig.Enum.GAME_STATE_QIANG_ZHUANG) {
        for (var i = 0; i < self.data.players.length; ++i) {
            var player = self.data.players[i];
            if (player.joined && !player.hasOperate) {
                callZhuang(self, player.chairId, 0);
            }
        }
    } else if (self.data.state == ChanCheConfig.Enum.GAME_STATE_YA_FEN) {
        var scoreArr = ChanCheConfig.yaFen[self.config.playMode][self.config.batLv];
        var batScore = scoreArr[0];
        for (var i = 0; i < self.data.players.length; ++i) {
            var player = self.data.players[i];
            if (player.joined && !player.hasOperate && player.chairId != self.data.bankerChairId) {
                stake(self, player.chairId, batScore);
            }
        }
    } else if (self.data.state == ChanCheConfig.Enum.GAME_STATE_KAN_PAI) {
        for (var i = 0; i < self.data.players.length; ++i) {
            var player = self.data.players[i];
            if (player.joined && !player.hasOperate) {
                showCards(self, player.chairId);
            }
        }
    } else if (self.data.state == ChanCheConfig.Enum.GAME_STATE_UNKNOWN) {
        for (var i = 0; i < self.roomInfo.seats.length; ++i) {
            var seat = self.roomInfo.seats[i];
            if (seat.userId > 0 && !seat.ready) {
                roomMgr.setReady(seat.userId, true);
            }
        }
        if (self.roomInfo.autoTimeId) {
            self.roomInfo.autoTimeId = null;
        }
    }
}

function autoOperateAll(self, time) {
    var waitTime = time * 1000;
    if (self.autoTimeId) {
        clearTimeout(self.autoTimeId);
        self.autoTimeId = null;
    }
    self.autoTimeId = setTimeout(function () {
        fibers(function () {
            autoFinishOperate(this);
        }.bind(this)).run();
    }.bind(self), waitTime);
}



function callZhuang(self, chairId, multiple) {
    var player = self.data.players[chairId];
    if (!player) {
        console.log("error, player " + chairId + " is not exist!");
        return;
    }
    if (player.hasOperate) {
        console.log("player " + chairId + " has operated!");
        return;
    }
    if (self.data.state != ChanCheConfig.Enum.GAME_STATE_QIANG_ZHUANG) {
        console.log("player " + chairId + " phase error!");
        return;
    }
    self.data.wanFaWrapper.callZhuang(self, chairId, multiple);
};





function genBanker(self) {
    self.data.wanFaWrapper.genBanker(self);
}





function isPlayerValid(server, chairId) {
    var s = server.roomInfo.seats[chairId];
    if (!s) {
        return false;
    }
    return s.userId > 0;
}

function broadcastTablePlayer(self, msg, data) {
    for (var i = 0; i < self.data.players.length; ++i) {
        var player = self.data.players[i];
        if (!isRobot(self, player.chairId) && isPlayerValid(self, i)) {
            NetAdapter.sendMsg(self, i, msg, data);
        }
    }
};

function isAllOperate(self) {
    for (var i = 0; i < self.data.players.length; ++i) {
        if (isPlayerValid(self, i)) {
            if (!self.data.players[i].hasOperate && self.data.players[i].joined)
                return false;
        }
    }
    return true;
};

function clearOperates(self) {
    if (!self) {
        return;
    }
    if (self.autoTimeId) {
        clearTimeout(self.autoTimeId);
        self.autoTimeId = null;
    }

    for (var i = 0; i < self.data.players.length; ++i) {
        if (isPlayerValid(self, i)) {
            self.data.players[i].hasOperate = false;
        }
    }
};

function pushBankerConfirm(self) {
    self.data.wanFaWrapper.pushBankerConfirm(self);
};



function getTuiZhuScore(self, chairId) {
    var tuiZhu = self.roomInfo.conf.tuiZhu;
    if (tuiZhu == null || tuiZhu == 0) {
        return 0;
    }
    var scoreArr = ChanCheConfig.yaFen[self.config.playMode][self.config.batLv];
    var maxYaFen = scoreArr[scoreArr.length - 1];
    var maxTuiZhuScore = maxYaFen * tuiZhu;
    var lastWin = self.roomInfo.seats[chairId].lastWin;
    if (lastWin > 0) {
        return Math.min(lastWin + maxYaFen, maxTuiZhuScore);
    }
    return 0;
}

function stake(self, chairId, score) {
    var player = self.data.players[chairId];
    if (!player) {
        console.log("error, player " + chairId + " is not exist!");
        return;
    }
    if (player.hasOperate) {
        console.log("player " + chairId + " has operated!");
        return;
    }
    if (!player.joined) {
        return;
    }
    if (score < 0) {
        console.log("player " + chairId + " input is not valid!");
        return;
    }
    if (self.data.state != ChanCheConfig.Enum.GAME_STATE_YA_FEN) {
        console.log("player " + chairId + " phase error!");
        return;
    }
    var scoreArr = ChanCheConfig.yaFen[self.config.playMode][self.config.batLv];
    var valid = false;
    for (var i = 0; i < scoreArr.length; ++i) {
        if (scoreArr[i] == score) {
            valid = true;
            break;
        }
    }

    if (score > 0 && score == getTuiZhuScore(self, chairId)) {
        valid = true;
        player.tuiZhu = true;
    }

    if (!valid) {
        console.log("player " + chairId + " input is not valid!");
        return;
    }

    player.hasOperate = true;
    player.yaScore = score;

    self.data.wanFaWrapper.stake(self, chairId, score);
};

function pushStakeOver(self) {
    self.data.wanFaWrapper.pushStakeOver(self);
};

function showCards(self, chairId) {
    var player = self.data.players[chairId];
    if (!player) {
        console.log("error, player " + chairId + " is not exist!");
        return;
    }
    if (!player.joined) {
        return;
    }
    if (player.hasOperate) {
        console.log("player " + chairId + " has operated!");
        return;
    }
    if (self.data.state != ChanCheConfig.Enum.GAME_STATE_KAN_PAI) {
        console.log("player " + chairId + " phase error!");
        return;
    }

    player.hasOperate = true;

    broadcastTablePlayer(self, "push_show_cards", {
        chair_id: chairId,
        cards: player.cards,
        multi: genCardsMulti(self, player.cards)
    });

    if (isAllOperate(self)) {
        self.gameOver();
    }
};

function genResult(self) {
    self.data.wanFaWrapper.genResult(self);
};

function pushGameOver(self) {
    broadcastTablePlayer(self, "push_game_over", self.data.results);
};

Server.init = function (config) { //获取config数据
    reset(this);
    this.config.maxPlayer = config.maxPlayer;
    this.config.playMode = config.playMode;
    var wanFaArray = [WanFaNiuNiuShangZhuang, WanFaGuDingZhuangJia, WanFaZiYouQiangZhuang, WanFaMingPaiQiangZhuang, WanFaTongBiNiuNiu];
    if (config.playMode >= 0 || config.config.playMode < 5) {
        this.data.wanFaWrapper = wanFaArray[config.playMode];
    } else {
        console.log("error,玩法选项参数错误");
    }
    this.config.batLv = config.batLv;
    this.config.specialTypeOnOff = [];
    this.config.specialTypeOnOff[0] = this.roomInfo.conf.shunziniu;
    this.config.specialTypeOnOff[1] = this.roomInfo.conf.wuhuaniu;
    this.config.specialTypeOnOff[2] = this.roomInfo.conf.tonghuaniu;
    this.config.specialTypeOnOff[3] = this.roomInfo.conf.huluniu;
    this.config.specialTypeOnOff[4] = this.roomInfo.conf.zhadanniu;
};

function compareCards(server, cards1, cards2) {
    return GameLogic.compareNNCards(cards1, cards2, server.config.specialTypeOnOff);
}

function analyseCards(server, cards) {
    return GameLogic.analyseNiuNiuCards(cards, server.config.specialTypeOnOff);
}

Server.begin = function () {
    if (SingleSimulator) {
        SingleSimulator.begin(); //模拟机的初始化
    } else {
        this.roomInfo.numOfGames++;
    }

    reset(this); //data的初始化
    this.roomInfo.state = 1;
    if (this.roomInfo.autoTimeId) {
        clearTimeout(this.roomInfo.autoTimeId);
        this.roomInfo.autoTimeId = null;
    }
    for (var i = 0; i < this.data.players.length; ++i) {
        var player = this.data.players[i];
        var seat = this.roomInfo.seats[i];
        if (seat.userId > 0) {
            player.joined = true;
        }
    }
    shuffle(); //洗牌 
    deal(this); //发牌
    pushGameBegin(this); //全部准备


};

Server.onCallZhuang = function (data, chairId) {
    callZhuang(this, chairId, data);
};

Server.onStake = function (score, chairId) {
    //cdw todo
    stake(this, chairId, score);
};

Server.onShowCards = function (chairId) {
    showCards(this, chairId);
};

function getCost(conf) {
    var gemForm = {
        "false": {
            "10": 3,
            "20": 5
        },
        "true": {
            "10": 1,
            "20": 2
        }
    }
    var cost = gemForm[conf.isAA][conf.numOfGames];
    return cost;
}

Server.gameOver = function () {
    this.roomInfo.state = 0;

    clearOperates(this);
    if (SingleSimulator) {
        SingleSimulator.clearReady();
    }

    this.data.state = ChanCheConfig.Enum.GAME_STATE_UNKNOWN;
    genResult(this);
    pushGameOver(this);

    var baseInfo = {
        type: this.roomInfo.conf.type,
        index: this.roomInfo.numOfGames,
        mode: this.roomInfo.conf.maxChair
    };

    var strInfo = JSON.stringify(baseInfo);
    db.create_game(this.roomInfo.gametype, this.roomInfo.gamemode, this.roomInfo.uuid, this.roomInfo.numOfGames, strInfo);
    var resultInfo = [];
    for (var i = 0; i < this.data.players.length; ++i) {
        var player = this.data.players[i];
        if (player.joined) {
            var r = this.data.results[i];
            resultInfo.push({
                i: i,
                b: i == this.data.bankerChairId,
                c: player.cards,
                ya: player.yaScore,
                s: r.score
            });
        }
    }
    db.update_game_result(this.roomInfo.gametype, this.roomInfo.gamemode, this.roomInfo.uuid, this.roomInfo.numOfGames, resultInfo);

    for (var i = 0; i < this.data.players.length; ++i) {
        var p = this.data.players[i];
        if (isRobot(this, p.chairId)) {
            if (SingleSimulator) {
                SingleSimulator.seats[i].ready = true;
            }
        }
    }

    for (i = 0; i < this.data.players.length; ++i) {
        this.roomInfo.seats[i].ready = false;
    }

    if (this.roomInfo.numOfGames >= this.roomInfo.conf.numOfGames) {
        doGameOver(this.roomInfo);
    }

    //第一局结束扣钻石
    if (!this.roomInfo.conf.for_others) {
        if (this.roomInfo.numOfGames === 1) {
            var conf = this.roomInfo.conf;
            var cost = getCost(conf);
            if (conf.isAA === true) {
                for (i = 0; i < this.roomInfo.seats.length; i++) {
                    var userId = this.roomInfo.seats[i].userId;
                    if (userId > 0) {
                        db.cost_gems(userId,
                            cost,
                            CASH_CHANGE_RESONS.COST_CREATE_ROOM.format(this.roomInfo.id));
                    }
                }
            } else {
                db.cost_gems(conf.creator,
                    cost,
                    CASH_CHANGE_RESONS.COST_CREATE_ROOM.format(this.roomInfo.id));
            }
        }
    }

    if (this.roomInfo.conf.deposit) {
        autoOperateAll(this, WAIT_READY);
        this.roomInfo.autoTimeId = this.autoTimeId;
    }

    //存入数据库
    roomMgr.updateScores(this.roomInfo.id);

    this.roomInfo.game = null;
};

Server.sync = function (chairId) {
    var data = {};
    data.state = this.data.state;
    data.banker_chair_id = this.data.bankerChairId;
    data.has_operate = [];
    for (var i = 0; i < this.data.players.length; ++i) {
        data.has_operate[i] = this.data.players[i].hasOperate;
    }
    data.ya_score = [];
    data.multiple = [];
    data.has_cuo_pai = [];
    for (var i = 0; i < this.data.players.length; ++i) {
        data.ya_score[i] = this.data.players[i].yaScore;
        data.multiple[i] = this.data.players[i].multiple;
    }
    if (!this.data.players[chairId].joined) {
        data.lookon = true;
    }
    if (this.data.state == ChanCheConfig.Enum.GAME_STATE_KAN_PAI) {
        data.cards = [];
        data.has_cuo_pai = [];
        for (var i = 0; i < this.data.players.length; ++i) {
            data.has_cuo_pai[i] = this.data.players[i].hasCuoPai;
            if (i == chairId || data.has_operate[i]) {
                data.cards[i] = this.data.players[i].cards;
            }
        }
    }
    this.data.wanFaWrapper.sync(this, chairId, data);
    NetAdapter.sendMsg(this, chairId, "push_game_sync", data);
};

function doGameOver(roomInfo, forceEnd) {
    console.log("game end!");
    db.archive_games(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid);
    clearOperates(roomInfo.game);
    var seats = roomInfo.seats;
    var result = [];
    for (var i = 0; i < seats.length;++i) {
        var s = seats[i];
        result[i] = s.score;
    }
    for (var i = 0; i < seats.length; ++i) {
        var s = seats[i];
        if (s.userId > 0) {
            userMgr.sendMsg(s.userId, 'game_end_push', result);
        }
    }

    //存入数据库
    roomMgr.updateScores(roomInfo.id);

    //保存历史记录
    store_history(roomInfo);

    roomInfo.game = null;
    roomMgr.closeRoom(roomInfo.id, forceEnd);
}

Server.doGameOver = doGameOver;

function store_history(room) {
    var seats = room.seats;

    for (var i = 0; i < seats.length; ++i) {
        var seat = seats[i];
        if (seat.userId > 0) {
            db.create_user_history(room.gametype, room.gamemode, seat.userId, room.uuid);
            // db.add_turn_num_by_userid(seat.userId);
        }
    }
}

Server.cuoPai = function (chairId) {
    var player = this.data.players[chairId];
    if (player.hasCuoPai) {
        return;
    }
    player.hasCuoPai = true;
    var seats = this.roomInfo.seats;
    for (var i = 0; i < seats.length; ++i) {
        var s = seats[i];
        if (s.userId > 0) {
            userMgr.sendMsg(s.userId, 'push_cuo_pai', chairId);
        }
    }
}

Server.sendAnima = function (data, chairId) {
    var player = this.data.players[chairId];
    var seats = this.roomInfo.seats;
    var msgData = {
        chairId1: chairId,
        chairId2: data.chairId,
        animation: data.animation
    }
    for (var i = 0; i < seats.length; ++i) {
        var s = seats[i];
        if (s.userId > 0) {
            userMgr.sendMsg(s.userId, 'push_anima', msgData);
        }
    }
}

WanFaNiuNiuShangZhuang.pushGameBegin = function (server) {
    server.data.state = ChanCheConfig.Enum.GAME_STATE_YA_FEN;
    if (server.roomInfo.conf.deposit) {
        autoOperateAll(server, WAIT_XIA_ZHU);
    }
    if (server.roomInfo.bankerChairId == null) {
        var joinedPlayers = [];
        for (var i = 0; i < server.data.players.length; ++i) {
            var player = server.data.players[i];
            if (player.joined) {
                joinedPlayers.push(player)
            }
        }
        server.roomInfo.bankerChairId = joinedPlayers[Math.floor(Math.random() * joinedPlayers.length)].chairId;
    }
    server.data.bankerChairId = server.roomInfo.bankerChairId;
    var banker = server.data.players[server.data.bankerChairId];
    banker.hasOperate = true;
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        if (isRobot(server, player.chairId) && isPlayerValid(server, i)) {
            var scoreArr = ChanCheConfig.yaFen[server.config.playMode][server.config.batLv];
            var batScore = scoreArr[Math.floor(Math.random() * scoreArr.length)];
            stake(server, i, batScore);
        } else {
            var tuiZhuScore = getTuiZhuScore(server, i);
            if (tuiZhuScore == 0) {
                tuiZhuScore = null;
            }
            NetAdapter.sendMsg(server, i, "push_game_begin", {
                banker_chair_id: server.roomInfo.bankerChairId,
                tui_zhu: tuiZhuScore
            });
            NetAdapter.sendMsg(server, i, "game_num_push", server.roomInfo.numOfGames)
        }
    }
};

WanFaNiuNiuShangZhuang.callZhuang = function (server, chairId, multiple) {

};

WanFaNiuNiuShangZhuang.genBanker = function (server) {

};

WanFaNiuNiuShangZhuang.pushBankerConfirm = function (server) {

};

WanFaNiuNiuShangZhuang.stake = function (server, chairId, score) {
    for (var i = 0; i < server.data.players.length; ++i) {
        var p = server.data.players[i];
        if (!isRobot(server, p.chairId) && isPlayerValid(server, i)) {
            NetAdapter.sendMsg(server, i, "push_ya_fen", {
                chair_id: chairId,
                score: score
            });
        }
    }

    if (isAllOperate(server)) {
        clearOperates(server);
        pushStakeOver(server);
        if (server.roomInfo.conf.deposit) {
            autoOperateAll(server, WAIT_QIANG_ZHUANG);
        }
    }
};

WanFaNiuNiuShangZhuang.pushStakeOver = function (server) {
    server.data.state = ChanCheConfig.Enum.GAME_STATE_KAN_PAI;
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        if (!isRobot(server, player.chairId) && isPlayerValid(server, i)) {
            NetAdapter.sendMsg(server, i, "push_stake_over", {
                cards: player.cards,
                multi: genCardsMulti(server, player.cards)
            });
        }
    }
};

function genCardsMulti(server, cards) {
    var multi = 1;
    var res = analyseCards(server, cards);
    var multiForm = [1, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 5, 5, 6, 7, 8];
    if (server.roomInfo.conf.multiRule == 0) {
        multiForm[1][0] = 3;
        multiForm[1][9] = 2;
        multiForm[1][8] = 2;
    } else {
        multiForm[1][0] = 4;
        multiForm[1][9] = 3;
        multiForm[1][8] = 2;
        multiForm[1][7] = 2;
    }
    if (res.type == 1) {
        return multiForm[1][res.niuCount] * multi;
    }
    return multiForm[res.type] * multi;
}

function genMulti(server, cards1, cards2) {
    var multi = 1;
    var bigger = cards1;
    if (!compareCards(server, cards1, cards2)) {
        multi = -1;
        bigger = cards2;
    }

    return multi * genCardsMulti(server, bigger);
}

function genNNResult(server) {
    var results = server.data.results;
    var bankerChairId = server.data.bankerChairId;
    var scoreArr = [];
    for (var i = 0; i < server.data.players.length; ++i) {
        scoreArr[i] = 0;
    }
    if (bankerChairId < 0) {
        for (var i = 0; i < server.data.players.length - 1; ++i) {
            for (var j = i + 1; j < server.data.players.length; ++j) {
                var player1 = server.data.players[i];
                var player2 = server.data.players[j];
                if (player1 == null || !player1.joined || player2 == null || !player2.joined) {
                    continue;
                }
                var multi = genMulti(server, player1.cards, player2.cards);
                var score = multi * player1.yaScore;
                scoreArr[i] += score;
                scoreArr[j] += -score;
            }
        }
    } else {
        var banker = server.data.players[bankerChairId];
        if (!banker || !banker.joined) {
            console.log("banker error when gen result!", bankerChairId);
        }
        for (var i = 0; i < server.data.players.length; ++i) {
            var player = server.data.players[i];
            if (player == null || !player.joined || player.chairId == bankerChairId) {
                continue;
            }
            var multi = genMulti(server, banker.cards, player.cards);
            var score = multi * player.yaScore * Math.max(banker.multiple, 1);
            scoreArr[bankerChairId] += score;
            scoreArr[i] += -score;
            if (score < 0 && player.tuiZhu == null) {
                server.roomInfo.seats[i].lastWin = -score;
            } else {
                server.roomInfo.seats[i].lastWin = 0;
            }
        }
    }
    console.log("gen result...");
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        server.roomInfo.seats[i].score += scoreArr[i];
        results[i] = {
            cards: player.cards,
            multi: genCardsMulti(server, player.cards),
            score: scoreArr[i],
            totalscore: server.roomInfo.seats[i].score
        };
        console.log(results[i]);
    }
}

WanFaNiuNiuShangZhuang.genResult = function (server) {
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        if (player != null && player.joined) {
            player.multiple = 1;
        }
    }
    genNNResult(server);

    //产生牛牛庄家
    var simplePlayers = [];
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        if (player.joined) {
            simplePlayers.push([player.cards, player.chairId]);
        }
    }
    var maxPlayer = simplePlayers[0];
    for (var i = 1; i < simplePlayers.length; ++i) {
        var splayer = simplePlayers[i];
        if (compareCards(server, splayer[0], maxPlayer[0])) {
            maxPlayer = splayer;
        }
    }
    var res = analyseCards(server, maxPlayer[0]);
    if (res.type > 1) {
        server.roomInfo.bankerChairId = maxPlayer[1];
    }
};

WanFaNiuNiuShangZhuang.sync = function (server, chairId, data) {

};


WanFaGuDingZhuangJia.pushGameBegin = function (server) {
    server.data.state = ChanCheConfig.Enum.GAME_STATE_YA_FEN;
    if (server.roomInfo.conf.deposit) {
        autoOperateAll(server, WAIT_XIA_ZHU);
    }
    if (server.roomInfo.bankerChairId == null) {
        for (var i = 0; i < server.data.players.length; ++i) {
            var player = server.data.players[i];
            if (player.joined) {
                server.roomInfo.bankerChairId = player.chairId;
                break;
            }
        }
    }
    server.data.bankerChairId = server.roomInfo.bankerChairId;
    var banker = server.data.players[server.data.bankerChairId];
    banker.hasOperate = true;
    var bankerScore = server.roomInfo.conf.bankerScoreRestrict;
    if (server.roomInfo.numOfGames > 1) {
        bankerScore = null;
    }
    if (bankerScore > 0) {
        server.roomInfo.seats[server.data.bankerChairId].score = bankerScore;
    }
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        if (isRobot(server, player.chairId) && isPlayerValid(server, i)) {
            var scoreArr = ChanCheConfig.yaFen[server.config.playMode][server.config.batLv];
            var batScore = scoreArr[Math.floor(Math.random() * scoreArr.length)];
            stake(server, i, batScore);
        } else {
            var tuiZhuScore = getTuiZhuScore(server, i);
            if (tuiZhuScore == 0) {
                tuiZhuScore = null;
            }
            NetAdapter.sendMsg(server, i, "push_game_begin", {
                banker_chair_id: server.data.bankerChairId,
                tui_zhu: tuiZhuScore,
                banker_score: bankerScore
            });
            NetAdapter.sendMsg(server, i, "game_num_push", server.roomInfo.numOfGames)
        }
    }
};

WanFaGuDingZhuangJia.callZhuang = function (server, chairId, multiple) {

};

WanFaGuDingZhuangJia.genBanker = function (server) {

};

WanFaGuDingZhuangJia.pushBankerConfirm = function (server) {

};

WanFaGuDingZhuangJia.stake = function (server, chairId, score) {
    WanFaNiuNiuShangZhuang.stake(server, chairId, score);
};

WanFaGuDingZhuangJia.pushStakeOver = function (server) {
    WanFaNiuNiuShangZhuang.pushStakeOver(server);
};

WanFaGuDingZhuangJia.genResult = function (server) {
    WanFaNiuNiuShangZhuang.genResult(server);
};

WanFaGuDingZhuangJia.sync = function (server, chairId) {

};


WanFaZiYouQiangZhuang.pushGameBegin = function (server) {
    server.data.state = ChanCheConfig.Enum.GAME_STATE_QIANG_ZHUANG;
    if (server.roomInfo.conf.deposit) {
        autoOperateAll(server, WAIT_XIA_ZHU);
    }
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        if (isRobot(server, player.chairId) && isPlayerValid(server, i)) {
            var scoreArr = ChanCheConfig.yaFen[server.config.playMode][server.config.batLv];
            var batScore = scoreArr[Math.floor(Math.random() * scoreArr.length)];
            stake(server, i, batScore);
        } else {
            var tuiZhuScore = getTuiZhuScore(server, i);
            if (tuiZhuScore == 0) {
                tuiZhuScore = null;
            }
            NetAdapter.sendMsg(server, i, "push_game_begin", {
                tui_zhu: tuiZhuScore
            });
            NetAdapter.sendMsg(server, i, "game_num_push", server.roomInfo.numOfGames)
        }
    }
};

WanFaZiYouQiangZhuang.callZhuang = function (server, chairId, multiple) {
    console.log("jiao zhuang", chairId, server.data.state, Date.now());
    if (server.data.state != ChanCheConfig.Enum.GAME_STATE_QIANG_ZHUANG) {
        return;
    }

    var player = server.data.players[chairId];
    if (multiple != 0 && multiple != 1) {
        console.log("player " + chairId + " input is not valid!");
        return;
    }
    if (!player.joined) {
        return;
    }
    player.hasOperate = true;
    player.multiple = multiple;
    for (var i = 0; i < server.data.players.length; ++i) {
        var p = server.data.players[i];
        if (!isRobot(server, p.chairId) && isPlayerValid(server, i)) {
            NetAdapter.sendMsg(server, i, "push_call_zhuang", {
                chair_id: chairId,
                multiple: multiple
            });
        }
    }

    // if (player.multiple > 0) {
    //     server.data.bankerChairId = chairId;
    // } else if (isAllOperate(server)) {
    //     server.data.bankerChairId = -1;
    // }

    if (isAllOperate(server)) {
        clearOperates(server);

        var maxPlayers = [];
        var maxMulti = 0;
        for (var i = 0; i < server.data.players.length; ++i) {
            var player = server.data.players[i];
            if (player.joined) {
                if (player.multiple == maxMulti) {
                    maxPlayers.push(player.chairId);
                } else if (player.multiple > maxMulti) {
                    maxPlayers = [player.chairId];
                    maxMulti = player.multiple;
                }
            }
        }
        server.data.bankerChairId = maxPlayers[Math.floor(Math.random() * maxPlayers.length)];

        var banker = server.data.players[server.data.bankerChairId];
        banker.hasOperate = true;
        pushBankerConfirm(server);
        if (server.roomInfo.conf.deposit) {
            autoOperateAll(server, WAIT_LIANG_PAI);
        }
        for (var i = 0; i < server.data.players.length; ++i) {
            var p = server.data.players[i];
            if (isRobot(server, p.chairId)) {
                showCards(server, i);
            }
        }
    }
};

WanFaZiYouQiangZhuang.genBanker = function (server) {
    //server.data.bankerChairId = Math.floor(Math.random() * server.data.players.length);
};

WanFaZiYouQiangZhuang.pushBankerConfirm = function (server) {
    server.data.state = ChanCheConfig.Enum.GAME_STATE_YA_FEN;
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        if (!isRobot(server, player.chairId) && isPlayerValid(server, i))
            NetAdapter.sendMsg(server, i, "push_confirm_banker", {
                banker_chair_id: server.data.bankerChairId
            });
    }
};

WanFaZiYouQiangZhuang.stake = function (server, chairId, score) {
    for (var i = 0; i < server.data.players.length; ++i) {
        var p = server.data.players[i];
        if (!isRobot(server, p.chairId) && isPlayerValid(server, i)) {
            NetAdapter.sendMsg(server, i, "push_ya_fen", {
                chair_id: chairId,
                score: score
            });
        }
    }

    if (isAllOperate(server)) {
        clearOperates(server);
        pushStakeOver(server);
        if (server.roomInfo.conf.deposit) {
            autoOperateAll(server, WAIT_QIANG_ZHUANG);
        }
        for (var i = 0; i < server.data.players.length; ++i) {
            var p = server.data.players[i];
            if (isRobot(server, p.chairId)) {
                callZhuang(server, i, 0);
            }
        }
    }
};

WanFaZiYouQiangZhuang.pushStakeOver = function (server) {
    server.data.state = ChanCheConfig.Enum.GAME_STATE_KAN_PAI;
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        if (!isRobot(server, player.chairId) && isPlayerValid(server, i)) {
            NetAdapter.sendMsg(server, i, "push_stake_over", {
                cards: player.cards,
                multi: genCardsMulti(server, player.cards)
            });
        }
    }
};

WanFaZiYouQiangZhuang.genResult = function (server) {
    genNNResult(server);
};

WanFaZiYouQiangZhuang.sync = function (server, chairId) {
    // var data = {};
    // data.state = server.data.state;
    // data.banker_chair_id = server.data.bankerChairId;

    // data.has_operate = [];
    // for (var i = 0; i < server.data.players.length; ++i) {
    //     data.has_operate[i] = server.data.players[i].hasOperate;
    // }

    // if (server.data.state == ChanCheConfig.Enum.GAME_STATE_YA_FEN) {
    //     data.ya_score = [];
    //     for (var i = 0; i < server.data.players.length; ++i) {
    //         data.ya_score[i] = server.data.players[i].yaScore;
    //     }
    // }else if (server.data.state == ChanCheConfig.Enum.GAME_STATE_QIANG_ZHUANG) {
    //     data.ya_score = [];
    //     data.multiple = [];
    //     for (var i = 0; i < server.data.players.length; ++i) {
    //         data.ya_score[i] = server.data.players[i].yaScore;
    //         data.multiple[i] = server.data.players[i].multiple;
    //     }
    // }else if (server.data.state == ChanCheConfig.Enum.GAME_STATE_KAN_PAI) {
    //     data.ya_score = [];
    //     data.multiple = [];
    //     data.cards = [];
    //     data.has_cuo_pai = [];
    //     for (var i = 0; i < server.data.players.length; ++i) {
    //         data.ya_score[i] = server.data.players[i].yaScore;
    //         data.multiple[i] = server.data.players[i].multiple;
    //         data.has_cuo_pai[i] = server.data.players[i].hasCuoPai;
    //         if (i == chairId || data.has_operate[i]) {
    //             data.cards[i] = server.data.players[i].cards;
    //         }
    //     }
    // }
    // if (!server.data.players[chairId].joined) {
    //     data.lookon = true;
    // }
    // NetAdapter.sendMsg(server, chairId, "push_game_sync", data);
};


WanFaMingPaiQiangZhuang.pushGameBegin = function (server) {
    server.data.state = ChanCheConfig.Enum.GAME_STATE_QIANG_ZHUANG; //当前的状态
    if (server.roomInfo.conf.deposit) {
        autoOperateAll(server, WAIT_QIANG_ZHUANG);
    }
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        if (isRobot(server, player.chairId) && isPlayerValid(server, i)) {
            callZhuang(server, i, Math.floor(Math.random() * 5));
        } else {
            var tuiZhuScore = getTuiZhuScore(server, i);
            if (tuiZhuScore == 0) {
                tuiZhuScore = null;
            }
            NetAdapter.sendMsg(server, i, "push_game_begin", {
                cards: player.cards.slice(0, 4),
                tui_zhu: tuiZhuScore
            });
            NetAdapter.sendMsg(server, i, "game_num_push", server.roomInfo.numOfGames)
        }
    }
};

WanFaMingPaiQiangZhuang.callZhuang = function (server, chairId, multiple) {
    var player = server.data.players[chairId];
    if (multiple != 0 && multiple != 1 && multiple != 2 && multiple != 3 && multiple != 4) {
        console.log("player " + chairId + " input is not valid!");
        return;
    }
    if (!player.joined) {
        return;
    }
    player.hasOperate = true;
    player.multiple = multiple;
    for (var i = 0; i < server.data.players.length; ++i) {
        var p = server.data.players[i];
        if (!isRobot(server, p.chairId) && isPlayerValid(server, i)) {
            NetAdapter.sendMsg(server, i, "push_call_zhuang", {
                chair_id: chairId,
                multiple: multiple
            });
        }
    }

    if (isAllOperate(server)) {
        genBanker(server);
        clearOperates(server);
        server.data.players[server.data.bankerChairId].hasOperate = true;
        pushBankerConfirm(server);
        var scoreArr = ChanCheConfig.yaFen[server.config.playMode][server.config.batLv];
        if (server.roomInfo.conf.deposit) {
            autoOperateAll(server, WAIT_XIA_ZHU);
        }
        for (var i = 0; i < server.data.players.length; ++i) {
            var p = server.data.players[i];
            if (isRobot(server, p.chairId)) {
                var batScore = scoreArr[Math.floor(Math.random() * scoreArr.length)];
                stake(server, i, batScore);
            }
        }
    }
};

WanFaMingPaiQiangZhuang.genBanker = function (server) {
    var maxMultiPlayerIndexs = [];
    var maxMulti = -1;
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        if (!isPlayerValid(server, i) || !player.joined) {
            continue;
        }
        if (player.multiple > maxMulti) {
            maxMulti = player.multiple;
            maxMultiPlayerIndexs = [i];
        } else if (player.multiple == maxMulti) {
            maxMultiPlayerIndexs.push(i);
        }
    }
    console.log("call score : " + maxMultiPlayerIndexs + " , " + maxMulti);
    var r = Math.floor(Math.random() * maxMultiPlayerIndexs.length);
    server.data.bankerChairId = maxMultiPlayerIndexs[r];
    if (server.data.players[server.data.bankerChairId].multiple == 0) {
        server.data.players[server.data.bankerChairId].multiple = 1;
    }
};

WanFaMingPaiQiangZhuang.pushBankerConfirm = function (server) {
    server.data.state = ChanCheConfig.Enum.GAME_STATE_YA_FEN;
    broadcastTablePlayer(server, "push_confirm_banker", server.data.bankerChairId);
};

WanFaMingPaiQiangZhuang.stake = function (server, chairId, score) {
    for (var i = 0; i < server.data.players.length; ++i) {
        var p = server.data.players[i];
        if (!isRobot(server, p.chairId) && isPlayerValid(server, i)) {
            NetAdapter.sendMsg(server, i, "push_ya_fen", {
                chair_id: chairId,
                score: score
            });
        }
    }

    if (isAllOperate(server)) {
        clearOperates(server);
        pushStakeOver(server);
        if (server.roomInfo.conf.deposit) {
            autoOperateAll(server, WAIT_LIANG_PAI);
        }
        for (var i = 0; i < server.data.players.length; ++i) {
            var p = server.data.players[i];
            if (isRobot(server, p.chairId)) {
                showCards(server, i);
            }
        }
    }
};

WanFaMingPaiQiangZhuang.pushStakeOver = function (server) {
    server.data.state = ChanCheConfig.Enum.GAME_STATE_KAN_PAI;
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        if (!isRobot(server, player.chairId) && isPlayerValid(server, i)) {
            NetAdapter.sendMsg(server, i, "push_stake_over", {
                cards: player.cards,
                multi: genCardsMulti(server, player.cards)
            });
        }
    }
};

WanFaMingPaiQiangZhuang.genResult = function (server) {
    genNNResult(server);
};

WanFaMingPaiQiangZhuang.sync = function (server, chairId, data) {
    if (server.data.state == ChanCheConfig.Enum.GAME_STATE_QIANG_ZHUANG) {
        data.cards = [];
        for (var i = 0; i < server.data.players.length; ++i) {
            if (chairId == i) {
                data.cards[i] = server.data.players[i].cards.slice(0, 4);
            } else {
                data.cards[i] = [];
            }
        }
    } else if (server.data.state == ChanCheConfig.Enum.GAME_STATE_YA_FEN) {
        data.cards = [];
        for (var i = 0; i < server.data.players.length; ++i) {
            if (chairId == i) {
                data.cards[i] = server.data.players[i].cards.slice(0, 4);
            } else {
                data.cards[i] = [];
            }
        }
    }
}


WanFaTongBiNiuNiu.pushGameBegin = function (server) {
    server.data.state = ChanCheConfig.Enum.GAME_STATE_YA_FEN;
    if (server.roomInfo.conf.deposit) {
        autoOperateAll(server, WAIT_XIA_ZHU);
    }
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        if (isRobot(server, player.chairId) && isPlayerValid(server, i)) {
            var scoreArr = ChanCheConfig.yaFen[server.config.playMode][server.config.batLv];
            var batScore = scoreArr[Math.floor(Math.random() * scoreArr.length)];
            stake(server, i, batScore);
        } else {
            NetAdapter.sendMsg(server, i, "push_game_begin");
            NetAdapter.sendMsg(server, i, "game_num_push", server.roomInfo.numOfGames)
        }
    }
};

WanFaTongBiNiuNiu.callZhuang = function (server, chairId, multiple) {

};

WanFaTongBiNiuNiu.genBanker = function (server) {

};

WanFaTongBiNiuNiu.pushBankerConfirm = function (server) {

};

WanFaTongBiNiuNiu.stake = function (server, chairId, score) {
    WanFaNiuNiuShangZhuang.stake(server, chairId, score);
};

WanFaTongBiNiuNiu.pushStakeOver = function (server) {
    WanFaNiuNiuShangZhuang.pushStakeOver(server);
};

WanFaTongBiNiuNiu.genResult = function (server) {
    server.data.bankerChairId = -1;
    for (var i = 0; i < server.data.players.length; ++i) {
        var player = server.data.players[i];
        if (player != null && player.joined) {
            player.multiple = 1;
        }
    }
    genNNResult(server);
};

WanFaTongBiNiuNiu.sync = function (server, chairId) {

};