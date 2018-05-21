var mjutils = require('./mjutils');
var roomMgr = require("../roommgr");
var userMgr = (require('../../../externals/game_utils/usermgr')).getUserMgr('thirteen');
var db = require("../../../externals/utils/dbsync");
var crypto = require("../../../externals/utils/crypto");
var GameLogic = require("./thirteen_game_logic");
var consts = require("../../../externals/utils/consts");
const CASH_CHANGE_RESONS = consts.CashChangeResons;

const GAMETYPE = consts.GameType.THIRTEEN;
const GAMEMODE = consts.GameMode.NORM;

//默认消费配置数据
var DEFAULT_COST_CONF = {
    '2': {
        '10': 16,
        '20': 30,
        '30': 46
    },

    '3': {
        '10': 21,
        '20': 42,
        '30': 60
    },

    '4': {
        '10': 28,
        '20': 56,
        '30': 84
    },
};

/**
 * 获取消耗
 */
function getCost(conf) {
    //获取消耗配置数据
    var cost_conf = db.get_cost_conf(GAMETYPE, GAMEMODE);
    if (!cost_conf) {
        console.log('Warning: 无法获取[game:{0},mode:{1}]消耗配置数据，将按默认数据扣除!'.format(GAMETYPE, GAMEMODE));
        cost_conf = DEFAULT_COST_CONF;
    }

    //获取场次消耗配置
    var roomCostConf = cost_conf[String(conf.maxChair)];
    if (!roomCostConf) {
        console.log('Warning: 无法获取[game:{0},mode:{1},roommode:{2}]房间消耗配置数据，将按默认数据扣除!'.format(GAMETYPE, GAMEMODE, conf.maxChair));
        roomCostConf = cost_conf['2'];
    }

    //获取具体局数配置
    var jushu = String(conf.numOfGames);
    var cost = roomCostConf[jushu];
    if (!cost) {
        console.log('Warning: 无法获取具体[game{0},mode:{1},roommode:{2},jushu:{3}]消耗值，将使用默认值！'.format(GAMETYPE, GAMEMODE, conf.maxChair, jushu));
        cost = conf.maxChair;
    }

    //扣除消耗
    cost = parseInt(cost);
    if (conf.isAA === true) {
        cost = Math.ceil(cost / conf.maxChair);
    }

    return cost;
}

var specialScoreConfig = {
    CHONG_SAN: 2,
    ZHONG_DAO_HU_LU: 1,
    ZHONG_DAO_TIE_ZHI: 7,
    WEI_DAO_TIE_ZHI: 3,
    ZHONG_DAO_TONG_HUA_SHUN: 9,
    WEI_DAO_TONG_HUA_SHUN: 4,
    ZHONG_DAO_WU_TONG: 19,
    WEI_DAO_WU_TONG: 9,

    SAN_TONG_HUA: 3,
    SAN_SHUN_ZI: 3,
    LIU_DUI_BAN: 6,
    WU_DUI_SAN_TIAO: 7,

    QUAN_XIAO: 6,                  //全小
    QUAN_DA: 6,                  //全大
    BAN_XIAO: 3,                   //半小
    BAN_DA: 3,                    //半大

    SAN_HU_LU: 9,
    QUAN_HEI_YIDIANHONG: 13,
    QUAN_HONG_YIDIANHEI: 13,
    QUAN_HEI: 26,
    QUAN_HONG: 26,
    SI_TAO_SAN_TIAO: 26,
    SAN_FEN_TIAN_XIA: 26,
    SAN_TONG_HUA_SHUN: 26,
    YI_TIAO_LONG: 30,
    QING_LONG: 52
};

var ThirteenGameServer = {};
// exports.gamemgr_thirteen = ThirteenGameServer;

var gameSeatsOfUsers = {};

var games = {};

// var ThirteenGame = require("./thirteen_game").ThirteenGame;

var GameConfig = {
    zhuangJiaMode: false
};

var EGameState = {
    OTHER_PHASE: 0,
    PUTTING_CARD_PHASE: 1,
    COMPARING_CARD_PHASE: 2
};

exports.checkConf = function (roomConf, gems) {
    var cost = getCost(roomConf);
    if (cost > gems) {
        return GAME_ERRS.GEMS_NOT_ENOUGH;
    }
    return RET_OK;
};

exports.checkConfTow = function (roomConf, gems) {
    var cost = getCost(roomConf);
    if (!roomConf.club_id) {
        if (cost > gems) {
            return GAME_ERRS.GEMS_NOT_ENOUGH;
        }
    }
    return RET_OK;
};

exports.getConf = function (roomConf, creator) {
    roomConf.creator = creator;
    roomConf.cost = getCost(roomConf);
    return roomConf;
};

function calcDaQiangScore(score, daQiang1Fen) {
    if (daQiang1Fen) {
        return score + 1;
    } else {
        return score * 2;
    }
}

var cardPool = [
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D,   //方块 A - K
    0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D,   //梅花 A - K
    0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D,   //红桃 A - K
    0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D    //黑桃 A - K
];

var SanCardPool = [
    0x01, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D,   //方块 A - K
    0x11, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x1B, 0x1C, 0x1D,   //梅花 A - K
    0x21, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x2B, 0x2C, 0x2D,   //红桃 A - K
    0x31, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x3B, 0x3C, 0x3D   //黑桃 A - K
];

var dealCardCount = 13;

function struct_PlayerData() {
    var ret = {};
    ret.chairId = 0;
    ret.cards = [];
    ret.segmentCards = [[], [], []];
    ret.isReady = false;
    ret.isPutCardOk = false;
    ret.specialType = null;
    return ret;
}

function struct_Result() {
    var ret = {};
    ret.chairId = 0;
    ret.segmentCards = [[], [], []];
    ret.segmentCardsType = [];
    ret.daQiang = [];
    ret.quanLeiDa = false;
    ret.score = 0;
    ret.isSpecialCardType = false;
    ret.specialCardType = 0;
    return ret;
}

//强制比牌逻辑
//3m = 3 * 60 * 1000ms
const forcePutCardsInterval1 = 120000;
//5m = 5 * 60 * 1000ms
const forcePutCardsInterval2 = 120000;

//开启自动比牌监视器
ThirteenGameServer.startAutoPutCardsMonitor = function () {
    this.needAutoPutCards = true;
    this.gameBeginTime = Date.now();
    this.isLastGameForcePutCards = this.isLastGameForcePutCards != null ? this.isLastGameForcePutCards : false;
    this.forcePutCardsInterval = this.isLastGameForcePutCards ? forcePutCardsInterval1 : forcePutCardsInterval2;
    this.numOfUserForcePutCards = this.numOfUserForcePutCards != null ? this.numOfUserForcePutCards : {};
    //判断玩家是否需要被托管
    for (var userId in this.numOfUserForcePutCards) {
        var num = this.numOfUserForcePutCards[userId];
        if (num >= 3) {
            console.log('\tuser [' + userId + '] forced put cards >= 3, hosting');
            this.hostUser(userId);
        }
    }
}

ThirteenGameServer.stopAutoPutCardsMonitor = function () {
    this.needAutoPutCards = false;
    this.gameBeginTime = 0;
    this.forcePutCardsInterval = 0;
}

//托管取消保持状态
const cancelHostingInterval = 120000;
const HOST_STATE = {
    ONGOING: 1,
    CANCELING: 2
}

//托管玩家
ThirteenGameServer.hostUser = function (userId) {
    if (userId == null) {
        return;
    }
    console.log('[Debug] - hosting user[' + userId + ']');
    this.hostingUsers = this.hostingUsers != null ? this.hostingUsers : {};
    if (this.hostingUsers[userId] == null) {
        this.hostingUsers[userId] = { state: HOST_STATE.ONGOING, time: 0 };
    }
};

//玩家取消托管
ThirteenGameServer.cancelHostUser = function (userId) {
    if (userId == null) {
        return;
    }

    console.log('[Debug] - canceling host user[' + userId + ']');
    var userHostData = this.hostingUsers ? this.hostingUsers[userId] : null;
    if (userHostData) {
        userHostData.state = HOST_STATE.CANCELING;
        userHostData.time = Date.now();

        var users = this.getHostingUsers();
        // if (users.length > 0) {
        userMgr.broacastInRoom('hosting_users_push', users, this.roomInfo, users[0], true);
        // }
    } else {
        console.log('user [' + userId + '] is not in hosting.')
    }
};

//彻底取消托管
ThirteenGameServer.unHostUser = function (userId) {
    if (userId == null || this.hostingUsers == null) {
        return;
    }

    console.log('[Debug] - unhost user[' + userId + ']');
    delete this.hostingUsers[userId];
};

ThirteenGameServer.reset = function () {
    this.players = [];
    this.results = [];
    var playerCount = this.getPlayerCount();
    for (var i = 0; i < playerCount; ++i) {
        var playerData = struct_PlayerData();
        //cdw test
        playerData.chairId = i;
        playerData.cards = [];
        this.players[i] = playerData;

        var resultData = struct_Result();
        resultData.chairId = i;
        this.results[i] = resultData;
    }
    this.state = EGameState.OTHER_PHASE;

    this.roomInfo.game = null;

    this.actionList = [];

    this.hasAutoReady = false;
};

ThirteenGameServer.addDealAction = function (chairId, cards) {
    this.actionList.push(createAction(chairId, 0, cards));
};

