var NetAdapter = {};
exports.NetAdapter = NetAdapter;

var userMgr = (require('../../../externals/game_utils/usermgr')).getUserMgr('niuniu');

NetAdapter.sendMsg = function (server, chairId, msg, data) {
    var s = server.roomInfo.seats[chairId];
    if (msg == "push_game_begin") {
        userMgr.sendMsg(s.userId, msg, data);
    }//获得2张牌

    if (msg == "game_num_push") {
        userMgr.sendMsg(s.userId, msg, data);
    }

    if (msg == "push_call_zhuang") {
        userMgr.sendMsg(s.userId, msg, data);
    }//获得叫庄信息
    if (msg == "push_confirm_banker") {
        userMgr.sendMsg(s.userId, msg, data);
    }//获得庄家
    if (msg == "push_ya_fen") {
        userMgr.sendMsg(s.userId, msg, data);
    }//获得压分信息

    if (msg == "push_stake_over") {
        userMgr.sendMsg(s.userId, msg, data);
    }//获得压分信息
    if (msg == "push_show_cards") {
        userMgr.sendMsg(s.userId, msg, data);
    }//获得亮牌信息    

    if (msg == "push_game_over") {
        userMgr.sendMsg(s.userId, msg, data);
    }

    if (msg == "push_game_sync") {
        userMgr.sendMsg(s.userId, msg, data);
    }
    if (msg == "push_max_player") {
        userMgr.sendMsg(s.userId, msg, data);
    }

    if (msg == "push_cuo_pai") {
        userMgr.sendMsg(s.userId, msg, data);
    }

    if (msg == "push_anima") {
        userMgr.sendMsg(s.userId, msg, data);
    }


    if (msg == "callZhuang") {
        server.onCallZhuang(data, chairId);
    }//叫庄
    if (msg == "setStake") {
        server.onStake(data, chairId);
    }//去压分
    if (msg == "look_at_cards") {
        server.onShowCards(chairId);
    }//点击亮牌
    if (msg == "confirm_players") {
        server.confirmPlayers(chairId);
    }
    if (msg == "send_cuo_pai") {
        server.cuoPai(chairId);
    }
    if (msg == "send_anima") {
        server.sendAnima(data, chairId);
    }
};