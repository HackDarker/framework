var ChanCheGame = require("./niuniu_server").Server;
var roomMgr = require("../roommgr");
var userMgr = (require('../../../externals/game_utils/usermgr')).getUserMgr('niuniu');
var db = require("../../../externals/utils/dbsync");
var crypto = require("../../../externals/utils/crypto");
var ChanCheConfig = require("./niuniu_config").ChanCheConfig;

/**
 * 获取消耗
 */
function getCost(conf) {
    var gemForm = {
        "false": {"10": 3, "20": 6},
        "true": {"10":1, "20": 2}
    }
    var cost = gemForm[conf.isAA][conf.numOfGames];
    return cost;
}

exports.getCost = getCost;

exports.checkConf = function (roomConf, gems) {
    if (roomConf.for_others) {
        roomConf.isAA = false;
    }
    var cost = getCost(roomConf);
    if (cost > gems) {
        return GAME_ERRS.GEMS_NOT_ENOUGH;
    }
    return RET_OK;
};

exports.getConf = function (roomConf, creator) {
    roomConf.creator = creator;
    return roomConf;
};

function createGame (roomId) {
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return;
    }
    
    var game = {};
    game.__proto__ = ChanCheGame;
    game.roomInfo = roomInfo;
    console.log(game.roomInfo.conf);
    var config = {
        maxPlayer: 6,
        playMode: game.roomInfo.conf.wanFa,
        batLv: game.roomInfo.conf.diFen
    };
    config.maxPlayer = roomInfo.seats.length;
    game.init(config);
    return game;
}

exports.begin = function (roomId) {
    var game = createGame(roomId);
    if (!game)
        return;
    var roomInfo = game.roomInfo;
    roomInfo.game = game;

    game.begin();
};

exports.sync = function (userId) {
    var roomId = roomMgr.getUserRoom(userId);
    if(roomId == null){
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return;
    }

    if (roomInfo.game) {
        var players = roomInfo.game.data.players;
        for (var i = 0; i < players.length; ++i) {
            var player = players[i];
            if (roomInfo.seats[i].userId == userId) {
                roomInfo.game.sync(i);
                break;
            }
        }
        userMgr.sendMsg(userId, 'game_num_push', roomInfo.numOfGames);
    }
};

exports.doGameOver = function (roomInfo, forceEnd) {
    ChanCheGame.doGameOver(roomInfo, forceEnd);
}