ThirteenGameServer.addChuPaiAction = function (chairId, cards) {
    this.actionList.push(createAction(chairId, 1, cards));
};

ThirteenGameServer.addSpecialChuPaiAction = function (chairId, type, cards) {
    this.actionList.push(createAction(chairId, 2, { type: type, cards: cards }));
};

//param type:0,发牌 1,出牌 2,特殊出牌
function createAction(chairId, type, data) {
    return { type: type, data: data };
};

ThirteenGameServer.shuffle = function (cardPool) {
    cardPool.sort(function () { return 0.5 - Math.random() });
};

ThirteenGameServer.deal = function (cardPool) {
    this.state = EGameState.PUTTING_CARD_PHASE;
    this.roomInfo.game = this;
    var playerCount = this.getPlayerCount();
    for (var i = 0; i < playerCount; ++i) {
        var playerData = this.players[i];
        playerData.cards = cardPool.slice(i * dealCardCount, (i + 1) * dealCardCount);
        GameLogic.sortCardList(playerData.cards, playerData.cards.length, GameLogic.enDescend);
        playerData.isPutCardOk = false;
    }

    if (playerCount == 3) {


        // this.players[0].cards = [0x31, 0x3B, 0x2B, 0x2D, 0x28, 0x18, 0x26,0x16,  0x3C, 0x2C,0x0C, 0x3A, 0x07];
        // this.players[1].cards = [0x37, 0x17, 0x15, 0x0B, 0x29, 0x09, 0x08,0x36, 0x21, 0x11, 0x1D, 0x1B, 0x1A];
        // this.players[2].cards = [0x01, 0x0A, 0x39, 0x2A, 0x19, 0x38, 0x27,0x06, 0x3D, 0x0D, 0x35, 0x25, 0x05]; 
        // this.roomInfo.conf.dangPai = 0x1C;
        // this.players[0].cards=[49,12,57,59,43,27,42,26,61,45,29,40,8];
        // this.players[1].cards=[33,11,39,13,28,41,9,23,54,6,53,37,21];
        // this.players[2].cards=[44,10,24,17,1,7,38,5,58,25,56,55,22];

        // this.players[0].cards=[43,57,25,49,33,60,44,8,61,45,29,13,38];
        // this.players[1].cards =[17,37,21,42,56,24,39,7,28,12,27,11,54];
        // this.players[2].cards = [1,59,40,41,9,55,23,22,58,26,10,53,5]; 

        // this.players[0].cards = [0x3D, 0x2D, 0x1D, 0x3A, 0x07, 0x39, 0x19,0x09, 0x26, 0x08, 0x17, 0x16, 0x05];
        // this.players[1].cards = [0x0D, 0x1B, 0x0B, 0x31, 0x21, 0x3C, 0x06, 0x22, 0x36,0x38, 0x37, 0x35,0x3B];
        // this.players[2].cards = [0x28, 0x18, 0x27,0x11, 0x01, 0x1C, 0x1A,0x2A,0x2B,0x2C,0x25,0x0A,0x0C]; 
        // this.players[0].cards = [0x3D, 0x38, 0x1D, 0x3A, 0x11, 0x39, 0x19, 0x09, 0x37, 0x08, 0x17, 0x16, 0x05];
        // this.players[1].cards = [0x0D, 0x1B, 0x0B, 0x31, 0x21, 0x3C, 0x06, 0x27, 0x25, 0x28, 0x26, 0x35, 0x3B];
        // this.players[2].cards = [0x15, 0x36, 0x18, 0x07, 0x01, 0x1C, 0x1A, 0x2A, 0x2B, 0x2C, 0x2D, 0x0A, 0x0C]; 

        //  cardPool[cardPool.length-1]= 0x29;
        // var dangPaiIndexReplace = [];
        // dangPaiIndexReplace[0] = [0, 0, 0, 0, 0];
        // dangPaiIndexReplace[1] = [1, 0, 0, 0, 0];
        // dangPaiIndexReplace[2] = [2, 0, 0, 0, 0];
        // this.players[0].cards = [33, 17, 29, 43, 58, 26, 56, 24, 23, 7, 38, 22, 5];
        // this.players[1].cards = [49, 13, 60, 28, 27, 11, 42, 10, 25, 55, 39, 6, 21];
        // this.players[2].cards = [61, 45, 44, 12, 59, 57, 41, 9, 40, 8, 54, 53, 37];

        // this.roomInfo.conf.dangPai = 0x01;
        this.roomInfo.conf.dangPai = cardPool[cardPool.length - 1];
        // this.roomInfo.conf.dangPaiReplace = dangPaiIndexReplace;


    }

    // this.players[0].cards = [0x3D, 0x2D, 0x1D, 0x3A, 0x2A, 0x39, 0x19, 0x36, 0x26, 0x33, 0x23, 0x13, 0x03];
    // this.players[1].cards = [0x0D, 0x1B, 0x0B, 0x31, 0x21, 0x3C, 0x06, 0x22, 0x29, 0x08, 0x17, 0x16, 0x05];
    // this.players[2].cards = [0x28, 0x18, 0x27,0x11, 0x01, 0x1C, 0x1A, 0x09,0x38, 0x37, 0x35, 0x34, 0x32]; 
    // this.players[3].cards = [0x2C, 0x0C, 0x0A,0x3B, 0x2B, 0x07, 0x25, 0x15,0x24, 0x14, 0x04, 0x12, 0x02]; 

    // this.players[0].cards =[ 17, 1, 28, 299, 43, 57, 41, 25, 24, 7, 20, 3, 290 ];
    // this.players[1].cards = [ 289, 45, 44, 12, 11, 23, 22, 6, 293, 292, 291, 19, 2 ];
    // this.players[2].cards = [ 49, 29, 300, 59, 58, 56, 39, 294, 5, 36, 51, 35, 34 ]; 
    // this.players[3].cards = [ 33, 61, 301, 60, 26, 297, 9, 40, 55, 38, 52, 50, 18 ]; 

    console.log(this.players);
    console.log('deal..............');

    //cdw 发牌
    // ThirteenGame.init(playerCount, 0);
    // for (var i = 0; i < playerCount; ++i) {
    //     var clientPlayer = ThirteenGame.getPlayer(i);
    //     ThirteenGame.takeCards(i, this.players[i].cards);
    // }

    //计算自动摆牌剩余时间
    var autoLeftTime = this.forcePutCardsInterval - (Date.now() - this.gameBeginTime);

    var seats = this.roomInfo.seats;
    for (var i = 0; i < seats.length; ++i) {
        //开局时，通知前端必要的数据
        var s = seats[i];

        var retData = {
            cards: this.players[i].cards,
            auto_put_card: this.needAutoPutCards != null ? this.needAutoPutCards : false,
            auto_left_time: autoLeftTime
        };

        //通知玩家手牌
        userMgr.sendMsg(s.userId, 'hand_cards_push', retData);

        userMgr.sendMsg(s.userId, 'game_num_push', this.roomInfo.numOfGames);
        //通知玩家手牌
        if (seats.length == 3) {
            userMgr.sendMsg(s.userId, 'dang_card_push', this.roomInfo.conf.dangPai);
        } else {
            userMgr.sendMsg(s.userId, 'dang_card_push', 0);
        }
    }

    for (var i = 0; i < seats.length; ++i) {
        this.addDealAction(i, this.players[i].cards);
    }
};

ThirteenGameServer.begin = function (roomId) {
    for (var i = 0; i < this.roomInfo.seats.length; ++i) {
        var user = this.roomInfo.seats[i];
        gameSeatsOfUsers[user.userId] = user;
    }
    this.reset();
    this.enableForcePutCards = false;
    var cards = cardPool;
    if (this.roomInfo.conf.maxChair <= 3) {
        cards = SanCardPool;
    }

    if (this.roomInfo.conf.ziDongBaiPai) {
        //开启自动出牌
        this.startAutoPutCardsMonitor();

        //推送托管玩家名单
        var users = this.getHostingUsers();
        if (users.length > 0) {
            userMgr.broacastInRoom('hosting_users_push', users, this.roomInfo, users[0], true);
        }
    } else {
        this.stopAutoPutCardsMonitor();
        this.isLastGameForcePutCards = false;
        this.forcePutCardsInterval = 0;
        this.numOfUserForcePutCards = null;
        this.hostingUsers = null;
    }

    this.roomInfo.numOfGames++;
    //开局扣
    if (this.roomInfo.numOfGames === 1) {
        var conf = this.roomInfo.conf;
        var cost = getCost(conf);
        if (conf.club_id > 0) {//俱乐部每人都扣        
            for (i = 0; i < this.players.length; i++) {
                var userId = this.roomInfo.seats[i].userId;
                db.cost_gems(userId,
                    cost,
                    CASH_CHANGE_RESONS.COST_CREATE_ROOM.format(this.roomInfo.id));
            }
        } else {
            if (conf.isAA === true) {
                for (i = 0; i < this.players.length; i++) {
                    var userId = this.roomInfo.seats[i].userId;
                    db.cost_gems(userId,
                        cost,
                        CASH_CHANGE_RESONS.COST_CREATE_ROOM.format(this.roomInfo.id));
                }
            } else {
                db.cost_gems(conf.creator,
                    cost,
                    CASH_CHANGE_RESONS.COST_CREATE_ROOM.format(this.roomInfo.id));
            }
        }
        //如果是游戏刚开局,更新游戏房间创建时间 
        db.update_room_time( this.roomInfo.gametype,  this.roomInfo.gamemode, this.roomInfo.id);
    }

    this.shuffle(cards);
    this.deal(cards);

    console.log(this.roomInfo.conf.creator);
};

ThirteenGameServer.getHostingUsers = function () {
    var users = [];
    for (var userId in this.hostingUsers) {
        var hostData = this.hostingUsers[userId];
        if (hostData && hostData.state == HOST_STATE.ONGOING) {
            users.push(userId);
        }
    }

    return users;
};

ThirteenGameServer.autoReadyHostingUsers = function () {
    if (this.roomInfo.conf.ziDongBaiPai != true
        || this.hostingUsers == null
        || this.hasAutoReady === true) {
        return;
    }

    for (var userId in this.hostingUsers) {
        var hostData = this.hostingUsers[userId];
        if (hostData && hostData.state == HOST_STATE.ONGOING) {
            //托管玩家自动准备
            roomMgr.setReady(userId, true);
            userMgr.broacastInRoom('room_user_ready_push', { userid: userId, ready: true }, this.roomInfo, userId, true);
        }
    }

    this.hasAutoReady = true;
}

function createGame(roomId) {
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }
    var game = {};
    game.__proto__ = ThirteenGameServer;
    game.roomInfo = roomInfo;
    game.needAutoPutCards = false;
    game.gameBeginTime = 0;
    return game;
}

exports.begin = function (roomId) {
    var game = games[roomId];
    if (game == null) {
        game = createGame(roomId);
    }
    // var roomInfo = game.roomInfo;
    // roomInfo.game = game;
    // game.roomInfo = roomInfo;

    // if (games[roomId]) {
    //     delete games[roomId];
    // }
    if (!game) {
        return;
    }
    games[roomId] = game;

    game.begin();
};

ThirteenGameServer.getPlayerCount = function () {
    if (!this.roomInfo) {
        return 0;
    }
    return this.roomInfo.seats.length;
};

ThirteenGameServer.addChuPaiActions = function () {


    if (this.players.length == 3) {

        var dangLocation = this.dangPaiLocation();// A-4 然后找需要当牌的位置
        if (dangLocation[0] < 3 && dangLocation[1] < 3 && dangLocation[1] > 0) {
            console.log('dang_card_pos_push   ' + dangLocation + '  ' + this.roomInfo.seats[dangLocation[0]].userId);


            // userMgr.sendMsg(this.roomInfo.seats[dangLocation[0]].userId, 'dang_card_pos_push', dangLocation);
            // var dangPaiContent=GameLogic.useDangPai(this.players[dangLocation[0]].segmentCards[dangLocation[1]],5,this.roomInfo.conf.dangPai);
            // this.players[dangLocation[0]].segmentCards[dangLocation[1]]=dangPaiContent[0];

            // dangLocation.push(dangPaiContent[1]); //将被替换的牌也告诉前端 前端显示时可以重新变回原来的牌.

            for (let i = 0; i < this.roomInfo.seats.length; i++) {  //告诉所有玩家，哪个玩家哪一道可以当牌
                userMgr.sendMsg(this.roomInfo.seats[i].userId, 'dang_card_pos_push', dangLocation);
            }



            for (let i = 0; i < this.players.length; ++i) {
                var player = this.players[i];

                function changeDP(replaceCard, dangPai) {
                    for (let i = 1; i < 3; i++) {
                        for (let j = 0; j < 5; j++) {
                            if (player.segmentCards[i][j] == dangPai) {
                                player.segmentCards[i][j] = replaceCard;
                                GameLogic.sortCardList(player.segmentCards[i], 5, GameLogic.enDescend);
                                break;
                            }
                        }

                    }
                }
                if (i == dangLocation[0] || player.specialType == 27) {  //如果玩家当的牌最大 或者玩家是一条龙特殊牌
                    continue;
                } else {                     //玩家A-4的 不处理，没有当牌资格的玩家  当牌的要变回原来的牌.
                    var tempCards = [];
                    tempCards = tempCards.concat(player.segmentCards[0]);
                    tempCards = tempCards.concat(player.segmentCards[1]);
                    tempCards = tempCards.concat(player.segmentCards[2]);

                    let original = player.cards;

                    let difference1Arr = original.filter(x => !tempCards.includes(x));
                    let difference2Arr = tempCards.filter(x => !original.includes(x));
                    let dArr = difference1Arr.concat(difference2Arr);

                    if (dArr.length == 0) {
                        continue;
                    }

                    else {
                        GameLogic.sortCardList(dArr, dArr.length, GameLogic.enDescend);

                        console.log('前端和后端的牌的差异数组' + dArr);
                        var replaceCard = 0;
                        if (dArr.length == 2) {
                            if (GameLogic.getCardLogicValue(this.roomInfo.conf.dangPai) != 14) {
                                if (GameLogic.getCardLogicValue(dArr[0]) == 14 && GameLogic.getCardLogicValue(dArr[1]) == 4)
                                    continue;

                                else if (GameLogic.getCardLogicValue(dArr[0]) == 14 && GameLogic.getCardLogicValue(dArr[1]) == GameLogic.getCardLogicValue(this.roomInfo.conf.dangPai))
                                    changeDP(dArr[0], this.roomInfo.conf.dangPai);
                                else {

                                    replaceCard = (GameLogic.getCardLogicValue(dArr[0]) == GameLogic.getCardLogicValue(this.roomInfo.conf.dangPai)) ? dArr[1] : dArr[0];
                                    changeDP(replaceCard, this.roomInfo.conf.dangPai);
                                }
                            } else {


                                replaceCard = (GameLogic.getCardLogicValue(dArr[0]) == 14) ? dArr[1] : dArr[0];
                                changeDP(replaceCard, this.roomInfo.conf.dangPai);
                            }
                        }

                        if (dArr.length = 4) {

                            if (GameLogic.getCardLogicValue(dArr[0]) == 14 && GameLogic.getCardLogicValue(dArr[1]) == 14 && GameLogic.getCardLogicValue(dArr[2]) == 4 && GameLogic.getCardLogicValue(dArr[3]) == 4)
                                continue;
                            else if (GameLogic.getCardLogicValue(dArr[0]) == 14 && GameLogic.getCardLogicValue(dArr[1]) == 14 && GameLogic.getCardLogicValue(dArr[3]) == 4) {

                                if (GameLogic.getCardLogicValue(this.roomInfo.conf.dangPai) != 14)
                                    replaceCard = (GameLogic.getCardColor(dArr[3]) == GameLogic.getCardColor(dArr[0])) ? dArr[1] : dArr[0];
                                else
                                    replaceCard = dArr[2];


                                changeDP(replaceCard, this.roomInfo.conf.dangPai);
                            }
                            else {
                                replaceCard = (GameLogic.getCardLogicValue(dArr[1]) == GameLogic.getCardLogicValue(this.roomInfo.conf.dangPai)) ? dArr[2] : dArr[1];
                                changeDP(replaceCard, this.roomInfo.conf.dangPai);
                            }
                        }
                    }

                }
                // GameLogic.changeZhongWei(this.players[dangLocation[0]].segmentCards[2],this.players[dangLocation[0]].segmentCards[1]);
            }
        }

    }
    for (var i = 0; i < this.players.length; ++i) {
        var player = this.players[i];
        if (player.specialType == 27) {
           // this.addSpecialChuPaiAction(i, player.specialType, player.cards);
        } else {
            var cards = [];
            cards = cards.concat(player.segmentCards[0]);
            cards = cards.concat(player.segmentCards[1]);
            cards = cards.concat(player.segmentCards[2]);
            player.cards = cards;

            player.specialType = GameLogic.getSpecialType(cards, 13);
            // console.log("player "+ i +"  特殊牌类型是  " + player.specialType);
            // console.log("player "+ i +"  牌是  " + cards);
           // this.addChuPaiAction(i, cards);
        }
    }
    console.log(this.actionList);
};

ThirteenGameServer.dangPaiLocation = function () {

    var posArr = [];
    //     for(let i=0;i< 3;i++){

    //        for(let j=1;j<=2;j++){

    //             this.players[i].segmentCards[j]=GameLogic.replaceForA4(this.players[i].segmentCards[j],5);
    //          }
    //        GameLogic.changeZhongWei(this.players[i].segmentCards[2],this.players[i].segmentCards[1]);
    //    }

    for (let i = 0; i < 3; i++) {
        for (let j = 1; j <= 2; j++) {

            if (this.players[i].segmentCards[j].includes(this.roomInfo.conf.dangPai)) {

                let cardType = GameLogic.getCardType(this.players[i].segmentCards[j], 5);
                if (cardType[0] == 10)
                    posArr.push([i, j, 4, 3]);

                if (cardType[0] == 11 || cardType[0] == 12)
                    posArr.push([i, j, 5, cardType[1]]);
            }

        }
    }
    // var posArr=this.roomInfo.conf.dangPaiReplace;

    var mark = 0;
    var bigCardValue = 0;
    var markPlayer = 6;
    var markSegment = 6;
    for (let i = 0; i < posArr.length; i++) {
        if (posArr[i][3] == 0)
            continue;
        else {

            if (posArr[i][2] > mark) {
                mark = posArr[i][2];
                markPlayer = posArr[i][0];
                markSegment = posArr[i][1];
                bigCardValue = posArr[i][3];
            }

            else if (posArr[i][2] == 5 && mark == 5) {

                if (posArr[i][3] > bigCardValue) {

                    markPlayer = posArr[i][0];
                    markSegment = posArr[i][1];
                    bigCardValue = posArr[i][3];

                }

            }

            else {
                continue;
            }
        }

    }
    return [markPlayer, markSegment];
    // if(markPlayer<=2&&markSegment<=2){
    //       var 
    //       for(let i=0;i<posArr.length;i++){
    //           if(i==markPlayer){
    //               continue;
    //           }
    //           else{

    //           }

    //    }
    //    return [markPlayer,markSegment,posArr[markPlayer][4]];
    // }

    // else
    //   return [0,0,0];
}
ThirteenGameServer.commitPutCards = function (playerData) {
    //todo check cards valid
    var player = this.players[playerData.chairId];


    if (player.isPutCardOk) {

        console.log("already put card.");
        return;
    }
    if (playerData.specialType && playerData.specialType > 14) {
        player.specialType = playerData.specialType;
    } else {
        for (var i = 0; i < 3; ++i) {
            player.segmentCards[i] = playerData.segmentCards[i].slice(0);
        }
    }

    player.isPutCardOk = true;
    var seats = this.roomInfo.seats;
    for (var i = 0; i < seats.length; ++i) {
        var seat = seats[i];
        userMgr.sendMsg(seat.userId, 'put_card_ok_push', player.chairId);
    }
    console.log(player);
    var suc = this.checkAllPutCard();
    if (suc) {
        this.addChuPaiActions();
        this.genResult();
        this.reportResult();
        this.scoreCommit();
        this.gameover();


        var scoreArr = [];
        for (var i = 0; i < seats.length; ++i) {
            var seat = seats[i];
            scoreArr[i] = seat.score;
        }
        
        function sumScore(arr){

            let total=0;
            for(let i=0;i<arr.length;i++){
                total+=arr[i];
            }
        
            return total;
        }

       

        var isEnd = this.checkEnd();
        if (isEnd) {
            
            if(sumScore(scoreArr)==0){
                for (var i = 0; i < seats.length; ++i) {
                    var seat = seats[i];
                    userMgr.sendMsg(seat.userId, 'room_score_update_push', scoreArr);
                }
         
             }else{ 
                    console.log(scoreArr);
                    var scoreArray=db.get_room_gameResults(GAMETYPE,GAMEMODE,this.roomInfo.uuid);
                  // console.log('UUID' +this.roomInfo.uuid);
                    console.log(scoreArray);
                    var totalScoreList=[];
                    for (var i = 0; i < seats.length; ++i) {
                         totalScoreList[i]=0;
                        for(let j=0;j< scoreArray.length;j++){
                            totalScoreList[i]+= scoreArray[j][i];
                        }
                    }

                    for (var i = 0; i < seats.length; ++i) {
                        var seat = seats[i];
                        seat.score=totalScoreList[i];
                        userMgr.sendMsg(seat.userId, 'room_score_update_push', totalScoreList);
                    }

                    roomMgr.updateScores(this.roomInfo.id);


             }
            
            
            doGameOver(this.roomInfo);

           //俱乐部房间游戏结束发送游戏数据到俱乐部聊天室
            if (this.roomInfo.conf.club_id > 0) {
                // roomMgr.sendMsgToClub(roomInfo.conf.club_id, resultData);//等待配游戏结果数据
            }
        } else{
            
             for (var i = 0; i < seats.length; ++i) {
                var seat = seats[i];
                userMgr.sendMsg(seat.userId, 'room_score_update_push', scoreArr);
            }
        }
    }
};

ThirteenGameServer.scoreCommit = function () {
    var seats = this.roomInfo.seats;
    for (var i = 0; i < seats.length; ++i) {
        seats[i].score += this.results[i].score;
    }
};

ThirteenGameServer.checkEnd = function () {
    var roomInfo = this.roomInfo;
    return roomInfo.numOfGames >= roomInfo.conf.numOfGames;
};

ThirteenGameServer.autoPutAll = function () {
    for (var i = 0; i < this.players.length; ++i) {
        var player = this.players[i];
        if (!player.isPutCardOk) {
            this.autoPutCard(i);
        }
    }
};

var CARD_TYPE_WULONG = 0;
var CARD_TYPE_DUIZI = 1;
var CARD_TYPE_LIANGDUI = 2;
var CARD_TYPE_SANTIAO = 3;
var CARD_TYPE_SHUNZI = 4;
var CARD_TYPE_TONGHUA = 5;
var CARD_TYPE_HULU = 6;
var CARD_TYPE_TIEZHI = 7;
var CARD_TYPE_TONGHUASHUN = 8;
var CARD_TYPE_WUTONG = 9;

function getSingleCards(cards) {
    var ret = [];
    if (!cards || cards.length == 0) {
        return ret;
    }
    for (var i = 0; i < cards.length; ++i) {
        var v = cards[i] & 0xf;
        var count = 1;
        for (var j = i + 1; j < cards.length; ++j) {
            var vj = cards[j] & 0xf;
            if (vj == v) {
                ++count;
            } else {
                break;
            }
        }
        if (count == 1) {
            ret.push(cards[i])
        } else {
            i += count - 1;
        }
    }
    GameLogic.sortCardList(ret, ret.length, GameLogic.enAscend);
    console.log(ret);
    return ret;
}

function local_sortCards(a, b) {
    var lenA = 0;
    var lenB = 0;
    for (var i = 0; i < a.length; ++i) {
        if (a[i] == 0) {
            lenA = i;
            break;
        }
    }
    for (var i = 0; i < b.length; ++i) {
        if (b[i] == 0) {
            lenB = i;
            break;
        }
    }
    if (lenB - lenA != 0) {
        return lenB - lenA;
    }
    if (lenA == 0 && lenB == 0) {
        return 0;
    }
    return local_compareCard(b.slice(0, 5), a.slice(0, 5));
}

function local_compareCard(cards, fistCards) {
    return GameLogic.compareCard(fistCards, cards, fistCards.length, cards.length, true)
}

function local_getLValue(v) {
    var ret = v & 0xf;
    if (ret == 1) {
        ret = 14;
    }
    return ret;
}

function local_sortCardsHuLuAndTieZhi(a, b) {
    var va = local_getLValue(a[0]) * 100 + (100 - local_getLValue(a[4]));
    var vb = local_getLValue(b[0]) * 100 + (100 - local_getLValue(b[4]));
    if (local_getLValue[0] != local_getLValue[2]) {
        va = local_getLValue(a[4]) * 100 + (100 - local_getLValue(a[0]));
        vb = local_getLValue(b[4]) * 100 + (100 - local_getLValue(b[0]));
    }
    return vb - va;
}

function getCardsByType(cards, eCardType) {
    if (!cards || cards.length == 0) {
        return null;
    }
    if (eCardType == CARD_TYPE_DUIZI) {
        var SearchCardResult = GameLogic.struct_tagSearchCardResult();
        GameLogic.searchSameCard(cards, cards.length, 2, SearchCardResult);
        if (SearchCardResult.cbSearchCount >= 1) {
            var appendSingleCards = getSingleCards(cards);
            if (appendSingleCards.length > 3) {
                appendSingleCards.length = 3;
            }
            for (var i = 0; i < SearchCardResult.cbSearchCount; ++i) {
                SearchCardResult.cbCardCount[i] = 2 + appendSingleCards.length;
                for (var j = 0; j < appendSingleCards.length; ++j) {
                    SearchCardResult.cbResultCard[i][2 + j] = appendSingleCards[j];
                }
            }
            if (SearchCardResult.cbSearchCount > 1) {
                SearchCardResult.cbResultCard.sort(local_sortCards);
            }
            return SearchCardResult;
        }
    }
    if (eCardType == CARD_TYPE_LIANGDUI) {
        var SearchCardResult = GameLogic.struct_tagSearchCardResult();
        GameLogic.searchSameCard(cards, cards.length, 2, SearchCardResult);
        console.log(SearchCardResult);
        if (SearchCardResult.cbSearchCount >= 2) {
            for (var i = 0; i < SearchCardResult.cbSearchCount - 1; ++i) {
                SearchCardResult.cbCardCount[i] = 4;
                SearchCardResult.cbResultCard[i][2] = SearchCardResult.cbResultCard[i + 1][0];
                SearchCardResult.cbResultCard[i][3] = SearchCardResult.cbResultCard[i + 1][1];
            }
            --SearchCardResult.cbSearchCount;
            SearchCardResult.cbResultCard[SearchCardResult.cbSearchCount][0] = 0;
            SearchCardResult.cbResultCard[SearchCardResult.cbSearchCount][1] = 0;
            SearchCardResult.cbCardCount[SearchCardResult.cbSearchCount] = 0;
            var appendSingleCards = getSingleCards(cards);
            if (appendSingleCards.length > 1) {
                appendSingleCards.length = 1;
            }
            for (var i = 0; i < SearchCardResult.cbSearchCount; ++i) {
                SearchCardResult.cbCardCount[i] = 4 + appendSingleCards.length;
                for (var j = 0; j < appendSingleCards.length; ++j) {
                    SearchCardResult.cbResultCard[i][4 + j] = appendSingleCards[j];
                }
            }
            if (SearchCardResult.cbSearchCount > 1) {
                SearchCardResult.cbResultCard.sort(local_sortCards);
            }
            return SearchCardResult;
        }
    }
    if (eCardType == CARD_TYPE_SANTIAO) {
        var SearchCardResult = GameLogic.struct_tagSearchCardResult();
        GameLogic.searchSameCard(cards, cards.length, 3, SearchCardResult);
        if (SearchCardResult.cbSearchCount >= 1) {
            var appendSingleCards = getSingleCards(cards);
            if (appendSingleCards.length > 2) {
                appendSingleCards.length = 2;
            }
            for (var i = 0; i < SearchCardResult.cbSearchCount; ++i) {
                SearchCardResult.cbCardCount[i] = 3 + appendSingleCards.length;
                for (var j = 0; j < appendSingleCards.length; ++j) {
                    SearchCardResult.cbResultCard[i][3 + j] = appendSingleCards[j];
                }
            }
            if (SearchCardResult.cbSearchCount > 1) {
                SearchCardResult.cbResultCard.sort(local_sortCards);
            }
            return SearchCardResult;
        }
    }
    if (eCardType == CARD_TYPE_SHUNZI) {
        var SearchCardResult = GameLogic.struct_tagSearchCardResult();
        GameLogic.searchLineCardType(cards, cards.length, 5, SearchCardResult);
        if (SearchCardResult.cbSearchCount >= 1) {
            if (SearchCardResult.cbSearchCount > 1) {
                SearchCardResult.cbResultCard.sort(local_sortCards);
            }
            return SearchCardResult;
        }
    }
    if (eCardType == CARD_TYPE_TONGHUA) {
        var SearchCardResult = GameLogic.struct_tagSearchCardResult();
        GameLogic.searchSameColorType(cards, cards.length, 5, SearchCardResult);
        if (SearchCardResult.cbSearchCount >= 1) {
            if (SearchCardResult.cbSearchCount > 1) {
                SearchCardResult.cbResultCard.sort(local_sortCards);
            }
            return SearchCardResult;
        }
    }
    if (eCardType == CARD_TYPE_HULU) {
        var SearchCardResult = GameLogic.struct_tagSearchCardResult();
        GameLogic.searchTakeCardType(cards, cards.length, 3, 2, SearchCardResult);
        if (SearchCardResult.cbSearchCount >= 1) {
            if (SearchCardResult.cbSearchCount > 1) {
                SearchCardResult.cbResultCard.sort(local_sortCardsHuLuAndTieZhi);
            }
            return SearchCardResult;
        }
    }
    if (eCardType == CARD_TYPE_TIEZHI) {
        var SearchCardResult = GameLogic.struct_tagSearchCardResult();
        GameLogic.searchTakeCardType(cards, cards.length, 4, 1, SearchCardResult);
        if (SearchCardResult.cbSearchCount >= 1) {
            if (SearchCardResult.cbSearchCount > 1) {
                SearchCardResult.cbResultCard.sort(local_sortCardsHuLuAndTieZhi);
            }
            return SearchCardResult;
        }
    }
    if (eCardType == CARD_TYPE_TONGHUASHUN) {
        var SearchCardResult = GameLogic.struct_tagSearchCardResult();
        GameLogic.searchSameColorLineType(cards, cards.length, 5, SearchCardResult);
        if (SearchCardResult.cbSearchCount >= 1) {
            if (SearchCardResult.cbSearchCount > 1) {
                SearchCardResult.cbResultCard.sort(local_sortCards);
            }
            return SearchCardResult;
        }
    }
    if (eCardType == CARD_TYPE_WUTONG) {
        var SearchCardResult = GameLogic.struct_tagSearchCardResult();
        GameLogic.searchSameCard(cards, cards.length, 5, SearchCardResult);
        if (SearchCardResult.cbSearchCount >= 1) {
            return SearchCardResult;
        }
    }
    return null;
};

function myAutoPutCard(cards) {
    var tmpCards = cards.slice(0);
    var ret = [];
    var dao3 = [];
    for (var i = 9; i >= 0; --i) {
        var result = getCardsByType(tmpCards, i);
        if (result) {
            dao3 = result.cbResultCard[0].slice(0, 5);
            break;
        }
    }

    for (var i = 0; i < dao3.length; ++i) {
        for (var j = 0; j < tmpCards.length; ++j) {
            if (tmpCards[j] == dao3[i]) {
                tmpCards.splice(j, 1);
                break;
            }
        }
    }

    var dao1 = [tmpCards[tmpCards.length - 1]];
    var rv = dao1[0] & 0xf;

    for (var i = 1; i < tmpCards.length; ++i) {
        var index = tmpCards.length - i - 1;
        if ((tmpCards[index] & 0xf) != rv) {
            rv = tmpCards[index] & 0xf;
            dao1.push(tmpCards[index]);
            if (dao1.length == 3) {
                break;
            }
        }
    }

    for (var i = 0; i < dao1.length; ++i) {
        for (var j = 0; j < tmpCards.length; ++j) {
            if (tmpCards[j] == dao1[i]) {
                tmpCards.splice(j, 1);
                break;
            }
        }
    }

    var dao2 = tmpCards.slice(0);

    ret[0] = dao1[0];
    ret[1] = dao1[1];
    ret[2] = dao1[2];
    ret[3] = dao2[0];
    ret[4] = dao2[1];
    ret[5] = dao2[2];
    ret[6] = dao2[3];
    ret[7] = dao2[4];
    ret[8] = dao3[0];
    ret[9] = dao3[1];
    ret[10] = dao3[2];
    ret[11] = dao3[3];
    ret[12] = dao3[4];

    return ret;
}

ThirteenGameServer.autoPutCard = function (chairId) {
    var player = this.players[chairId];
    var outputCards = [];
    // GameLogic.autoPutCard(player.cards, outputCards, false, false);
    outputCards = myAutoPutCard(player.cards);
    console.log(outputCards);

    player.segmentCards[0] = outputCards.slice(0, 3);
    player.segmentCards[1] = outputCards.slice(3, 8);
    player.segmentCards[2] = outputCards.slice(8, 13);
    var errorInfo = {};
    this.commitPutCards(player, errorInfo);
    console.log(errorInfo);
};

ThirteenGameServer.calSpecialTypeTotalScore = function (bHandCardData, bCardCount) {

    var totalScore = 0;
    var specialTypeArray = [];
    var score = 0;
    for (let i = 0; i < 7; i++) {   //7种特殊牌判断，配对成功累计道数
        var ret = GameLogic.getAllSpecialType(bHandCardData, bCardCount, i);
        console.log("Current Special Type is   " + ret);


        score = (this.roomInfo.seats.length == 3 && (ret == 23 || ret == 22 || ret == 36 || ret == 37)) ? 0 : calcSpecialTypeScore(ret);
        if (score != 0) {
            specialTypeArray.push(ret);
        }

        totalScore += score;
        if (ret == 27) {
            break;
        }
    }
    console.log("calSpecialTypeTotalScore is  " + totalScore);
    return [totalScore, specialTypeArray];

}
function calcSpecialTypeScore(specialType, daQiang1Fen) {
    var ret = 0;
    if (specialType == GameLogic.CT_EX_SANTONGHUA) {
        ret = specialScoreConfig.SAN_TONG_HUA;
    } else if (specialType == GameLogic.CT_EX_SANSHUNZI) {
        ret = specialScoreConfig.SAN_SHUN_ZI;
    } else if (specialType == GameLogic.CT_EX_QUANXIAO) {
        ret = specialScoreConfig.QUAN_XIAO;
    } else if (specialType == GameLogic.CT_EX_QUANDA) {
        ret = specialScoreConfig.QUAN_DA;
    } else if (specialType == GameLogic.CT_EX_BANXIAO) {
        ret = specialScoreConfig.BAN_XIAO;
    } else if (specialType == GameLogic.CT_EX_BANDA) {
        ret = specialScoreConfig.BAN_DA;
    } else if (specialType == GameLogic.CT_EX_LIUDUIBAN) {
        ret = specialScoreConfig.LIU_DUI_BAN;
    } else if (specialType == GameLogic.CT_EX_WUDUISANTIAO) {
        ret = specialScoreConfig.WU_DUI_SAN_TIAO;
    } else if (specialType == GameLogic.CT_EX_SAN_HU_LU) {
        ret = specialScoreConfig.SAN_HU_LU;
    } else if (specialType == GameLogic.CT_EX_QUAN_HEI_YIDIANHONG) {
        ret = specialScoreConfig.QUAN_HEI_YIDIANHONG;
    } else if (specialType == GameLogic.CT_EX_QUAN_HONG_YIDIANHEI) {
        ret = specialScoreConfig.QUAN_HONG_YIDIANHEI;
    } else if (specialType == GameLogic.CT_EX_QUAN_HEI) {
        ret = specialScoreConfig.QUAN_HEI;
    } else if (specialType == GameLogic.CT_EX_QUAN_HONG) {
        ret = specialScoreConfig.QUAN_HONG;
    } else if (specialType == GameLogic.CT_EX_SANFENGTIANXIA) {
        ret = specialScoreConfig.SAN_FEN_TIAN_XIA;
    } else if (specialType == GameLogic.CT_EX_SANTONGHUASHUN) {
        ret = specialScoreConfig.SAN_TONG_HUA_SHUN;
    } else if (specialType == GameLogic.CT_EX_YITIAOLONG) {
        ret = specialScoreConfig.YI_TIAO_LONG;
    } else if (specialType == GameLogic.CT_EX_ZHIZUNQINGLONG) {
        ret = specialScoreConfig.QING_LONG;
    }
    // if (daQiang1Fen) {
    //     if (specialType == GameLogic.CT_EX_SANTONGHUA || specialType == GameLogic.CT_EX_SANSHUNZI || specialType == GameLogic.CT_EX_LIUDUIBAN) {
    //         ret += 1;
    //     }
    // }else {
    //     ret *= 2;
    // }
    return ret;
}

function calcExScore(daoIndex, cardType) {
    if (daoIndex == 0 && cardType == GameLogic.CT_THREE) {
        return specialScoreConfig.CHONG_SAN;
    } else if (daoIndex == 1 && cardType == GameLogic.CT_FIVE_THREE_DEOUBLE) {
        return specialScoreConfig.ZHONG_DAO_HU_LU;
    } else if (daoIndex == 1 && cardType == GameLogic.CT_FIVE_FOUR_ONE) {
        return specialScoreConfig.ZHONG_DAO_TIE_ZHI;
    } else if (daoIndex == 2 && cardType == GameLogic.CT_FIVE_FOUR_ONE) {
        return specialScoreConfig.WEI_DAO_TIE_ZHI;
    } else if (daoIndex == 1 && (cardType == GameLogic.CT_FIVE_STRAIGHT_FLUSH || cardType == GameLogic.CT_FIVE_STRAIGHT_FLUSH_FIRST_A)) {
        return specialScoreConfig.ZHONG_DAO_TONG_HUA_SHUN;
    } else if (daoIndex == 2 && (cardType == GameLogic.CT_FIVE_STRAIGHT_FLUSH || cardType == GameLogic.CT_FIVE_STRAIGHT_FLUSH_FIRST_A)) {
        return specialScoreConfig.WEI_DAO_TONG_HUA_SHUN;
    } else if (daoIndex == 1 && cardType == GameLogic.CT_FIVE) {
        return specialScoreConfig.ZHONG_DAO_WU_TONG;
    } else if (daoIndex == 2 && cardType == GameLogic.CT_FIVE) {
        return specialScoreConfig.WEI_DAO_WU_TONG;
    }
    return 0;
}

ThirteenGameServer.genResult = function () {
    var scoreMat = [];
    var daQiang = [];
    var specialMat = [];
    var specialTypeArr = [];
    var chiMat = [];
    var count = this.players.length;
    var daoScoreMat = [[], [], []];

    function local_tideScoreMat(mat) {
        var count = mat.length;
        for (var i = 0; i < count; ++i) {
            for (var j = 0; j < count; ++j) {
                if (i > j) {
                    if (mat[j][i] != 0) {
                        mat[i][j] = -mat[j][i];
                    } else {
                        mat[i][j] = 0;
                    }

                }
            }
        }
    }

    for (var i = 0; i < count; ++i) {
        scoreMat[i] = [];
        chiMat[i] = [];
        specialTypeArr[i] = [];
        specialMat[i] = [];
        daoScoreMat[0][i] = [];
        daoScoreMat[1][i] = [];
        daoScoreMat[2][i] = [];
        for (var j = 0; j < count; ++j) {
            scoreMat[i][j] = 0;
            chiMat[i][j] = 0;
            specialMat[i][j] = 0;
            daoScoreMat[0][i][j] = 0;
            daoScoreMat[1][i][j] = 0;
            daoScoreMat[2][i][j] = 0;
        }
    }


    for (var i = 0; i < count; ++i) {
        for (var j = 0; j < count; ++j) {
            if (i == j) {
                continue;
            } else if (i < j) {
                var playerI = this.players[i];
                var playerJ = this.players[j];


                if (playerI.specialType == GameLogic.CT_EX_YITIAOLONG || playerJ.specialType == GameLogic.CT_EX_YITIAOLONG) {
                    continue;

                }
                var daos = [];
                var daQiangIToJ = true;
                var daQiangJtoI = true;
                for (var daoIndex = 0; daoIndex < 3; ++daoIndex) {

                    daos[daoIndex] = GameLogic.compareCard(playerJ.segmentCards[daoIndex], playerI.segmentCards[daoIndex], playerJ.segmentCards[daoIndex].length, playerI.segmentCards[daoIndex].length, true);
                    if (daos[daoIndex] <= 0) {
                        daQiangIToJ = false;
                    }
                    if (daos[daoIndex] >= 0) {
                        daQiangJtoI = false;
                    }

                }

                if (daQiangIToJ) {
                    //scoreMat[i][j] = calcDaQiangScore(scoreMat[i][j], true);
                    if (count == 3) {
                        scoreMat[i][j] += 6;
                        chiMat[i][j] += 6;
                    }

                    daQiang.push([i, j]);
                }
                if (daQiangJtoI) {
                    // scoreMat[i][j] = -calcDaQiangScore(-scoreMat[i][j], true); //this.roomInfo.conf.daQiangAdd1  //某一个人对另一个人打枪加了1分
                    if (count == 3) {
                        scoreMat[i][j] -= 6;
                        chiMat[i][j] -= 6;
                    }

                    daQiang.push([j, i]);
                }
            }
        }
    }


    function local_find(arr, m1, m2) {
        for (var i = 0; i < arr.length; ++i) {
            if (arr[i][0] == m1 && arr[i][1] == m2) {
                return true;
            }
        }
        return false;
    }


    for (var i = 0; i < count; ++i) {
        for (var j = 0; j < count; ++j) {
            if (i == j) {
                continue;
            } else if (i < j) {
                var playerI = this.players[i];
                var playerJ = this.players[j];


                if (playerI.specialType == GameLogic.CT_EX_YITIAOLONG || playerJ.specialType == GameLogic.CT_EX_YITIAOLONG) {
                    continue;

                }
                var daos = [];
                for (var daoIndex = 0; daoIndex < 3; ++daoIndex) {

                    daos[daoIndex] = GameLogic.compareCard(playerJ.segmentCards[daoIndex], playerI.segmentCards[daoIndex], playerJ.segmentCards[daoIndex].length, playerI.segmentCards[daoIndex].length, true);

                    //if(local_find(daQiang,i,j)&&(daos[daoIndex]==1||daos[daoIndex]==-1)){

                    //  scoreMat[i][j] += daos[daoIndex];  //比出结果 先加1分，然后算中道和尾道 特殊分，设置值得时候要减1
                    // }
                    var daoEx = 0;
                    if (daos[daoIndex] > 0) {
                        daoEx = calcExScore(daoIndex, GameLogic.getCardType(playerI.segmentCards[daoIndex], playerI.segmentCards[daoIndex].length)[0]);
                    } else if (daos[daoIndex] < 0) {
                        daoEx = calcExScore(daoIndex, GameLogic.getCardType(playerJ.segmentCards[daoIndex], playerJ.segmentCards[daoIndex].length)[0]);

                    }
                    // if (daoEx > 0) {
                    //     console.log("积分")
                    //     console.log(daoIndex)
                    //     console.log(daoEx)
                    //     console.log(daos[daoIndex])
                    //     scoreMat[i][j] += daoEx * daos[daoIndex];
                    // }

                    var scoreIJ = daos[daoIndex] + daoEx * daos[daoIndex];
                    if ((local_find(daQiang, i, j) || local_find(daQiang, j, i)) && (scoreIJ == 1 || scoreIJ == -1)) {
                        if (count == 3) {

                        }
                        else {
                            scoreMat[i][j] += scoreIJ;
                            daoScoreMat[daoIndex][i][j] += scoreIJ;
                        }

                    } else {
                        scoreMat[i][j] += scoreIJ;
                        daoScoreMat[daoIndex][i][j] += scoreIJ;

                    }
                }

                if (count == 4) {
                    // console.log(local_find(daQiang,i,j));
                    // console.log(local_find(daQiang,j,i));
                    if (local_find(daQiang, i, j) || local_find(daQiang, j, i)) {

                        chiMat[i][j] = scoreMat[i][j];
                        scoreMat[i][j] *= 2;
                        console.log("全吃分数翻倍罗" + "players  " + i + "players   " + j + "  score is " + scoreMat[i][j]);
                    }
                }

            }
        }
    }


    local_tideScoreMat(daoScoreMat[0]);
    local_tideScoreMat(daoScoreMat[1]);
    local_tideScoreMat(daoScoreMat[2]);
    console.log(daoScoreMat);

    function powerCalculator(base, power) {
        var number = base;
        if (power == 1)
            return number;
        if (power == 0)
            return 1;
        for (var i = 2; i <= power; i++) {
            number = number * base;
        }
        return number;
    }




    function local_findArr(arr, playerCount) {
        var leiDaArray = [];
        for (var i = 0; i < playerCount; i++) {
            var sameI = 0;
            var sameIArr = [];
            for (var j = 0; j < arr.length; ++j) {

                if (arr[j][0] == i) {
                    sameIArr.push(arr[j][1]);
                    sameI = sameI + 1;
                }
            }
            if (sameI != 0)
                leiDaArray.push([i, sameI, sameIArr]);

        }

        return leiDaArray;
    }


    // var leiDaArr=local_findArr(daQiang,count);

    // for(let i=0;i<daQiang.length;i++)
    // console.log('DaQiang'+ daQiang[i]);

    // for(let c=0;c<leiDaArr.length;c++)
    //   console.log('leiDaArr'+leiDaArr[c]);

    // for(let i=0;i<leiDaArr.length;i++){
    //     if(leiDaArr[i][1]>=2 &&count>3){
    //         let additionalQuanChi=(powerCalculator(2,leiDaArr[i][2].length-1)-1)*6;
    //         console.log('additional score'+ additionalQuanChi);
    //         for(let j=0;j<leiDaArr[i][2].length;j++){
    //             if(leiDaArr[i][0]<leiDaArr[i][2][j]){
    //                 scoreMat[leiDaArr[i][0]][leiDaArr[i][2][j]]+= additionalQuanChi;
    //                 quanChiMat[leiDaArr[i][0]][leiDaArr[i][2][j]]+=additionalQuanChi;
    //             }
    //             else{
    //                 scoreMat[leiDaArr[i][2][j]][leiDaArr[i][0]]-= additionalQuanChi;
    //                 quanChiMat[leiDaArr[i][2][j]][leiDaArr[i][0]]-=additionalQuanChi;
    //             }

    //         }
    //     }
    // }
    var quanLeiDaChairId = -1;
    if (count > 2 && daQiang.length >= count - 1) {
        for (var j = 0; j < count; ++j) {
            var quanLeiDa = true;
            for (var k = 0; k < count; ++k) {
                if (j != k && !local_find(daQiang, j, k)) {
                    quanLeiDa = false;
                    break;
                }
            }
            if (quanLeiDa) {
                quanLeiDaChairId = j;
                break;
            }
        }
    }

    if (this.roomInfo.conf.isZhuangJia) {
        quanLeiDaChairId = -1;
    }

    if (quanLeiDaChairId >= 0) {  //玩法针对3个人和4个人
        for (var i = 0; i < count; ++i) {
            if (quanLeiDaChairId > i) {
                if (count == 3) {
                    //scoreMat[i][quanLeiDaChairId] -= 6;
                } else {
                    chiMat[i][quanLeiDaChairId] *= 3;
                    scoreMat[i][quanLeiDaChairId] *= 2;
                }

            } else {
                if (count == 3) {
                    if (quanLeiDaChairId == i) {
                        continue;
                    } else {
                        // scoreMat[quanLeiDaChairId][i] += 6;
                    }

                } else {
                    chiMat[quanLeiDaChairId][i] *= 3;
                    scoreMat[quanLeiDaChairId][i] *= 2;
                }

            }
        }
    }

    for (var i = 0; i < count; ++i) {
        for (var j = 0; j < count; ++j) {
            if (i == j) {
                continue;
            } else if (i < j) {
                var playerI = this.players[i];
                var playerJ = this.players[j];

                if (playerI.specialType > GameLogic.CT_EX_INVALID || playerJ.specialType > GameLogic.CT_EX_INVALID) {
                    if (playerI.specialType == GameLogic.CT_EX_INVALID) {
                        let value = this.calSpecialTypeTotalScore(playerJ.cards, playerJ.cards.length);
                        scoreMat[i][j] -= value[0];
                        specialMat[i][j] -= value[0];
                        specialTypeArr[j] = value[1];

                    } else if (playerJ.specialType == GameLogic.CT_EX_INVALID) {
                        let value = this.calSpecialTypeTotalScore(playerI.cards, playerI.cards.length);
                        scoreMat[i][j] += value[0];
                        specialMat[i][j] += value[0];
                        specialTypeArr[i] = value[1];

                    } else {

                        let valueI = this.calSpecialTypeTotalScore(playerI.cards, playerI.cards.length);
                        let valueJ = this.calSpecialTypeTotalScore(playerJ.cards, playerJ.cards.length);

                        // if (playerI.specialType == GameLogic.CT_EX_YITIAOLONG|| playerJ.specialType ==GameLogic.CT_EX_YITIAOLONG){

                        //     if(playerI.specialType != GameLogic.CT_EX_YITIAOLONG){
                        //         scoreMat[i][j] -= valueJ[0];
                        //         specialMat[i][j]-=valueJ[0];
                        //         specialTypeArr[i]=valueI[1];
                        //         specialTypeArr[j]=valueJ[1];
                        //     }else if(playerJ.specialType != GameLogic.CT_EX_YITIAOLONG){

                        //         scoreMat[i][j] += valueI[0];
                        //         specialMat[i][j]+=valueI[0];
                        //         specialTypeArr[i]=valueI[1];
                        //         specialTypeArr[j]=valueJ[1];
                        //     }
                        //     else{
                        //         specialTypeArr[i]=valueI[1];
                        //         specialTypeArr[j]=valueJ[1];
                        //     }

                        // }else{                                                  //没有一条龙的特殊牌
                        scoreMat[i][j] += valueI[0] - valueJ[0];
                        specialMat[i][j] += valueI[0] - valueJ[0];
                        specialTypeArr[i] = valueI[1];
                        specialTypeArr[j] = valueJ[1];
                        //}
                    }

                }
            }
        }
    }

    console.log(scoreMat);
    local_tideScoreMat(scoreMat);
    local_tideScoreMat(specialMat);
    local_tideScoreMat(chiMat);
    console.log(scoreMat);

    for (var i = 0; i < this.players.length; ++i) {
        var player = this.players[i];
        var result = this.results[i];
        var totalScore = 0;
        var totalSpecialScore = 0;
        var totalChiScore = 0;
        for (var j = 0; j < count; ++j) {
            totalScore += scoreMat[i][j];
            totalSpecialScore += specialMat[i][j];
            totalChiScore += chiMat[i][j];
        }

        result.score = totalScore;
        result.specialScore = totalSpecialScore;
        result.ChiScore = totalChiScore;
        //result.leiDaDetails= leiDaArr;
        result.specialTypeArr = specialTypeArr[i];
        result.segmentCards[0] = player.segmentCards[0].slice(0);
        result.segmentCards[1] = player.segmentCards[1].slice(0);
        result.segmentCards[2] = player.segmentCards[2].slice(0);

        var cards=[];
        cards = cards.concat(player.segmentCards[0]);
        cards = cards.concat(player.segmentCards[1]);
        cards = cards.concat(player.segmentCards[2]);

       if (player.specialType == 27) {
                  this.addSpecialChuPaiAction(i, player.specialType, player.cards);
            } else {
                     this.addChuPaiAction(i, cards);
          
            }
        result.isSpecialCardType = player.specialType == 27;
        result.segmentScore = [0, 0, 0];
        for (var dao = 0; dao < 3; ++dao) {
            for (var j = 0; j < this.players.length; ++j) {
                result.segmentScore[dao] += daoScoreMat[dao][i][j];
            }
        }

        if (!result.isSpecialCardType) {
            result.segmentCardsType[0] = GameLogic.getCardType(player.segmentCards[0], player.segmentCards[0].length)[0];
            result.segmentCardsType[1] = GameLogic.getCardType(player.segmentCards[1], player.segmentCards[1].length)[0];
            result.segmentCardsType[2] = GameLogic.getCardType(player.segmentCards[2], player.segmentCards[2].length)[0];
        }


        result.specialCardType = player.specialType;
        result.cards = cards;


        for (var j = 0; j < daQiang.length; ++j) {
            if (daQiang[j][0] == i) {
                result.daQiang.push(daQiang[j][1]);
            }
        }
        if (quanLeiDaChairId == i) {
            result.quanLeiDa = true;
        }
    }



    console.log(this.results);
};

ThirteenGameServer.reportResult = function () {
    //cdw test
    // ThirteenGame.reportResult(this.results);
    var seats = this.roomInfo.seats;
    for (var i = 0; i < seats.length; ++i) {
        //开局时，通知前端必要的数据
        var s = seats[i];
        //通知玩家手牌
        userMgr.sendMsg(s.userId, 'turn_results_push', this.results);
    }
};

ThirteenGameServer.gameover = function () {
    //cdw test
    saveDB(this);
    var i = 0;
    for (i = 0; i < this.players.length; ++i) {
        var player = this.players[i];
        player.isReady = false;
        this.roomInfo.seats[i].ready = false;
        this.roomInfo.seats[i].isPutCardOk = false;
    }
    this.state = EGameState.OTHER_PHASE;
    this.roomInfo.game = null;
    this.roomInfo.playing = false;

    //第一局结束扣钻石
    // if (this.roomInfo.numOfGames === 1) {
    //     var conf = this.roomInfo.conf;
    //     var cost = getCost(conf);
    //     if (conf.isAA === true) {
    //         for (i = 0; i < this.players.length; i++) {
    //             var userId = this.roomInfo.seats[i].userId;
    //             db.cost_gems(userId,
    //                 cost,
    //                 CASH_CHANGE_RESONS.COST_CREATE_ROOM.format(this.roomInfo.id));
    //         }
    //     } else {
    //         db.cost_gems(conf.creator,
    //             cost,
    //             CASH_CHANGE_RESONS.COST_CREATE_ROOM.format(this.roomInfo.id));
    //     }
    // }
};

function saveDB(game) {
    if (!game || !game.roomInfo) {
        return;
    }

    var roomInfo = game.roomInfo;

    //基础信息
    var baseInfo = {
        //游戏类型
        type: roomInfo.conf.type,
        //游戏局数
        index: roomInfo.numOfGames,
        //2,3,4人场
        mode: roomInfo.conf.maxChair,
    };

    var dbresult = [0, 0, 0, 0];
    for (var i = 0; i < game.players.length; ++i) {
        var result = game.results[i];
        dbresult[i] = result.score;
    }

    //todo
    var strInfo = JSON.stringify(baseInfo);

    db.create_game(game.roomInfo.gametype, game.roomInfo.gamemode, game.roomInfo.uuid, roomInfo.numOfGames, strInfo);

    //记录玩家操作
    var str = JSON.stringify(game.actionList);
    console.log(str);
    db.update_game_action_records(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid, roomInfo.numOfGames, str);

    //保存游戏局数
    db.update_num_of_turns(roomInfo.gametype, roomInfo.gamemode, roomInfo.id, roomInfo.numOfGames);

    //保存分数，用于快速查看
    db.update_game_result(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid, roomInfo.numOfGames, dbresult);

    roomMgr.updateScores(roomInfo.id);
}

ThirteenGameServer.checkAllPutCard = function () {
    for (var i = 0; i < this.players.length; ++i) {
        var player = this.players[i];
        if (!player.isPutCardOk) {
            return false;
        }
    }
    return true;
};

ThirteenGameServer.checkHostingUserPutCard = function () {
    var hostingPutCards = true;
    for (var i = 0; i < this.players.length; ++i) {
        var player = this.players[i];
        if (!player.isPutCardOk) {
            var seat = this.roomInfo.seats[player.chairId];
            if (seat != null && this.hostingUsers != null) {
                var hostData = this.hostingUsers[seat.userId];
                hostingPutCards = hostingPutCards && (hostData != null && hostData.state == HOST_STATE.ONGOING);
            } else {
                hostingPutCards = false;
            }
        }
    }

    if (hostingPutCards === true) {
        this.autoPutAll();
    }
}

ThirteenGameServer.setReady = function (chairId) {
    var player = this.players[chairId];
    player.isReady = true;

    var suc = this.checkAllReady();
    if (suc) {
        this.begin();
    }
};

ThirteenGameServer.checkAllReady = function () {
    for (var i = 0; i < this.players.length; ++i) {
        var player = this.players[i];
        if (!player.isReady) {
            return false;
        }
    }
    return true;
};

function checkCardValid(cards1, cards2) {
    if (!cards1 || !cards2 || cards1.length != cards2.length) {
        return false;
    }
    var tc1 = cards1.slice(0);
    var tc2 = cards2.slice(0);
    tc1.sort();
    tc2.sort();
    for (var i = 0; i < tc1.length; ++i) {
        if (tc1[i] != tc2[i]) {
            console.log(cards1, cards2);
            console.log(tc1, tc2);
            return false;
        }
    }
    return true;
}

ThirteenGameServer.manualCommitPutCards = function (userId) {
    //清除托管状态
    this.unHostUser(userId);
    //清除被强制出牌的次数
    this.numOfUserForcePutCards = this.numOfUserForcePutCards != null ? this.numOfUserForcePutCards : {};
    this.numOfUserForcePutCards[userId] = 0;
    //清除强制比牌的标记
    this.isLastGameForcePutCards = false;
    //判断托管玩家是否需要自动出牌
    this.checkHostingUserPutCard();
}

ThirteenGameServer.thirteenCommitPutCards = function (userId, data) {
    var seatData = gameSeatsOfUsers[userId];
    if (seatData == null) {
        console.log("can't find user game data.");
        return;
    }

    if (this.players[seatData.seatIndex].isPutCardOk) {
        console.log("can't find user game data.");
        return;
    }

    if (!data) {
        console.log("error!");
        return;
    }

    var player = this.players[seatData.seatIndex];

    if (data.length == 13) {
        // if (!checkCardValid(data, player.cards)) {
        //     console.log("commit card check fail!");
        //     return;
        // }
        var playerData = {};
        playerData.chairId = seatData.seatIndex;
        playerData.segmentCards = [];
        playerData.segmentCards[0] = data.slice(0, 3);
        playerData.segmentCards[1] = data.slice(3, 8);
        playerData.segmentCards[2] = data.slice(8, 13);
        this.commitPutCards(playerData);

        this.manualCommitPutCards(userId);
    } else if (typeof (data) == "number") {
        if (this.roomInfo.conf.hasSpecial) {
            console.log("no special!");
            return;
        }
        var specialType = GameLogic.getSpecialType(player.cards, player.cards.length);
        if (specialType != data) {
            console.log("commit card special type check fail");
            return;
        }
        var playerData = {};
        playerData.chairId = seatData.seatIndex;
        playerData.specialType = data;
        this.commitPutCards(playerData);

        this.manualCommitPutCards(userId);
    }
};

ThirteenGameServer.update = function () {
    var nowTime = Date.now();
    var dt = (nowTime - this.gameBeginTime);

    //如果开启了强制比牌
    if (this.needAutoPutCards === true) {
        //是否可以强制出牌
        if (dt >= this.forcePutCardsInterval) {
            var userId = this.roomInfo.seats[0].userId;
            userMgr.broacastInRoom('enable_force_put_cards_push', null, this.roomInfo, userId, true);
            this.enableForcePutCards = true;
            this.stopAutoPutCardsMonitor();
        }
    }

    if (this.roomInfo.conf.ziDongBaiPai) {
        var hostingListChange = false;
        //是否有玩家取消托管超时
        for (var userId in this.hostingUsers) {
            var hostData = this.hostingUsers[userId];
            if (hostData == null) {
                continue;
            }
            dt = nowTime - hostData.time;
            if (hostData.state == HOST_STATE.CANCELING && dt >= cancelHostingInterval) {
                hostData.state = HOST_STATE.ONGOING;
                hostData.time = 0;
                hostingListChange = true;
            }
        }

        if (hostingListChange === true) {
            var users = this.getHostingUsers();
            if (users.length > 0) {
                userMgr.broacastInRoom('hosting_users_push', users, this.roomInfo, users[0], true);
            }
        }
    }
};

ThirteenGameServer.force_put_cards = function (userId) {
    var seatId = roomMgr.getUserSeat(userId);
    var player = this.players[seatId];
    if (!this.enableForcePutCards || player == null || player.isPutCardOk == false) {
        return;
    }

    for (var i = 0; i < this.players.length; ++i) {
        player = this.players[i];

        if (player == null || player.isPutCardOk) {
            continue;
        }

        var seat = this.roomInfo.seats[player.chairId];
        if (seat == null) {
            continue;
        }

        var num = this.numOfUserForcePutCards[seat.userId];
        this.numOfUserForcePutCards[seat.userId] = num != null ? num + 1 : 1;
    }

    this.autoPutAll();
    this.isLastGameForcePutCards = true;
};

ThirteenGameServer.cancel_hosting = function (userId) {
    if (userId == null) {
        return;
    }

    this.cancelHostUser(userId);
};

exports.sync = function (userId) {
    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }

    var game = roomInfo.game;
    if (game) {
        if (game.state == EGameState.OTHER_PHASE) {

        } else if (game.state == EGameState.PUTTING_CARD_PHASE) {
            var data = {};
            data.state = game.state;
            data.putoverarr = [];
            data.auto_put_card = false;
            var players = game.players;
            for (var i = 0; i < players.length; ++i) {
                var player = players[i];
                data.putoverarr[i] = player.isPutCardOk;
                if (roomInfo.seats[i].userId == userId) {
                    data.cards = player.cards;
                    if (data.putoverarr[i]) {
                        data.putcards = [];
                        data.putcards = data.putcards.concat(player.segmentCards[0]);
                        data.putcards = data.putcards.concat(player.segmentCards[1]);
                        data.putcards = data.putcards.concat(player.segmentCards[2]);
                    }
                }
            }

            //计算自动摆牌剩余时间
            data.auto_put_card = game.needAutoPutCards != null ? game.needAutoPutCards : false;
            data.auto_left_time = game.forcePutCardsInterval - (Date.now() - game.gameBeginTime);

            userMgr.sendMsg(userId, 'game_sync', data);
        } else if (game.state == EGameState.COMPARING_CARD_PHASE) {

        }

        if (game.enableForcePutCards) {
            userMgr.sendMsg(userId, 'enable_force_put_cards_push');
        }

        var users = game.getHostingUsers();
        if (users.length > 0) {
            userMgr.sendMsg(userId, 'hosting_users_push', users);
        }
    }
    userMgr.sendMsg(userId, 'game_num_push', roomInfo.numOfGames);
};

function store_history(room) {
    var seats = room.seats;

    for (var i = 0; i < seats.length; ++i) {
        var seat = seats[i];
        db.create_user_history(room.gametype, room.gamemode, seat.userId, room.uuid);
    }
}

function doGameOver(roomInfo, forceEnd) {
    console.log("game end!");
    var seats = roomInfo.seats;
    for (var i = 0; i < seats.length; ++i) {
        var s = seats[i];
        userMgr.sendMsg(s.userId, 'game_end_push');
    }
    if (roomInfo && roomInfo.game) {
        roomInfo.game.stopAutoPutCardsMonitor();
    }
    roomInfo.game = null;

    delete games[roomInfo.id];

    //保存历史记录
    store_history(roomInfo);

    roomMgr.closeRoom(roomInfo.id, forceEnd);
}

exports.update = function () {
    for (var roomid in games) {
        var game = games[roomid];
        if (!game || !game.update || (typeof game.update != 'function')) {
            continue;
        }

        game.update();
    }
};

exports.forceEnd = function (roomInfo) {
    doGameOver(roomInfo, true);
};

exports.autoReadyHostingUsers = function (roomId) {
    var game = games[roomId];
    if (game) {
        game.autoReadyHostingUsers();
    }
};