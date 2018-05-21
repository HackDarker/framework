var roomMgr = require("../roommgr");
var userMgr = (require('../../../externals/game_utils/usermgr')).getUserMgr('dht');
var mjutils = require('./cgmjutils');
var db = require("../../../externals/utils/dbsync");
var crypto = require("../../../externals/utils/crypto");
var fibers = require('fibers');

var games = {};
var gamesIdBase = 0;

var ACTION_CHUPAI = 1;
var ACTION_MOPAI = 2;
var ACTION_PENG = 3;
var ACTION_GANG = 4;
var ACTION_HU = 5;
var ACTION_ZIMO = 6;
var ACTION_CHI = 7;
//吃砰杠胡的托管时间  //为不了不影响客户的的出牌效果----托管时间延长
var tuoguantime = 600;
//出牌的托管时间
var ChuPaituoguantime = 600;
var diangangAndjiegang = {};
var userIdLocation = [];//gps
//自动托管房间
var tuoguanRoomList = [];
var TOUGUANTIMES = 16000;//自动托管时间


var gameSeatsOfUsers = {};

function getMJType(id) {
    if (id >= 0 && id < 9) {
        //筒
        return 0;
    }
    else if (id >= 9 && id < 18) {
        //条
        return 1;
    }
    else if (id >= 18 && id < 27) {
        //万
        return 2;
    }
    else {
        return 3;
    }
}

function shuffle(game) {
    shuffle0(game);
}

//筒 (0 ~ 8 表示筒子
//条 9 ~ 17表示条子
//条 18 ~ 26表示万
//字 27 ~ 33 东南西北中发白
function shuffleTest(game) {
    var mahjongs = game.mahjongs;
    var player = [];

    // player.push([]);
    // player.push([0,0,0,0,15,15,15,15]);
    // player.push([0, 15]);
    // player.push([]);

    player.push([8]);
    player.push([23, 23, 23, 0, 8, 8, 29, 24, 25, 0, 30, 30, 30, 0, 28, 28]);
    player.push([23, 0, 1, 2, 4, 5, 6, 10, 11, 12, 13, 14, 15, 0, 29, 29]);
    player.push([]);

    var len = 0;
    for (var i = 0; i < player.length; i++) {
        if (player[i].length > len) {
            len = player[i].length;
        }
    }

    var count = [];
    for (var i = 0; i < 34; i++) {
        count[i] = 0;
    }

    // 先统计预设的牌数
    for (var i = 0; i < player.length; i++) {
        for (var j = 0; j < player[i].length; j++) {
            count[player[i][j]]++;
        }
    }

    var index = 0;
    for (var i = 0; i < len; i++) {
        for (var j = 0; j < player.length; j++) {
            if (i < player[j].length) {
                var pai = player[j][i];
                mahjongs[index] = pai;
                index++;
            } else {
                // 没有指定的位置补漏
                for (var k = 0; k < 34; k++) {
                    if (count[k] < 4) {
                        mahjongs[index] = k;
                        index++;
                        count[k]++;
                        break;
                    }
                }
            }
        }
    }

    for (var i = 0; i < 34; i++) {
        while (count[i] < 4) {
            mahjongs[index] = i;
            index++;
            count[i]++;
        }
    }

    game.jings = [11, 29];
    game.jingMap[game.jings[1]] = true;

    game.roomInfo.lastJings = game.jings;

}

function shuffle0(game) {

    var mahjongs = game.mahjongs;

    //筒 (0 ~ 8 表示筒子
    var index = 0;
    for (var i = 0; i < 9; ++i) {
        for (var c = 0; c < 4; ++c) {
            mahjongs[index] = i;
            index++;
        }
    }

    //条 9 ~ 17表示条子
    for (var i = 9; i < 18; ++i) {
        for (var c = 0; c < 4; ++c) {
            mahjongs[index] = i;
            index++;
        }
    }

    //万
    //条 18 ~ 26表示万
    for (var i = 18; i < 27; ++i) {
        for (var c = 0; c < 4; ++c) {
            mahjongs[index] = i;
            index++;
        }
    }

    //东南西北中发白
    for (var i = 27; i < 34; ++i) {
        for (var c = 0; c < 4; ++c) {
            mahjongs[index] = i;
            index++;
        }
    }

    for (var i = 0; i < mahjongs.length; ++i) {
        var lastIndex = mahjongs.length - 1 - i;
        var index = Math.floor(Math.random() * lastIndex);
        var t = mahjongs[index];
        mahjongs[index] = mahjongs[lastIndex];
        mahjongs[lastIndex] = t;
    }

    game.jings = fanJing(game);
    game.jingMap[game.jings[1]] = true;
}


function mopai(game, seatIndex) {
    if (game.currentIndex == game.mahjongs.length) {
        return -1;
    }
    var data = game.gameSeats[seatIndex];
    var mahjongs = data.holds;
    var pai = game.mahjongs[game.currentIndex];
    mahjongs.push(pai);

    //统计牌的数目 ，用于快速判定（空间换时间）
    var c = data.countMap[pai];
    if (c == null) {
        c = 0;
    }
    data.countMap[pai] = c + 1;
    game.currentIndex++;
    if (game.jingMap[pai]) {
        game.hasMoJing = true;
    }
    return pai;
}

function deal(game) {
    //强制清0
    game.currentIndex = 0;

    //每人13张 一共 13*4 ＝ 52张 庄家多一张 53张
    var seatIndex = game.button;
    for (var i = 0; i < 52; ++i) {
        var mahjongs = game.gameSeats[seatIndex].holds;
        if (mahjongs == null) {
            mahjongs = [];
            game.gameSeats[seatIndex].holds = mahjongs;
        }
        mopai(game, seatIndex);
        seatIndex++;
        seatIndex %= 4;
    }

    //庄家多摸最后一张
    mopai(game, game.button);
    //当前轮设置为庄家
    game.turn = game.button;
}

//检查是否可以碰
function checkCanPeng(game, seatData, targetPai) {
    if (targetPai == game.jings[1]) {
        return;
    }
    if (!canChiPengGang(seatData, game.gameSeats[game.turn])) {
        return;
    }
    if (seatData.isDaLong) {
        return;
    }
    if (seatData.guoPengPai == targetPai) {
        return;
    }
    var count = seatData.countMap[targetPai];
    if (count != null && count >= 2) {
        seatData.canPeng = true;
    }
    //如果托管 通知前端碰
    if (seatData.isAutoPlay && seatData.canPeng) {
        setTimeout(function () {
            exports.peng(seatData.userId);
        }, tuoguantime);
    }
}

//检查是否可以点杠
function checkCanDianGang(game, seatData, targetPai, userId) {
    //检查玩家手上的牌
    //如果没有牌了，则不能再杠
    if (game.mahjongs.length <= game.currentIndex) {
        return;
    }
    if (seatData.isDaLong) {
        return;
    }
    // 龙牌不能杠
    if (targetPai == game.jings[1]) {
        return;
    }
    if (getMJType(targetPai) == seatData.que) {
        return;
    }
    if (!canChiPengGang(seatData, game.gameSeats[game.turn])) {
        return;
    }
    var count = seatData.countMap[targetPai];
    if (count != null && count >= 3) {
        seatData.canGang = true;
        seatData.gangPai.push(targetPai);
        var roomId = roomMgr.getUserRoom(userId);
        diangangAndjiegang[roomId] = userId;
        //  return;
    }

    //如果托管 通知前端点杠
    if (seatData.isAutoPlay && seatData.canGang) {
        setTimeout(function () {
            exports.gang(seatData.userId, targetPai);
        }, tuoguantime);
    }
}

//检查是否可以暗杠
function checkCanAnGang(game, seatData) {
    //如果没有牌了，则不能再杠
    if (game.mahjongs.length <= game.currentIndex) {
        return;
    }
    var paiid = null;
    for (var key in seatData.countMap) {
        var pai = parseInt(key);
        if (getMJType(pai) != seatData.que) {
            var c = seatData.countMap[key];
            if (c != null && c == 4 && pai != game.jings[1]) {
                paiid = pai;
                seatData.canGang = true;
                seatData.gangPai.push(pai);
            }
        }
    }

    //如果托管 通知前端暗杠
    if (seatData.isAutoPlay && seatData.canGang) {
        setTimeout(function () {
            exports.gang(seatData.userId, paiid);
        }, tuoguantime);
    }
}

//检查是否可以弯杠(自己摸起来的时候)
function checkCanWanGang(game, seatData, ignorePai) {
    //如果没有牌了，则不能再杠
    if (game.mahjongs.length <= game.currentIndex) {
        return;
    }
    var paiid = null;
    for (var i = 0; i < seatData.pengs.length; ++i) {
        var pai = seatData.pengs[i];
        if (pai == ignorePai) {
            continue;
        }
        if (seatData.countMap[pai] == 1) {
            seatData.canGang = true;
            paiid = pai;
            seatData.gangPai.push(pai);
        }
    }

    //如果托管 通知前端弯杠
    if (seatData.isAutoPlay && seatData.canGang) {
        setTimeout(function () {
            exports.gang(seatData.userId, paiid);
        }, tuoguantime);
    }
}

//检查是否可以吃
function checkCanChi(game, seatData, targetPai) {
    //检查玩家手上的牌
    seatData.canChi = false;

    if (game.conf.wanfaxuanze == 1) {
        return;
    }

    // 龙牌不能吃
    if (targetPai == game.jings[1]) {
        return;
    }

    if (seatData.isDaLong) {
        return;
    }

    // 风牌不能吃
    if (getMJType(targetPai) == 3) {
        return;
    }

    if (!canChiPengGang(seatData, game.gameSeats[game.turn])) {
        return;
    }

    //如果托管 通知前端过吃
    if (seatData.isAutoPlay) {
        setTimeout(function () {
            exports.chuPai(seatData.userId, seatData.holds[seatData.holds.length - 1]);
        }, ChuPaituoguantime);
        return;
    }

    //如果是筒条万，则检查A-2,A-1,A | A-1,A,A+1 | A,A+1,A+2
    var isNumeric = targetPai >= 0 && targetPai <= 26;
    var isZFB = targetPai >= 31 && targetPai <= 33;
    if (isNumeric || isZFB) {
        var t = targetPai % 9;
        if (targetPai == 33 || (!isZFB && t > 1)) {
            if (seatData.countMap[targetPai - 2] > 0
                && seatData.countMap[targetPai - 1] > 0
                && targetPai - 2 != game.jings[1]
                && targetPai - 1 != game.jings[1]) {
                seatData.canChi = true;
                return;
            }
        }

        if (targetPai == 32 || (!isZFB && t > 0 && t < 8)) {
            if (seatData.countMap[targetPai - 1] > 0
                && seatData.countMap[targetPai + 1] > 0
                && targetPai - 1 != game.jings[1]
                && targetPai + 1 != game.jings[1]) {
                seatData.canChi = true;
                return;
            }
        }

        if (targetPai == 31 || (!isZFB && t < 7)) {
            if (seatData.countMap[targetPai + 1] > 0
                && seatData.countMap[targetPai + 2] > 0
                && targetPai + 1 != game.jings[1]
                && targetPai + 2 != game.jings[1]) {
                seatData.canChi = true;
                return;
            }
        }
    }
    //如果是东南西北风
    else if (targetPai >= 27 && targetPai <= 30) {
        //只要另外的有两个以上即可
        var classCnt = 0;
        for (var i = 27; i <= 30; ++i) {
            if (i != targetPai && seatData.countMap[i] > 0) {
                classCnt++;
                if (classCnt >= 2) {
                    seatData.canChi = true;
                    return;
                }
            }
        }
    }

}

function hasHoldJings(seatData) {
    var fnSumArr = function (arr, target, n) {
        var num = 0;
        for (var k in arr) {
            var o = arr[k];
            if (typeof (o) == 'number') {
                var pai = o;
                if (target == pai) {
                    num += n;
                }
            }
            else {
                for (var i = 0; i < o.length; ++i) {
                    var pai = o[i];
                    if (target == pai) {
                        num++;
                    }
                }
            }
        }
        return num;
    }

    //console.log(seatData.holds);
    return fnSumArr(seatData.holds, seatData.game.jings[1], 1);
}

function hasHoldWinds(seatData) {
    var count = 0;
    for (var i = 0; i < seatData.holds.length; i++) {
        if (getMJType(seatData.holds[i]) == 3) {
            count++;
        }
    }
    return count;
}

function isSameTypeWithOutWind(type, arr) {
    for (var i = 0; i < arr.length; ++i) {
        var t = getMJType(arr[i]);
        if (type != -1 && type != t && t != 3 && type != 3) {
            return false;
        }
        if (t != 3) {
            type = t;
        }
    }
    return true;
}

function isSameType(gameSeatData, type, arr, checkJing) {
    for (var i = 0; i < arr.length; ++i) {
        if (checkJing && gameSeatData.game.jingMap[arr[i]] == true) {
            continue;
        }
        var t = getMJType(arr[i]);
        if (type != -1 && type != t) {
            return false;
        }
        type = t;
    }
    return true;
}

function findTypeWithOutJing(gameSeatData) {
    var fn = function (arr) {
        for (var i = 0; i < arr.length; i++) {
            if (gameSeatData.game.jingMap[arr[i]] == true) {
                continue;
            }
            return getMJType(arr[i]);
        }
        return -1;
    }

    //检查手上的牌
    var type = fn(gameSeatData.holds);
    if (type >= 0) {
        return type;
    }

    type = fn(gameSeatData.angangs);
    if (type >= 0) {
        return type;
    }

    type = fn(gameSeatData.wangangs);
    if (type >= 0) {
        return type;
    }

    type = fn(gameSeatData.diangangs);
    if (type >= 0) {
        return type;
    }

    for (var i = 0; i < gameSeatData.chis.length; i++) {
        type = fn(gameSeatData.chis[i]);
        if (type >= 0) {
            return type;
        }
    }

    type = fn(gameSeatData.pengs);
    if (type >= 0) {
        return type;
    }

    return -1;
}

function checkHunYiSe(gameSeatData) {
    var type = [0, 0, 0, 0];
    var countType = function (arr) {
        for (var i = 0; i < arr.length; ++i) {
            if (gameSeatData.game.jingMap[arr[i]] == true) {
                continue;
            }
            var t = getMJType(arr[i]);
            type[t] = 1;
        }
    };

    countType(gameSeatData.holds);
    countType(gameSeatData.angangs);
    countType(gameSeatData.wangangs);
    countType(gameSeatData.diangangs);
    for (var i = 0; i < gameSeatData.chis.length; i++) {
        countType(gameSeatData.chis[i]);
    }
    countType(gameSeatData.pengs);

    var otherTypeCount = type[0] + type[1] + type[2];
    if (type[3] == 1 && otherTypeCount == 0) {
        return 2;
    }

    if (type[3] == 1 && otherTypeCount == 1) {
        return 1;
    }

    return 0;
}

function isQingYiSe(gameSeatData) {
    if (isQingYiSe0(gameSeatData, false)) {
        return 2;
    }
    if (isQingYiSe0(gameSeatData, true)) {
        return 1;
    }
    return 0;
}

function isQingYiSe0(gameSeatData, checkJing) {
    var type = findTypeWithOutJing(gameSeatData);

    //检查手上的牌
    if (isSameType(gameSeatData, type, gameSeatData.holds, checkJing) == false) {
        return false;
    }

    //检查杠下的牌
    if (isSameType(gameSeatData, type, gameSeatData.angangs, checkJing) == false) {
        return false;
    }
    if (isSameType(gameSeatData, type, gameSeatData.wangangs, checkJing) == false) {
        return false;
    }
    if (isSameType(gameSeatData, type, gameSeatData.diangangs, checkJing) == false) {
        return false;
    }

    for (var i = 0; i < gameSeatData.chis.length; i++) {
        if (isSameType(gameSeatData, type, gameSeatData.chis[i], checkJing) == false) {
            return false;
        }
    }

    //检查碰牌
    if (isSameType(gameSeatData, type, gameSeatData.pengs, checkJing) == false) {
        return false;
    }
    return true;
}
function isQingYiSeWithJing(gameSeatData) {
    var type = findTypeWithOutJing(gameSeatData);

    //检查手上的牌
    if (isSameType(gameSeatData, type, gameSeatData.holds) == false) {
        return false;
    }

    //检查杠下的牌
    if (isSameType(gameSeatData, type, gameSeatData.angangs) == false) {
        return false;
    }
    if (isSameType(gameSeatData, type, gameSeatData.wangangs) == false) {
        return false;
    }
    if (isSameType(gameSeatData, type, gameSeatData.diangangs) == false) {
        return false;
    }

    for (var i = 0; i < gameSeatData.chis.length; i++) {
        if (isSameType(gameSeatData, type, gameSeatData.chis[i]) == false) {
            return false;
        }
    }

    //检查碰牌
    if (isSameType(gameSeatData, type, gameSeatData.pengs) == false) {
        return false;
    }
    return true;
}

function checkDanDiao(seatData) {
    if (seatData.holds.length != 1) {
        return 0;
    }
    var pai = seatData.holds[seatData.holds.length - 1];
    if (seatData.game.jingMap[pai] == true) {
        return 2;
    }
    return 1;
}

function checkPaoLong(game, seatData) {
    for (var i = 0; i < 34; i++) {
        if (seatData.countMap[i]) {
            seatData.countMap[i]++;
        }
        else {
            seatData.countMap[i] = 1;
        }
        seatData.holds.push(i);
        var result = checkCanTing(game, seatData, i);
        seatData.countMap[i]--;
        seatData.holds.pop();
        if (!result) {
            return false;
        }
    }
    return true;
}

function checkCanTing(game, seatData, chupai) {
    var holdJings = hasHoldJings(seatData);
    if (holdJings == 4) {
        return true;
    }

    var hu = mjutils.isYiGangYiDa(game.jingMap, seatData, true, chupai);
    if (hu != 0) {
        return true;
    }

    hu = mjutils.isErGangYiDa(game.jingMap, seatData, true, chupai);
    if (hu != 0) {
        return true;
    }

    //检查是不是大七
    hu = mjutils.is4Melds(game.jingMap, seatData, true, chupai);
    if (hu != 0) {
        return true;
    }

    //检查是不是七星十三烂
    hu = mjutils.is7Stars13Lan(game.jingMap, seatData, false, chupai);
    if (hu != 0) {
        return true;
    }

    //检查是不是小七
    hu = mjutils.is7Pairs(game.jingMap, seatData, true, chupai);
    if (hu != 0) {
        return true;
    }

    //检查是不是十三烂
    hu = mjutils.is13Lan(game.jingMap, seatData, true, chupai);
    if (hu != 0) {
        return true;
    }

    //检查是不是平胡
    hu = mjutils.isPingHu(game.jingMap, seatData, true, chupai);
    if (hu != 0) {
        return true;
    }

    if (game.conf.qiqian) {
        hu = mjutils.isQiQian(seatData, true);
        if (hu) {
            return true;
        }
    }

    var totalGangNum = seatData.angangs.length + seatData.wangangs.length + seatData.diangangs.length;
    if (totalGangNum >= 3 && game.conf.sangang) {
        return true;
    }

    var isHunYiSe = checkHunYiSe(seatData);
    if (isHunYiSe == 2) {
        return true;
    }

    return false;
}

//检查胡牌
function checkCanHu(game, seatData, chupai, isQiangGangHu) {

    if (game.conf.wanfaxuanze == 1 && chupai != null) {
        return;
    }

    if (chupai == game.jings[1]) {
        return;
    }

    // 抛龙只能自摸
    if (chupai != null && seatData.isPaoLong) {
        return;
    }

    seatData.canHu = false;
    seatData.canGangDiao = false;
    seatData.isJingDiao = false;
    seatData.tingInfo = null;
    seatData.isHunYiSe = false;
    seatData.dandiao = 0;
    seatData.isQingYiSe = 0;
    seatData.isQuanJiao = false;
    seatData.holdJings = 0;
    seatData.asZiMo = false;
    seatData.isLongPaoLong = false;

    var pattern = null;
    seatData.holdJings = hasHoldJings(seatData);
    if (seatData.holdJings == 4 && chupai == null) {
        pattern = "silong";
        seatData.isQuanJiao = true;
    }

    //检查是不是精吊牌型
    var pai = null;
    if (chupai == null) {
        pai = seatData.holds.pop();
        seatData.countMap[pai]--;

        // seatData.isPaoLong = checkPaoLong(game, seatData);

        if (seatData.isPaoLong && pai == game.jings[1]) {
            seatData.isLongPaoLong = true;
            seatData.holdJings = hasHoldJings(seatData);
        }
    }

    var jingDiaoPatten = mjutils.isJingDiao(game.jingMap, seatData);

    seatData.isJingDiao = false;
    seatData.dandiao = checkDanDiao(seatData);
    if (seatData.dandiao) {
        seatData.asZiMo = true;
    }
    if (pai != null) {
        seatData.holds.push(pai);
        seatData.countMap[pai]++;
    }

    if (chupai != null) {
        seatData.holds.push(chupai);
        if (seatData.countMap[chupai]) {
            seatData.countMap[chupai]++;
        }
        else {
            seatData.countMap[chupai] = 1;
        }
    }

    var fan = -1;

    /*
     //此代码用于检查错误，发布时屏蔽
     var oldCountMap = {};
     for(var k in seatData.countMap){
     oldCountMap[k]  = seatData.countMap[k];
     }
     */

    var huanyuan = false;

    //检查是不是大七
    if (pattern == null) {
        hu = mjutils.is4Melds(game.jingMap, seatData, true, chupai);
        if (hu != 0) {
            pattern = "4melds";
            fan = 1;

            if (hu == 1) {
                huanyuan = true;
            }
        }
    }

    if (pattern == null) {
        hu = mjutils.isYiGangYiDa(game.jingMap, seatData, true, chupai);
        if (hu != 0) {
            pattern = "yigangyida";
            fan = 1;

            if (hu == 1) {
                huanyuan = true;
            }
        }
    }

    if (pattern == null) {
        hu = mjutils.isErGangYiDa(game.jingMap, seatData, true, chupai);
        if (hu != 0) {
            pattern = "ergangyida";
            fan = 1;

            if (hu == 1) {
                huanyuan = true;
            }
        }
    }

    if (pattern == null) {
        //检查是不是七星十三烂
        var hu = mjutils.is7Stars13Lan(game.jingMap, seatData, true, chupai);
        if (hu != 0) {
            pattern = "7star13lan";
            fan = 2;

            if (hu == 1) {
                huanyuan = true;
            }
        }
    }

    //检查是不是小七
    if (pattern == null) {
        hu = mjutils.is7Pairs(game.jingMap, seatData, true, chupai);
        if (hu != 0) {
            pattern = "7pairs";

            if (hasHoldJings(seatData)) {
                fan = 1;
            } else {
                pattern = "qing7pairs";
                fan = 10;
                seatData.asZiMo = true;
                if (game.conf.qingqidui) {
                    seatData.isQuanJiao = true;
                }
            }

            if (hu == 1) {
                huanyuan = true;
            }
        }
    }

    //检查是不是十三烂
    if (pattern == null) {
        hu = mjutils.is13Lan(game.jingMap, seatData, true, chupai);
        if (hu != 0) {
            pattern = "13lan";
            fan = 1;

            if (hu == 1) {
                huanyuan = true;
            }
        }
    }

    if (pattern == null || ((pattern == 'yigangyida' || pattern == 'ergangyida') && seatData.isPaoLong)) {
        //检查是不是平胡
        hu = mjutils.isPingHu(game.jingMap, seatData, true, chupai);
        if (hu != 0) {
            pattern = "normal";
            fan = 0;

            if (hu == 1) {
                huanyuan = true;
            }
        }
    }

    if (pattern == null && game.conf.qiqian) {
        hu = mjutils.isQiQian(seatData, true);
        if (hu) {
            pattern = "qiqian";
            fan = 1;

            if (hu == 1) {
                huanyuan = true;
            }
        }
    }

    var totalGangNum = seatData.angangs.length + seatData.wangangs.length + seatData.diangangs.length;
    if (totalGangNum >= 3 && game.conf.sangang) {
        if (pattern != 'silong') {
            pattern = "sangang";
            seatData.isQuanJiao = true;
        }
    }

    if (chupai == null && game.conf.shiyifeng) {
        if (seatData.chuFengNum >= 11) {
            pattern = "shiyifeng";
            seatData.isQuanJiao = true;
        }
    }

    seatData.isHunYiSe = checkHunYiSe(seatData);
    seatData.isQingYiSe = isQingYiSe(seatData);
    if (seatData.isHunYiSe == 2) {
        if (pattern != 'silong') {
            pattern = "quanfengxiang";
            seatData.isQuanJiao = true;
        }
    }

    if (seatData.isQingYiSe) {
        seatData.asZiMo = true;
    }

    if (seatData.isQingYiSe && game.conf.qingyise && seatData.holdJings == 0) {
        seatData.isQuanJiao = true;
    }

    if (huanyuan && seatData.isQingYiSe == 2 && game.conf.qingyise) {
        seatData.isQuanJiao = true;
    }

    seatData.isTianHu = false;
    seatData.isDiHu = false;
    if (game.chupaiCnt == 0 && game.button == seatData.seatIndex && game.chuPai == -1) {
        seatData.isTianHu = true;
    }
    else if (game.chupaiCnt == 1 && game.turn == game.button && game.button != seatData.seatIndex && game.chuPai != -1) {
        seatData.isDiHu = true;
    }


    if (pattern != null) {

        var canHu = false;
        //
        var isDeGuo = hu == 1;

        //天地胡，无脑胡
        if (seatData.isTianHu || seatData.isDiHu) {
            canHu = true;
        }
        else {
            if (!seatData.isJingDiao) {
                //如果是德国，或者大牌，或者抢杠胡， 直接胡。
                if (isDeGuo || pattern != 'normal') {
                    canHu = true;
                }
                else if (chupai == null) {
                    //如果是平胡自摸，则在不是有精必吊的情况下，才能胡(杠上花也能胡)
                    if (game.conf.pinghu != 2 || isQiangGangHu) {
                        canHu = true;
                    }
                }
                //如果不是平胡自摸，则是抢杠胡，或者允许平胡才可以。
                else if (isQiangGangHu || game.conf.pinghu == 0) {
                    canHu = true;
                }
            }
            else {
                //精吊牌型。
                if (chupai == null) {
                    //自摸可胡
                    canHu = true;
                }
                else {
                    //点炮情况
                    //如果是平胡精吊 则可胡大七，或者德国抢杠
                    if (jingDiaoPatten == 'normal') {
                        if (pattern == '4melds' || (isQiangGangHu && isDeGuo)) {
                            canHu = true;
                        }
                    }
                    //如果是小七精吊，则只能胡德国抢杠。
                    else if (jingDiaoPatten == '7pairs') {
                        if (isQiangGangHu && isDeGuo) {
                            canHu = true;
                        }
                    }
                    //大七精吊，只能自摸胡。
                }
            }
        }

        console.log('seat:' + seatData.seatIndex + ", pattern:" + pattern + ", canhu : " + canHu);
        //如果不能胡牌，则直接就返回了。
        if (canHu == false) {
            if (chupai != null) {
                seatData.holds.pop();
                seatData.countMap[chupai]--;
            }
            return;
        }

        seatData.canHu = true;

        seatData.tingInfo = {
            pattern: pattern,
            fan: fan,
            deguo: isDeGuo,
            pai: chupai,
        }
        seatData.tingInfo.huLevel = getHuLevel(seatData);
    }

    /*
     //检查是不是杠吊
     if(seatData.isJingDiao && (pattern == '4melds' || pattern == 'normal')){
     var pai = seatData.holds[seatData.holds.length - 1];
     if(seatData.pengs.indexOf(pai) != -1){
     seatData.canGangDiao = true;
     }
     else if(seatData.countMap[pai] == 4){
     seatData.canGangDiao = true;
     }
     }
     */
    if (chupai != null) {
        seatData.holds.pop();
        seatData.countMap[chupai]--;
    }
    //如果托管 通知前端胡牌
    if (seatData.isAutoPlay && seatData.canHu) {
        setTimeout(function () {
            exports.hu(seatData.userId);
        }, tuoguantime);
    }
}

function clearAllOptions(game, seatData) {
    var fnClear = function (sd) {
        sd.canPeng = false;
        sd.canGang = false;
        sd.canChi = false;
        sd.gangPai = [];
        sd.canHu = false;
        sd.lastFangGangSeat = -1;
    }
    if (seatData) {
        fnClear(seatData);
    }
    else {
        game.qiangGangContext = null;
        for (var i = 0; i < game.gameSeats.length; ++i) {
            fnClear(game.gameSeats[i]);
        }
    }
}

function getSeatIndex(userId) {
    var seatIndex = roomMgr.getUserSeat(userId);
    if (seatIndex == null) {
        return null;
    }
    return seatIndex;
}

function getGameByUserID(userId) {
    var roomId = roomMgr.getUserRoom(userId);
    if (roomId == null) {
        return null;
    }
    var game = games[roomId];
    return game;
}

function hasOperations(seatData) {
    if (seatData == null) {
        return false;
    }
    if (seatData.canGang || seatData.canPeng || seatData.canHu || seatData.canChi) {
        return true;
    }
    return false;
}

function sendOperations(game, seatData, pai) {
    if (hasOperations(seatData)) {
        if (pai == -1) {
            pai = seatData.holds[seatData.holds.length - 1];
        }
        if (game.waitPengGang.indexOf(seatData.userId) == -1) {
            game.waitPengGang.push(seatData.userId);
        }
        var data = {
            pai: pai,
            hu: seatData.canHu,
            isQuanJiao: seatData.isQuanJiao,//全缴
            peng: seatData.canPeng,
            gang: seatData.canGang,
            chi: seatData.canChi,
            gangpai: seatData.gangPai
        };

        // 全缴胡牌只显示胡
        if (seatData.isQuanJiao && seatData.canHu) {
            data.peng = false;
            data.gang = false;
            data.chi = false;
            data.gangpai = [];
        }
        data.si = seatData.seatIndex;
        //如果可以有操作，则进行操作
        userMgr.sendMsg(seatData.userId, 'game_action_push', data);
        if (seatData.isQuanJiao) {
            console.log(new Date(), "[BUGCHECK]--Thouzhi-Canhu--quanjiao--玩家ID:[" + seatData.userId + "]");
        } else if (data.hu) {
            console.log(new Date(), "[BUGCHECK]--Thouzhi-Canhu--玩家ID:[" + seatData.userId + "]");
        }
    }
    else {
        userMgr.sendMsg(seatData.userId, 'game_action_push');
    }
}

function moveToNextUser(game, nextSeat) {
    game.fangpaoshumu = 0;
    //找到下一个没有和牌的玩家
    if (nextSeat == null) {
        while (true) {
            game.turn++;
            game.turn %= 4;
            var turnSeat = game.gameSeats[game.turn];
            if (turnSeat.hued == false) {
                return;
            }
        }
    }
    else {
        game.turn = nextSeat;
    }
}

function doUserMoPai(game, lastFangGangSeat) {

    if (lastFangGangSeat == null) {
        lastFangGangSeat = -1;
    }

    //托管时间刷新
    game.tuoTime = Date.now() + TOUGUANTIMES;
    //刷新托管 碰杠吃胡
    game.waitPengGang = [];

    game.chuPai = -1;
    var turnSeat = game.gameSeats[game.turn];
    turnSeat.lastFangGangSeat = lastFangGangSeat;
    turnSeat.guoHuFan = -1;
    turnSeat.guoPengPai = -1;
    var pai = mopai(game, game.turn);
    var roomId = roomMgr.getUserRoom(turnSeat.userId);
    var room = roomMgr.getRoom(roomId);
    //牌摸完了，结束
    if (pai == -1) {
        doGameOver(game, turnSeat.userId);
        return;
    }
    else {
        var numOfMJ = game.mahjongs.length - game.currentIndex;
        userMgr.broacastInRoom('mj_count_push', numOfMJ, room, turnSeat.userId, true);
    }

    //不能吃碰什么出什么牌列表
    game.cantChupaiList = [];

    recordGameAction(game, game.turn, ACTION_MOPAI, pai);

    //通知前端新摸的牌
    userMgr.sendMsg(turnSeat.userId, 'game_mopai_push', pai);

    //检查是否可以暗杠或者胡
    //检查胡，直杠，弯杠
    checkCanAnGang(game, turnSeat);
    checkCanWanGang(game, turnSeat);

    //检查看是否可以和
    checkCanHu(game, turnSeat, null, lastFangGangSeat >= 0);

    //广播通知玩家出牌方
    turnSeat.canChuPai = true;
    userMgr.broacastInRoom('game_chupai_push', turnSeat.userId, room, turnSeat.userId, true);

    //通知玩家做对应操作
    if (turnSeat.isAutoPlay && !turnSeat.canHu && !turnSeat.canGang && !turnSeat.canPeng && !turnSeat.canChi) {
        setTimeout(function () {
            exports.chuPai(turnSeat.userId, pai);
        }, ChuPaituoguantime);
    }

    //通知前端提示碰杠胡
    sendOperations(game, turnSeat, game.chuPai);
}

function isMenQing(gameSeatData) {
    return (gameSeatData.pengs.length + gameSeatData.wangangs.length + gameSeatData.diangangs.length) == 0;
}

function isZhongZhang(gameSeatData) {
    var fn = function (arr) {
        for (var i = 0; i < arr.length; ++i) {
            var pai = arr[i];
            if (pai == 0 || pai == 8 || pai == 9 || pai == 17 || pai == 18 || pai == 26) {
                return false;
            }
        }
        return true;
    }

    if (fn(gameSeatData.pengs) == false) {
        return false;
    }
    if (fn(gameSeatData.angangs) == false) {
        return false;
    }
    if (fn(gameSeatData.diangangs) == false) {
        return false;
    }
    if (fn(gameSeatData.wangangs) == false) {
        return false;
    }
    if (fn(gameSeatData.holds) == false) {
        return false;
    }
    return true;
}

function isJiangDui(gameSeatData) {
    var fn = function (arr) {
        for (var i = 0; i < arr.length; ++i) {
            var pai = arr[i];
            if (pai != 1 && pai != 4 && pai != 7
                && pai != 9 && pai != 13 && pai != 16
                && pai != 18 && pai != 21 && pai != 25
            ) {
                return false;
            }
        }
        return true;
    }

    if (fn(gameSeatData.pengs) == false) {
        return false;
    }
    if (fn(gameSeatData.angangs) == false) {
        return false;
    }
    if (fn(gameSeatData.diangangs) == false) {
        return false;
    }
    if (fn(gameSeatData.wangangs) == false) {
        return false;
    }
    if (fn(gameSeatData.holds) == false) {
        return false;
    }
    return true;
}

function computeFanScore(game, fan) {
    if (fan > game.conf.maxFan) {
        fan = game.conf.maxFan;
    }
    if (fan == 0) {
        return 2;
    }
    return (1 << fan) * game.conf.baseScore * 6;
}

function calculateJing(game, sd) {
    var fnSumArr = function (arr, target, n) {
        var num = 0;
        for (var k in arr) {
            var o = arr[k];
            if (typeof (o) == 'number') {
                var pai = o;
                if (target == pai) {
                    num += n;
                }
            }
            else {
                for (var i = 0; i < o.length; ++i) {
                    var pai = o[i];
                    if (target == pai) {
                        num++;
                    }
                }
            }
        }
        return num;
    }

    var fnSum = function (target) {
        var sum = 0;
        //手上的牌
        sum += fnSumArr(sd.holds, target, 1);
        //
        sum += fnSumArr(sd.folds, target, 1);
        //
        sum += fnSumArr(sd.pengs, target, 3);
        //
        sum += fnSumArr(sd.wangangs, target, 4);
        //
        sum += fnSumArr(sd.diangangs, target, 4);
        //
        sum += fnSumArr(sd.angangs, target, 4);

        sum += fnSumArr(sd.chis, target, 1);

        return sum;
    }

}

function chongGuan(game, jingName, scoreName, needBaoJing) {
    var numOfPplHasJing = 0;
    for (var i = 0; i < game.gameSeats.length; ++i) {
        var sd = game.gameSeats[i];
        var num0 = sd[jingName + '0'];
        var num1 = sd[jingName + '1'];
        if (num0 + num1) {
            numOfPplHasJing++;
        }
    }

    var isBaJing = numOfPplHasJing == 1;
    //都没有精，就算了
    if (numOfPplHasJing == 0) {
        return;
    }

    for (var i = 0; i < game.gameSeats.length; ++i) {
        var sd = game.gameSeats[i];
        //进行精相关的结算
        var totalJing = sd[jingName + '0'] * 2 + sd[jingName + '1'];
        var factor = 1;
        if (totalJing >= 5) {
            factor = totalJing - 3;
        }

        var scoreOfJing = totalJing * factor;
        if (isBaJing) {
            scoreOfJing *= 2;
        }

        //如果玩家冲关或者霸精，则包分
        var baoJingSeat = null;
        if (needBaoJing) {
            if ((totalJing >= 5 || isBaJing) && sd.lastFangJingSeat >= 0) {
                baoJingSeat = game.gameSeats[sd.lastFangJingSeat];
                baoJingSeat.baoJing = true;
            }
        }

        for (var k in game.gameSeats) {
            var td = game.gameSeats[k];
            if (td != sd) {
                if (baoJingSeat) {
                    baoJingSeat[scoreName] -= scoreOfJing;
                }
                else {
                    td[scoreName] -= scoreOfJing;
                }
                sd[scoreName] += scoreOfJing;
            }
        }
    }
}

function calculateResult(game, roomInfo) {
    var baseScore = game.conf.baseScore;
    for (var i = 0; i < game.gameSeats.length; ++i) {
        //算精
        var sd = game.gameSeats[i];
        sd.shangJingScore = 0;
        sd.xiaJingScore = 0;
        sd.zuoJingScore = 0;
        sd.youJingScore = 0;
        sd.hupaiScore = 0;
        sd.mingGangScore = 0;
        sd.anGangScore = 0;
        sd.gangJingScore = 0;
        sd.chaoZhuangScore = 0;
        sd.shaJingScore = 0;
        calculateJing(game, sd);
    }

    //判断抄庄
    for (var i = 0; i < game.gameSeats.length; ++i) {
        //算精
        var sd = game.gameSeats[i];
        if (i == game.button) {
            sd.chaoZhuangScore -= game.chaoZhuangCnt * 10 * (game.gameSeats.length - 1);
        }
        else {
            sd.chaoZhuangScore += game.chaoZhuangCnt * 10;
        }
    }

    for (var i = 0; i < game.gameSeats.length; ++i) {
        var sd = game.gameSeats[i];

        //统计杠的数目
        sd.numAnGang = sd.angangs.length;
        sd.numMingGang = sd.wangangs.length;
        sd.numDiangang = sd.jiegangs.length;
        sd.numJiegang = sd.diangangs.length;

        //对所有胡牌的玩家进行统计
        if (true) {
            var fan = sd.fan;
            for (var a = 0; a < sd.actions.length; ++a) {
                var ac = sd.actions[a];
                if (ac.type == "fanggang") {
                    //var ts = game.gameSeats[ac.targets[0]];
                    //检查放杠的情况，如果目标没有和牌，且没有叫牌，则不算 用于优化前端显示
                    //if(isNeedChaDaJia && (ts.hued) == false && (isTinged(game,ts) == false)){
                    //    ac.state = "nop";
                    //}
                }
                else if (ac.type == "angang" || ac.type == "wangang" || ac.type == "diangang") {
                    if (ac.state != "nop") {
                        var gangscore = ac.score;
                        var additonalscore = ac.targets.length * gangscore;
                        if (ac.type == 'angang') {
                            sd.anGangScore += additonalscore;
                        }
                        else {
                            sd.mingGangScore += additonalscore;
                        }
                        //扣掉目标方的分
                        for (var t = 0; t < ac.targets.length; ++t) {
                            var six = ac.targets[t];
                            var td = game.gameSeats[six];
                            if (ac.type == 'angang') {
                                td.anGangScore -= gangscore;
                            }
                            else {
                                td.mingGangScore -= gangscore;
                            }
                        }
                    }
                }
                else if (ac.type == "zimo" || ac.type == "hu" || ac.type == "ganghua" || ac.type == "dianganghua" || ac.type == "gangpaohu" || ac.type == "qiangganghu" || ac.type == "chadajiao") {
                    var score = game.conf.baseScore + roomInfo.conf.numOfButton * 10;
                    score += sd.tingInfo.fan;

                    score += sd.holdJings;

                    //杠花要翻倍
                    if (ac.type == 'ganghua' || ac.type == 'dianganghua') {
                        score += 10;
                        if (sd.tingInfo.pattern == 'yigangyida' || sd.tingInfo.pattern == 'ergangyida') {
                            sd.isPaoLong = false;
                            sd.isLongPaoLong = false;
                        }
                    }
                    else if (ac.type == 'qiangganghu') {
                        score += 10;
                    }

                    if (sd.isHunYiSe) {
                        score += 1;
                    }

                    if (sd.isHaiDiHu) {
                        score += 10;
                    }

                    if (sd.isQingYiSe) {
                        score += 10;
                    }

                    if (sd.dandiao == 1) {
                        score += 10;
                    } else if (sd.dandiao == 2) {
                        score += 20;
                    } else if (sd.isPaoLong) {
                        score += 10;
                    }

                    if (sd.isLongPaoLong) {
                        score += 10;
                    }

                    var fangpaoSeat = null;

                    if (ac.iszimo) {
                        sd.numZiMo++;
                        console.log("自摸次数+", sd.numZiMo);
                    }
                    else {
                        //
                        if (ac.type != "chadajiao") {
                            sd.numZiMo++;
                            // sd.numJiePao++;
                        }
                        var six = ac.targets[0];
                        fangpaoSeat = game.gameSeats[six];
                    }

                    //普通胡牌正常给钱
                    for (var t = 0; t < game.gameSeats.length; ++t) {
                        var td = game.gameSeats[t];
                        if (td != sd) {
                            var realscore = score;
                            //天地胡忽略所有计算。。
                            if (sd.isTianHu || sd.isDiHu) {
                                realscore += 10;
                            }

                            if (sd.holdJings == 0) {
                                realscore += 2;
                            }

                            if (!ac.iszimo && td != fangpaoSeat && ac.type != 'qiangganghu' && !sd.isTianHu && !sd.isDiHu && !sd.asZiMo) {
                                realscore = Math.round(realscore / 2);
                            }

                            var seatScore = roomInfo.seats[t].score;
                            if (realscore > seatScore && !roomInfo.conf.bsc) {//不等于比赛场 不可以负数
                                realscore = seatScore;
                            }

                            if (sd.tingInfo.pattern == 'silong') {
                                sd.anGangScore += 20;
                                td.anGangScore -= 20;
                            }

                            if (sd.isQuanJiao) {
                                game.isQuanJiao = true;
                                if (!roomInfo.conf.bsc) {//不等于比赛场 不可以负数
                                    realscore = seatScore;
                                }
                                sd.hupaiScore += realscore;
                                // sd.mingGangScore = 0;
                                // sd.anGangScore = 0;

                                td.hupaiScore -= realscore;
                                // td.anGangScore = 0;
                                // td.mingGangScore = 0;
                            } else {

                                if (ac.type == 'qiangganghu') {
                                    var fangpaoSeatScore = roomInfo.seats[fangpaoSeat.seatIndex].score + fangpaoSeat.hupaiScore;
                                    if (realscore > fangpaoSeatScore) {
                                        realscore = fangpaoSeatScore;
                                    }
                                    //抢杠胡包3家
                                    fangpaoSeat.hupaiScore -= realscore;

                                    fangpaoSeat.mingGangScore -= 10;
                                    sd.mingGangScore += 10;
                                }
                                else {
                                    td.hupaiScore -= realscore;
                                }

                                sd.hupaiScore += realscore;

                                if (ac.type == "chadajiao") {
                                    td.numChaJiao++;
                                }
                                else if (!ac.iszimo) {

                                }
                            }
                        }
                    }
                }
            }

        }
    }

    //统计总分
    for (var i = 0; i < game.gameSeats.length; ++i) {
        var sd = game.gameSeats[i];
        sd.score = sd.hupaiScore;
        if (sd.game.conf.wanfaxuanze == 1) {
            sd.gangScore = sd.mingGangScore + sd.anGangScore + sd.chaoZhuangScore;
        } else {
            sd.gangScore = sd.mingGangScore + sd.anGangScore;
        }
    }
}
//特殊 申请解散房间 走这里, 列如游戏局数>=1 ,game为null 走这里
function applyGameOver(userId, id) {
    var roomId = roomMgr.getUserRoom(userId);
    //房间id不等于null 使用固定, 预防其他续费房间信息没清除干净 ,删除上一个房间信息走了这里
    if (id) {
        roomId = id;
    }
    if (roomId == null) {
        return;
    }

    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }

    endinfo = [];
    for (var i = 0; i < roomInfo.seats.length; ++i) {
        var rs = roomInfo.seats[i];
        endinfo.push({
            scores: rs.scoreOfRounds,
            gangscores: rs.gangScoreOfRounds,
            numzimo: rs.numZiMo,
            numangang: rs.numAnGang,
            numminggang: rs.numMingGang,
            numdiangang: rs.numDiangang,
            numjiegang: rs.numJiegang,
        });
    }

    var ret = {
        endinfo: endinfo,
    };
    console.log('[CHECKBUG]---gameover--->roomId:[' + roomId + ']');
    //保存历史战绩分
    store_history(roomInfo);
    //不等于俱乐部
    if (!roomInfo.conf.for_others && !roomInfo.conf.club_id) {
        fibers(function () {
            db.archive_games(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid);
            db.archive_room(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid, false)
        }).run();
    } else {
        console.error('[CHECKBUG]---julebu--- for_others:', roomInfo.conf.for_others + ' club_id:' + roomInfo.conf.club_id);
    }
    userMgr.broacastInRoom('game_apply_over_push', ret, roomInfo, userId, true);
}

function doGameOver(game, userId, forceEnd, id) {
    var roomId = roomMgr.getUserRoom(userId);
    //房间id不等于null 使用固定, 预防其他续费房间信息没清除干净 ,删除上一个房间信息走了这里
    if (id) {
        roomId = id;
    }
    if (roomId == null) {
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }

    try {
        if (roomInfo.numOfGames == 1 && !roomInfo.conf.bsc) {//不等于比赛场就扣分 执行以下
            console.log("[kouFei]---room:[" + roomId + "]  cost:[" + roomInfo.conf.cost + "] AA:[" + roomInfo.conf.aa + "]");
            fibers(function () {
                if (roomInfo.conf.aa) {
                    for (var n = 0; n < roomInfo.seats.length; ++n) {
                        var s = roomInfo.seats[n];
                        db.mj_cost_gems(s.userId, roomInfo.conf.cost);
                    }
                } else {
                    //房卡扣费
                    db.mj_cost_gems(roomInfo.conf.creator, roomInfo.conf.cost);
                }
                //记录游戏次数送 达到次数 送大转盘抽奖1次
                for (var n = 0; n < roomInfo.seats.length; ++n) {
                    var d = roomInfo.seats[n];
                    //获取游戏次数
                    var gamedaynum = db.get_gemsdayNum_userid(d.userId);
                    if ((gamedaynum + 1) >= 20) {
                        //添加抽奖次数
                        db.add_user_luckynum(d.userId, 1);
                        //更新玩家今天游戏次数 清0
                        db.update_gemsdayNum(d.userId);
                    } else {
                        //添加玩家开房对局 游戏次数
                        db.add_user_gemdaysNum(d.userId, 1);
                    }
                }
            }).run();
        }
    } catch (error) {
        console.error(new Date() + "[bug]--扣费异常--" + error);
    }

    var results = [];
    var dbresult = [0, 0, 0, 0, 0, 0, 0, 0];

    //游戏结束 清楚托管
    for (var i = tuoguanRoomList.length - 1; i >= 0; --i) {
        if (tuoguanRoomList[i] == roomId) {
            tuoguanRoomList.splice(i, 1);
            break;
        }
    }

    var fnNoticeResult = function (isEnd) {
        fibers(function () {
            var endinfo = null;
            if (isEnd) {
                endinfo = [];
                for (var i = 0; i < roomInfo.seats.length; ++i) {
                    var rs = roomInfo.seats[i];
                    endinfo.push({
                        scores: rs.scoreOfRounds,
                        gangscores: rs.gangScoreOfRounds,
                        numzimo: rs.numZiMo,
                        numangang: rs.numAnGang,
                        numminggang: rs.numMingGang,
                        numdiangang: rs.numDiangang,
                        numjiegang: rs.numJiegang,
                    });
                }
            }

            var ret = {
                results: results,
                endinfo: endinfo,
                gameOver: roomInfo.gameOver,
            };

            if (game) {
                game.waitPengGang = [];
                ret.xiajings = game.xiaJings;
                ret.zuojings = game.zuoJings;
                ret.youjings = game.youJings;
            }
            userMgr.broacastInRoom('game_over_push', ret, roomInfo, userId, true);

            //如果局数已够，则进行整体结算，并关闭房间
            if (isEnd && !roomInfo.conf.bsc) {
                try {
                    //绑定了邀请人才开始累计玩家游戏次数 送玩家礼券
                    //到达游戏次数才送
                    var invitorNum = [1, 3, 5, 10];
                    //礼卷数量
                    var invitorCoupon = [50, 200, 500, 1000];
                    for (var i = 0; i < roomInfo.seats.length; ++i) {
                        var rs = roomInfo.seats[i];
                        //查询玩家信息
                        var invitorData = db.get_user_data_by_userid(rs.userId);
                        if (invitorData) {
                            if (invitorData.gamenum == null) {
                                //如果游戏次数等于null 更新初始化游戏次数为0
                                db.update_gamenum(rs.userId, 0);
                                console.error('gameover---礼券数量 is null BUG--userid:' + rs.userId);
                            }
                            //如果玩家次数已经达到10次以上, 跳出不在奖励
                            if (invitorData.gamenum > 10) {
                                continue;
                            }
                            //判断是否绑定邀请人
                            if (invitorData.invitor) {
                                for (var n = 0; n < invitorNum.length; ++n) {
                                    if (invitorNum[n] == invitorData.gamenum) {
                                        //添加邀请人礼券数量
                                        db.add_user_coupon(invitorData.invitor, invitorCoupon[n])
                                        var DK1 = 'BK' + Date.now() + Math.floor(Math.random() * 1000) + invitorData.invitor;
                                        //1.玩家id 2.创建礼券单号 3.礼券数量 4.1代表 活动状态 2代表 税换状态
                                        db.create_pay_coupon(invitorData.invitor, DK1, invitorCoupon[n], 1);
                                        break;
                                    }
                                }
                                //添加该玩家游戏次数
                                db.add_gamenum(rs.userId, 1);
                            }
                        }
                    }
                } catch (error) {
                    console.error('gameover---礼券添加BUG-->', error);
                }

                roomInfo.conf.numOfButton = 0
                if (roomInfo.numOfGames > 1 || !forceEnd) {
                    store_history(roomInfo);//保存历史战绩分
                }

                roomMgr.closeRoom(roomId, forceEnd);
            }
            //比赛场景结束走这里
            else {
                //比赛场自动通知玩家自动准备
                if (roomInfo.conf.bsc && !isEnd) {
                    setTimeout(() => {
                        console.log('比赛场本轮游戏第一局结束自动准备')
                        for (var i = 0; i < roomInfo.seats.length; ++i) {
                            exports.setReady(roomInfo.seats[i].userId);
                        }
                        userMgr.broacastInRoom('close_detail_match_push', null, roomInfo, userId, true)
                    }, 1000)
                }
               
                //比赛场结束走这里
                if (roomInfo.conf.bsc && isEnd) {
                    for (var i = 0; i < roomInfo.seats.length; ++i) {
                        let userId2 = roomInfo.seats[i].userId;
                        roomMgr.detail_match_push(userId2, (data) => {
                            console.log(`====本轮游戏结束>>>>玩家[${userId2}]比赛数据：`, data)
                            userMgr.sendMsg(userId2, 'detail_match_push', data);
                            // userMgr.broacastInRoom('detail_match_push', data, roomInfo, userId, true)
                        })
                    }

                    roomMgr.update_match_info(roomInfo.conf.matchData.matchId, roomId)
                    roomMgr.destroy(roomId);
                }
            }
        }).run();
    }

    var isOver = false;
    if (game != null) {
        if (!forceEnd) {
            calculateResult(game, roomInfo);
        }

        for (var i = 0; i < roomInfo.seats.length; ++i) {
            var rs = roomInfo.seats[i];
            var sd = game.gameSeats[i];

            if (!forceEnd && !roomInfo.conf.bsc) {
                //更新排行榜分数  
                fibers(function () {
                    db.update_rank_scores(sd.userId, rs.name, sd.score);
                }).run();
            }

            rs.ready = false;
            rs.score += sd.score;
            rs.gangScore += sd.gangScore;
            rs.scoreOfRounds[roomInfo.numOfGames - 1] = sd.score;
            rs.gangScoreOfRounds[roomInfo.numOfGames - 1] = sd.gangScore;
            rs.numZiMo += sd.numZiMo;
            rs.numDiangang += sd.numDiangang;
            rs.numAnGang += sd.numAnGang;
            rs.numMingGang += sd.numMingGang;
            rs.numJiegang += sd.numJiegang
            if (rs.score <= 0) {
                isOver = true;
            }
            var userRT = {
                userId: sd.userId,
                actions: sd.actions,
                pengs: sd.pengs,
                chis: sd.chis,
                wangangs: sd.wangangs,
                diangangs: sd.diangangs,
                angangs: sd.angangs,
                jiegangs: sd.jiegangs,
                holds: sd.holds,
                pattern: sd.pattern,
                score: sd.score,
                totalscore: rs.score,
                totalgangscore: rs.gangScore,
                haidihu: sd.isHaiDiHu,
                tianhu: sd.isTianHu,
                dihu: sd.isDiHu,
                jingdiao: sd.isJingDiao,
                deguo: sd.tingInfo ? sd.tingInfo.deguo : null,
                dezhongde: sd.isDeZhongDe,
                numsj0: sd.numShangJing0,
                numsj1: sd.numShangJing1,
                numxj0: sd.numXiaJing0,
                numxj1: sd.numXiaJing1,
                numzj0: sd.numZuoJing0,
                numzj1: sd.numZuoJing1,
                numyj0: sd.numYouJing0,
                numyj1: sd.numYouJing1,
                isHunYiSe: sd.isHunYiSe,
                dandiao: sd.dandiao,
                isQingYiSe: sd.isQingYiSe,
                isPaoLong: sd.isPaoLong || sd.dandiao == 2,
                isQuanJiao: sd.isQuanJiao,
                isLongPaoLong: sd.isLongPaoLong,
                holdJings: sd.holdJings,
                numOfButton: roomInfo.conf.numOfButton,
                gangScore: sd.gangScore,
                //--新增----碰-点杠-弯杠前端提示杠谁的-碰谁的-------
                chisId: sd.chisId,
                pengsId: sd.pengsId,
                diangangsId: sd.diangangsId,
                wangangsId: sd.wangangsId,
                pengAndwangangID: sd.pengAndwangangID,
                //--end------------
                isAutoPlay: sd.isAutoPlay,
            };

            if (sd.shangJingScore) {
                userRT.sjscore = sd.shangJingScore;
            }
            if (sd.xiaJingScore) {
                userRT.xjscore = sd.xiaJingScore;
            }
            if (sd.zuoJingScore) {
                userRT.zjscore = sd.zuoJingScore;
            }
            if (sd.youJingScore) {
                userRT.yjscore = sd.youJingScore;
            }
            if (sd.hupaiScore) {
                userRT.hpscore = sd.hupaiScore;
            }
            if (sd.mingGangScore) {
                userRT.mgscore = sd.mingGangScore;
            }
            if (sd.anGangScore) {
                userRT.agscore = sd.anGangScore;
            }
            if (sd.gangJingScore) {
                userRT.gjscore = sd.gangJingScore;
            }
            if (sd.chaoZhuangScore) {
                userRT.czscore = sd.chaoZhuangScore;
            }
            if (sd.shaJingScore) {
                userRT.shajingscore = sd.shaJingScore;
            }

            for (var k in sd.actions) {
                userRT.actions[k] = {
                    type: sd.actions[k].type,
                };
            }
            results.push(userRT);
            //console.log('====比赛结束====',roomInfo.conf.matchData);
            //保存比赛场分数
            if (roomInfo.conf.bsc) {
                console.log('比赛场==》每局游戏结束更新用户分数到比赛服');
                roomMgr.update_match_user_score(sd.userId, sd.score, roomInfo.conf.matchData.matchId)
            }

            dbresult[i] = sd.score;
            dbresult[i + 4] = sd.gangScore;
            delete gameSeatsOfUsers[sd.userId];
        }
        delete games[roomId];
        delete diangangAndjiegang[roomId];


        var old = roomInfo.nextButton;
        if (game.firstHupai != game.button) {
            roomInfo.nextButton++;
            if (roomInfo.nextButton > 3) {
                roomInfo.nextButton = 0;
            }
        }
        else if (game.firstHupai < 0) {
            roomInfo.nextButton++;
            if (roomInfo.nextButton > 3) {
                roomInfo.nextButton = 0;
            }
            userMgr.broacastInRoom('liu_ju_push', null, roomInfo, roomInfo.seats[0].userId, true);
        }

        if (old != roomInfo.nextButton) {
            fibers(function () {
                db.update_next_button(roomInfo.gametype, roomInfo.gamemode, roomId, roomInfo.nextButton);
            }).run();
            roomInfo.conf.numOfButton = 0
        } else {
            roomInfo.conf.numOfButton++;
        }
    }

    if (forceEnd || game == null) {
        fnNoticeResult(true);
    }
    else {
        //游戏结算数据 存储
        var isEnd = (roomInfo.numOfGames >= roomInfo.conf.maxGames) || game.isQuanJiao == true || isOver == true;

        //比赛场保存游戏
        if (roomInfo.conf.bsc) {
            isEnd = (roomInfo.numOfGames >= roomInfo.conf.maxGames);
            fibers(function () {
                // 记录房间配置
                roomMgr.updateScores(roomId);
            }).run();
            fnNoticeResult(isEnd);
            return
        }

        //俱乐部房间游戏结束发送游戏数据到俱乐部聊天室
        if (roomInfo.conf.club_id > 0) {
            // roomMgr.sendMsgToClub(roomInfo.conf.club_id, gameOver);//等待配置游戏数据
        }

        fibers(function () {
            console.log('[check] gameover result [roomid]:' + roomId + '[numOfGames]:' + roomInfo.numOfGames + ' [dbresult]:', dbresult);
            //保存游戏 以下存储历史战绩
            db.create_game(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid, game.gameIndex, game.baseInfoJson);
            //保存game 单局结算分数
            db.update_mj_game_result(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid, game.gameIndex, dbresult, null);

            // 记录房间配置
            roomMgr.updateScores(roomId);

            //记录打牌信息
            var str = JSON.stringify(game.actionList);
            console.log('[check] gameover actionList [roomid]:' + roomId + '[numOfGames]:' + roomInfo.numOfGames + ' [actionList]:', str);
            //保存game 打牌过程
            db.update_game_action_records(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid, game.gameIndex, str);

            //保存游戏局数
            db.update_num_of_turns(roomInfo.gametype, roomInfo.gamemode, roomId, roomInfo.numOfGames);

            fnNoticeResult(isEnd);
        }).run();
    }
}

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
            if (i != seatData.seatIndex && s.hued == false) {
                d.targets.push(i);
            }
        }
    }

    seatData.actions.push(d);
    return d;
}

function recordGameAction(game, si, action, pai, p1, p2) {
    game.actionList.push(si);
    game.actionList.push(action);
    if (pai != null) {
        game.actionList.push(pai);
    }
    if (p1 != null) {
        game.actionList.push(p1);
    }
    if (p2 != null) {
        game.actionList.push(p2);
    }
}

exports.setReady = function (userId, callback) {
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
    if (roomInfo.conf.bsc) {
        console.log('game == null:', game == null);
    }
    if (game == null) {
        if (roomInfo.seats.length == 4) {
            for (var i = 0; i < roomInfo.seats.length; ++i) {
                var s = roomInfo.seats[i];
                if (s.ready == false) {
                    return;
                }
                if (roomInfo.numOfGames === 0 && s.userId > 0 && !roomInfo.conf.bsc) {
                    let online = userMgr.isOnline(s.userId);
                    //console.log('-----游戏开始检查是否离线------离线:',online + " id:"+s.userId);
                    //如果未开局玩家准备了,但是玩家离线则不开始游戏,等待玩家上线才开始游戏
                    if (!online) {
                        return;
                    }
                }
            }
            //如果游戏开始 还在投票踢人就取消投票踢人
            if (roomInfo.kick != null) {
                roomInfo.kick = null
                userMgr.broacastInRoom('kickout_notice_push', null, roomInfo, userId, true);
            }
            //4个人到齐了，并且都准备好了，则开始新的一局
            exports.begin(roomId);
        }
    }
    else {
        var numOfMJ = game.mahjongs.length - game.currentIndex;
        var remainingGames = roomInfo.conf.maxGames - roomInfo.numOfGames;

        var data = {
            state: game.state,
            numofmj: numOfMJ,
            button: game.button,
            turn: game.turn,
            chuPai: game.chuPai,
            huanpaimethod: game.huanpaiMethod,
            jings: game.jings,
            shangtang: game.conf.numOfButton,
            saizi: game.saizi,
            anGangChuPaiNum: game.anGangChuPaiNum,
            cantChupaiList: game.cantChupaiList, //不能吃碰后 出什么牌的列表
        };

        data.seats = [];
        var seatData = null;
        for (var i = 0; i < 4; ++i) {
            var sd = game.gameSeats[i];

            var s = {
                userid: sd.userId,
                folds: sd.folds,
                angangs: sd.angangs,
                jiegangs: sd.jiegangs,
                diangangs: sd.diangangs,
                wangangs: sd.wangangs,
                pengs: sd.pengs,
                chis: sd.chis,
                que: sd.que,
                hued: sd.hued,
                iszimo: sd.iszimo,
                hupai: sd.hupai,
                //--新增----提示-碰谁的-杠谁的-------
                chisId: sd.chisId,
                pengsId: sd.pengsId,
                diangangsId: sd.diangangsId,
                wangangsId: sd.wangangsId,
                pengAndwangangID: sd.pengAndwangangID,
                //--end------------
                isAutoPlay: sd.isAutoPlay,
                lastChiPai: sd.lastChiPai,
            }
            if (sd.userId == userId) {
                s.holds = sd.holds;
                s.huanpais = sd.huanpais;
                seatData = sd;
            }
            else {
                s.huanpais = sd.huanpais ? [] : null;
            }
            if (game.state == "playing") {
                s.ismaipai = sd.isMaipai;
            }
            data.seats.push(s);
        }

        //同步整个信息给客户端
        userMgr.sendMsg(userId, 'game_sync_push', data);
        sendOperations(game, seatData, game.chuPai);
    }
}

function store_history(room) {
    var seats = room.seats;

    for (var i = 0; i < seats.length; ++i) {
        var seat = seats[i];
        if (!seat.userId) {
            console.error("--store_history--->bug", seat.userId);
        }
        fibers(function () {
            db.create_user_history(room.gametype, room.gamemode, seat.userId, room.uuid);
        }).run();
    }
}

function construct_game_base_info(game) {
    var baseInfo = {
        type: game.conf.type,
        button: game.button,
        numOfButton: game.conf.numOfButton,  //上塘次数
        index: game.gameIndex,
        mahjongs: game.mahjongs,
        jings: game.jings,
        game_seats: new Array(4)
    }

    for (var i = 0; i < 4; ++i) {
        baseInfo.game_seats[i] = game.gameSeats[i].holds;
    }
    game.baseInfoJson = JSON.stringify(baseInfo);
}

// 亮子麻将选择
function canChiPengGang(seatData, targetSeatData) {
    if (seatData.game.conf.wanfaxuanze == 1) {
        return true;
    }
    if (seatData.holds.length <= 4) {
        return true;
    }
    return !(seatData.chiPengGang[targetSeatData.userId] >= 2);
}

function addChiPengGang(seatData, targetSeatData) {
    if (seatData.chiPengGang[targetSeatData.userId]) {
        seatData.chiPengGang[targetSeatData.userId]++;
    } else {
        seatData.chiPengGang[targetSeatData.userId] = 1;
    }
}

function fanJing(game) {
    var arr = [];
    var index = Math.floor(Math.random() * (game.mahjongs.length - game.currentIndex)) + game.currentIndex;
    var zhengjing = game.mahjongs[index];

    game.mahjongs.splice(index, 1);

    var fujing = zhengjing + 1;
    //如果正精是9筒 则副精为1筒
    //如果正精是9条 则副精为1条
    //如果正精为9万 则副精为1万
    //如果正精为北风 则副精为东风
    //如果正精为白板  则副精为红中
    if (zhengjing == 8) {
        fujing = 0;
    }
    if (zhengjing == 17) {
        fujing = 9;
    }
    if (zhengjing == 26) {
        fujing = 18;
    }
    if (zhengjing == 30) {
        fujing = 27;
    }
    if (zhengjing == 33) {
        fujing = 31;
    }
    return [zhengjing, fujing];
}

//开始新的一局
exports.begin = function (roomId) {
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return;
    }

    var seats = roomInfo.seats;
    console.log('游戏开始位置信息：', seats);

    if (roomInfo.numOfGames == 0) {
        //如果是游戏刚开局,更新游戏房间创建时间 
        fibers(function () {
            db.update_room_time(roomInfo.gametype, roomInfo.gamemode, roomId);
        }).run();
        roomInfo.nextButton = Math.floor(Math.random() * 4);
    }

    if (roomInfo.conf.bsc) {
        console.log('游戏开始比赛场自动托管时间为8000');
        TOUGUANTIMES = 8000;
    }

    console.log(roomInfo.nextButton);
    var game = {
        conf: roomInfo.conf,
        roomInfo: roomInfo,
        gameIndex: roomInfo.numOfGames,

        button: roomInfo.nextButton,
        mahjongs: new Array(108),
        currentIndex: 0,
        gameSeats: new Array(4),

        numOfQue: 0,
        turn: 0,
        chuPai: -1,
        state: "idle",
        firstHupai: -1,
        yipaoduoxiang: -1,
        fangpaoshumu: -1,
        actionList: [],
        hupaiList: [],
        chupaiCnt: 0,
        jingMap: {},
        chaoZhuangCnt: 0,
        numTurn: 0,
        chaoZhuangMap: {},
        isQuanJiao: false,
        unScoreGangs: [],
        anGangChuPaiNum: [], //出现暗杠后,出牌4张,其他3个玩家就可以看见暗杠的底牌
        saizi: [Math.floor(Math.random() * 6 + 1), Math.floor(Math.random() * 6 + 1)],
        //自动托管时间
        tuoTime: Date.now() + TOUGUANTIMES + 15000,
        //没托管,遇到要碰杠超过15秒不操作自动托管碰或杠
        waitPengGang: [],
        //不能出牌列表
        cantChupaiList: [],
    };

    game.preButton = game.button - 1;
    if (game.preButton < 0) {
        game.preButton = game.gameSeats.length - 1;
    }

    roomInfo.numOfGames++;

    for (var i = 0; i < 4; ++i) {
        var data = game.gameSeats[i] = {};

        data.game = game;

        data.seatIndex = i;

        data.userId = seats[i].userId;
        //持有的牌
        data.holds = [];
        //打出的牌
        data.folds = [];
        //暗杠的牌
        data.angangs = [];
        //接杠
        data.jiegangs = [];
        //点杠的牌
        data.diangangs = [];
        //弯杠的牌
        data.wangangs = [];
        //碰了的牌
        data.pengs = [];
        //吃了牌
        data.chis = [];
        //缺一门
        data.que = -1;

        //--新增----提示-碰谁的-杠谁的-------
        data.diangangsId = [];
        data.wangangsId = [];
        data.pengsId = [];
        data.chisId = [];
        data.pengAndwangangID = [];
        data.isAutoPlay = false;
        //--end-------------

        //换三张的牌
        data.huanpais = null;

        //玩家手上的牌的数目，用于快速判定碰杠
        data.countMap = {};
        //玩家听牌，用于快速判定胡了的番数
        data.pattern = "";

        //是否可以杠
        data.canGang = false;
        //用于记录玩家可以杠的牌
        data.gangPai = [];

        //是否可以碰
        data.canPeng = false;
        //是否可以胡
        data.canHu = false;
        //是否可以出牌
        data.canChuPai = false;

        //如果guoHuFan >=0 表示处于过胡状态，
        //如果过胡状态，那么只能胡大于过胡番数的牌
        data.guoHuFan = -1;

        //是否胡了
        data.hued = false;
        //是否是自摸
        data.iszimo = false;

        data.isGangHu = false;

        //
        data.actions = [];

        data.fan = 0;
        data.score = 0;
        data.gangScore = 0;
        data.lastFangGangSeat = -1;

        data.chuJing = [];
        data.fangJingSeat = {};
        data.lastFangJingSeat = -1;
        data.chuFengNum = 0;
        data.chiPengGang = {};
        data.isDaLong = false;
        data.lastChiPai = -1;
        data.guoPengPai = -1;

        data.lastChuPai = -1;
        data.lastChuPaiCount = 0;

        //统计信息
        data.numZiMo = 0;
        data.numDiangang = 0;
        data.numAnGang = 0;
        data.numMingGang = 0;
        data.numJiegang = 0;

        gameSeatsOfUsers[data.userId] = data;
    }
    games[roomId] = game;
    diangangAndjiegang[roomId] = 0;
    if (roomInfo.conf.tuoguan) {
        if (!tuoguanRoomList[roomId]) {
            tuoguanRoomList.push(roomId);
        }
    }

    //洗牌
    shuffle(game);
    //发牌
    deal(game);
    //超过指定的时间就解散房间房间
    roomMgr.dissolveRequestdf(roomId);

    for (var i = 0; i < game.gameSeats.length; i++) {
        game.gameSeats[i].isPaoLong = checkPaoLong(game, game.gameSeats[i]);
    }

    var numOfMJ = game.mahjongs.length - game.currentIndex;
    var huansanzhang = roomInfo.conf.hsz;

    for (var i = 0; i < seats.length; ++i) {
        //开局时，通知前端必要的数据
        var s = seats[i];
        //通知玩家龙牌
        userMgr.sendMsg(s.userId, 'game_jings_push', game.jings);
        //通知游戏色子
        userMgr.sendMsg(s.userId, 'game_saizi_push', game.saizi);
        //通知玩家手牌
        userMgr.sendMsg(s.userId, 'game_holds_push', game.gameSeats[i].holds);
        //通知上塘
        userMgr.sendMsg(s.userId, 'game_shangtang', game.conf.numOfButton);
        //通知还剩多少张牌
        userMgr.sendMsg(s.userId, 'mj_count_push', numOfMJ);
        //通知还剩多少局
        userMgr.sendMsg(s.userId, 'game_num_push', roomInfo.numOfGames);
        //通知游戏开始
        userMgr.sendMsg(s.userId, 'game_begin_push', game.button);
    }
    start(game);
};

function start(game) {

    construct_game_base_info(game);

    game.state = 'playing';
    var turnSeat = game.gameSeats[game.turn];
    var roomId = roomMgr.getUserRoom(turnSeat.userId);
    var room = roomMgr.getRoom(roomId);
    userMgr.broacastInRoom('game_playing_push', null, room, turnSeat.userId, true);

    //通知玩家出牌方
    turnSeat.canChuPai = true;
    userMgr.broacastInRoom('game_chupai_push', turnSeat.userId, room, turnSeat.userId, true);
    //检查是否可以暗杠或者胡
    //直杠
    checkCanAnGang(game, turnSeat);
    //检查胡 用最后一张来检查
    checkCanHu(game, turnSeat);
    //通知前端
    sendOperations(game, turnSeat, game.chuPai);
}

/**
 * 自动出牌(托管)
 * @param userId
 * @param op 1: 自动托管 2: 取消自动托管
 */
exports.autoPlay = function (userId, op) {
    var seatData = gameSeatsOfUsers[userId];
    if (seatData == null) {
        console.log("can't find user game data.");
        return;
    }

    if (op) {
        seatData.isAutoPlay = true;
    } else {
        seatData.isAutoPlay = false;
    }
}

exports.chuPai = function (userId, pai) {

    pai = Number.parseInt(pai);
    var seatData = gameSeatsOfUsers[userId];
    if (seatData == null) {
        console.log("can't find user game data.");
        return;
    }

    var game = seatData.game;
    var seatIndex = seatData.seatIndex;
    //如果不该他出，则忽略
    if (game.turn != seatData.seatIndex) {
        console.log("not your turn.");
        return;
    }

    if (seatData.hued) {
        console.log('you have already hued. no kidding plz.');
        return;
    }

    if (seatData.canChuPai == false) {
        console.log('no need chupai.');
        return;
    }

    seatData.lastChiPai = -1;
    seatData.guoPengPai = -1;

    if (hasOperations(seatData)) {
        console.log('plz guo before you chupai.');
        return;
    }

    //从此人牌中扣除
    var index = seatData.holds.indexOf(pai);
    if (index == -1) {
        //console.log("holds:" + seatData.holds);
        console.log("can't find mj." + pai);
        return;
    }

    seatData.canChuPai = false;
    game.chupaiCnt++;

    //如果是庄家，则清除后，无脑记录
    if (seatIndex == game.button) {
        game.chaoZhuangMap = {};
        game.chaoZhuangMap[seatIndex] = pai;
    }
    else {
        //如果已经有记录，表示重复打了。清除。
        if (game.chaoZhuangMap[seatData.seatIndex] != null) {
            game.chaoZhuangMap = {}
        }
        //如果庄家没有出牌，则不需要记录
        if (game.chaoZhuangMap[game.button] != null) {
            game.chaoZhuangMap[seatData.seatIndex] = pai;
        }
    }

    var roomId = roomMgr.getUserRoom(seatData.userId);
    var room = roomMgr.getRoom(roomId);

    //如果是最后一家，则要检查是否抄庄
    if (seatIndex == game.preButton && game.numTurn == 0 && game.conf.wanfaxuanze == 1) {
        if (game.numTurn == game.chaoZhuangCnt) {
            //判断抄庄
            var cnt = 0;
            var last = null;
            for (var k in game.chaoZhuangMap) {
                var cur = game.chaoZhuangMap[k];
                if (last != null) {
                    if (last != cur) {
                        break;
                    }
                }
                last = cur;
                cnt++;
            }
            //如果4家都出一样的。。则表示抄庄咯。
            if (cnt == 4) {
                game.chaoZhuangCnt++;
                userMgr.broacastInRoom('cao_zhuang_push', null, room, seatData.userId, true);
            }
            game.chaoZhuangMap = {};
        }
        game.numTurn++;
    }


    if (game.jingMap[pai]) {
        seatData.chuJing.push(pai);
    } else {
        seatData.isDaLong = false;
    }

    if (getMJType(pai) == 3 || game.jingMap[pai]) {
        seatData.chuFengNum++;
    } else {
        seatData.chuFengNum = 0;
    }


    seatData.holds.splice(index, 1);
    seatData.countMap[pai]--;

    //托管时间刷新
    game.tuoTime = Date.now() + TOUGUANTIMES;
    //刷新托管 碰杠吃胡
    game.waitPengGang = [];
    //不能吃碰什么出什么牌列表
    game.cantChupaiList = [];

    game.chuPai = pai;
    seatData.isPaoLong = checkPaoLong(game, seatData);
    recordGameAction(game, seatData.seatIndex, ACTION_CHUPAI, pai);
    userMgr.broacastInRoom('game_chupai_notify_push', { userId: seatData.userId, pai: pai }, room, seatData.userId, true);
    sameChupaiCount(seatData, pai);
    if (game.conf.shiyifeng) {
        checkCanHu(game, seatData);
        if (seatData.canHu && seatData.isQuanJiao && seatData.tingInfo.pattern == 'shiyifeng') {
            sendOperations(game, seatData, pai);
            return;
        }
        clearAllOptions(game, seatData);
    }
    //检查是否有人要胡，要碰 要杠
    var hasActions = false;
    for (var i = 0; i < game.gameSeats.length; ++i) {
        //玩家自己不检查
        if (game.turn == i) {
            continue;
        }
        var ddd = game.gameSeats[i];
        //已经和牌的不再检查
        if (ddd.hued) {
            continue;
        }

        checkCanHu(game, ddd, pai);
        if (true) {
            if (ddd.canHu && ddd.guoHuFan >= 0) {
                console.log("ddd.guoHuFan:" + ddd.guoHuFan);
                ddd.canHu = false;
                userMgr.sendMsg(ddd.userId, 'guohu_push');
            }
        }

        checkCanDianGang(game, ddd, pai, userId);
        checkCanPeng(game, ddd, pai);

        //如果是下家，则检查是否可以吃
        if (i == (game.turn + 1) % 4) {
            checkCanChi(game, ddd, pai);
        }

        if (hasOperations(ddd)) {
            sendOperations(game, ddd, game.chuPai);
            hasActions = true;
        }
    }

    //记录 暗杠出完一圈,给其他玩家也显示暗杠
    if (game.anGangChuPaiNum) {
        for (var i = 0; i < game.anGangChuPaiNum.length; i++) {
            if (game.anGangChuPaiNum[i].Num < 4) {
                game.anGangChuPaiNum[i].Num++;
            } else {
                if (!game.anGangChuPaiNum[i].OneRing) {
                    game.anGangChuPaiNum[i].OneRing = true;
                    userMgr.broacastInRoom('show_angang_push', { anGangChuPaiNum: game.anGangChuPaiNum }, room, seatData.userId, true);
                }
            }
        }
    }

    //如果没有人有操作，则向下一家发牌，并通知他出牌
    if (!hasActions) {
        //原因:为不了不影响客户的的出牌效果----延时通知玩家摸牌  
        setTimeout(function () {
            userMgr.broacastInRoom('guo_notify_push', {
                userId: seatData.userId,
                pai: game.chuPai
            }, room, seatData.userId, true);
            seatData.folds.push(game.chuPai);
            game.chuPai = -1;
            moveToNextUser(game);
            doUserMoPai(game);
        }, 500);
    }
};

function sameChupaiCount(seatData, pai) {
    if (pai == seatData.lastChuPai) {
        seatData.lastChuPaiCount++;
    } else {
        seatData.lastChuPaiCount = 0;
        seatData.lastChuPai = pai;
    }
    // 连出四张一样的牌算杠
    if (seatData.lastChuPaiCount >= 3) {
        var ac = recordUserAction(seatData.game, seatData, "diangang");
        ac.score = 10;
        ac.pai = pai;
    }
}

exports.chi = function (userId, p1, p2) {
    if (p1 == null || p2 == null) {
        console.log("p1==null || p2==null");
        return;
    }

    var seatData = gameSeatsOfUsers[userId];
    if (seatData == null) {
        console.log("can't find user game data.");
        return;
    }

    var game = seatData.game;

    game.curActionData = null;

    //如果是他出的牌，则忽略
    if (game.turn == seatData.seatIndex) {
        console.log("it's your turn.");
        return;
    }

    //如果没有吃的机会，则不能再碰
    if (seatData.canChi == false) {
        console.log("seatData.chi == false");
        return;
    }

    //和的了，就不要再来了
    if (seatData.hued) {
        console.log('you have already hued. no kidding plz.');
        return;
    }

    //检查3张牌是否有相同的
    if (p1 == p2 || p1 == game.chuPai || p2 == game.chuPai) {
        //
        console.log("can't be same.");
        return;
    }

    if (p1 == game.jings[1] || p2 == game.jings[1] || game.chuPai == game.jings[1]) {
        return;
    }

    //检查此玩家手牌是否足够
    if (!(seatData.countMap[p1] >= 1 && seatData.countMap[p2] >= 1)) {
        console.log("lack of p1,p2.");
        return;
    }

    seatData.guoHuFan = -1;
    //这里还要处理过胡的情况
    if (seatData.canHu) {
        seatData.guoHuFan = seatData.tingInfo.fan;
    }

    if (seatData.canHu) {
        seatData.canHu = false;
        console.log("玩家选择吃, 则过胡, userId : " + seatData.userId);
    }
    //检查有没有人可以碰杠胡
    for (var k in game.gameSeats) {
        var ddd = game.gameSeats[k];
        if (ddd.canHu || ddd.canDianGang || ddd.canPeng) {
            if (ddd != seatData) {
                // 如果可以胡又可以吃,点击吃牌之后胡先消失掉
                sendOperations(game, seatData, game.chuPai);
                return;
            }
        }
    }

    var pai = game.chuPai;

    var t1 = getMJType(p1);
    var t2 = getMJType(p2);
    var t3 = getMJType(pai);
    //检查是否为同一个花色
    if (t1 != t2 || t2 != t3 || t1 != t3) {
        console.log("not same color.");
        return;
    }

    //如果是风 则直接就是OK的，因为前面已经判定过3张牌都不相同了
    if (t1 == 3 && pai >= 27 && pai <= 30) {
    }
    //筒条万，或者中发白
    else if ((p1 == pai - 2) && (p2 == pai - 1)
        || (p1 == pai - 1) && (p2 == pai + 1)
        || (p1 == pai + 1) && (p2 == pai + 2)) {
        //ok.
    }
    else {
        console.log("invalid p1,p2");
        return;
    }

    recordGameAction(game, seatData.seatIndex, ACTION_CHI, pai, p1, p2);

    clearAllOptions(game);

    var idx = seatData.holds.indexOf(p1);
    seatData.holds.splice(idx, 1);
    seatData.countMap[p1]--;

    var idx = seatData.holds.indexOf(p2);
    seatData.holds.splice(idx, 1);
    seatData.countMap[p2]--;


    seatData.chis.push([pai, p1, p2]);

    //--新增----提示吃谁的牌--------
    var n = seatData.seatIndex - game.turn;
    if (n < 0) {
        n += 4;
    }
    seatData.chisId.push(n);
    //--end----------------

    game.chuPai = -1;

    if (game.jingMap[pai]) {
        seatData.fangJingSeat[pai] = game.turn;
        seatData.lastFangJingSeat = game.turn;
    }

    //recordGameAction(game,seatData.seatIndex,ACTION_CHI,pai,p1,p2);
    seatData.lastActionIsGang = false;

    var roomId = roomMgr.getUserRoom(seatData.userId);
    var room = roomMgr.getRoom(roomId);

    //不能吃什么出什么牌
    var arr = [pai, p1, p2];
    arr = arr.sort(function (a, b) {
        return a - b;
    });
    var chupaiArr = [];
    chupaiArr.push(pai);
    // if (arr[0] == pai && arr[2] % 9 != 8) {
    //     chupaiArr.push(arr[2] + 1);
    // } else if (arr[2] == pai && arr[0] % 9 != 0) {
    //     chupaiArr.push(arr[0] - 1);
    // }
    game.cantChupaiList = chupaiArr;

    //广播通知其它玩家
    userMgr.broacastInRoom('chi_notify_push', {
        userid: seatData.userId,
        si: seatData.seatIndex,
        chipai: [pai, p1, p2],
        chisId: seatData.chisId,
        cantChupaiList: game.cantChupaiList
    }, room, seatData.userId, true);

    //托管时间刷新
    game.tuoTime = Date.now() + TOUGUANTIMES;

    seatData.lastChiPai = pai;
    addChiPengGang(seatData, game.gameSeats[game.turn]);

    //碰的玩家打牌
    moveToNextUser(game, seatData.seatIndex);
    //吃之后 不可以暗杠或者弯杠
    //检查是否可以暗杠或者弯杠。
    // checkCanAnGang(game, seatData);
    // checkCanWanGang(game, seatData);

    //广播通知玩家出牌方
    seatData.canChuPai = true;
    userMgr.broacastInRoom('game_chupai_push', seatData.userId, room, seatData.userId, true);

    //通知玩家做对应操作
    sendOperations(game, seatData);
};

exports.peng = function (userId) {
    var seatData = gameSeatsOfUsers[userId];
    if (seatData == null) {
        console.log("can't find user game data.");
        return;
    }

    var game = seatData.game;

    //如果是他出的牌，则忽略
    if (game.turn == seatData.seatIndex) {
        console.log("it's your turn.");
        return;
    }

    //如果没有碰的机会，则不能再碰
    if (seatData.canPeng == false) {
        console.log("seatData.peng == false");
        return;
    }

    //和的了，就不要再来了
    if (seatData.hued) {
        console.log('you have already hued. no kidding plz.');
        return;
    }

    //如果有人可以胡牌，则需要等待
    var i = game.turn;
    while (true) {
        var i = (i + 1) % 4;
        if (i == game.turn) {
            break;
        }
        else {
            var ddd = game.gameSeats[i];
            if (ddd.canHu && i != seatData.seatIndex) {
                return;
            }
        }
    }

    seatData.guoHuFan = -1;

    //这里还要处理过胡的情况
    if (seatData.canHu) {
        seatData.guoHuFan = seatData.tingInfo.fan;
    }

    clearAllOptions(game);

    //验证手上的牌的数目
    var pai = game.chuPai;
    var c = seatData.countMap[pai];
    if (c == null || c < 2) {
        console.log("pai:" + pai + ",count:" + c);
        //console.log(seatData.holds);
        console.log("lack of mj.");
        return;
    }

    //在明杠里面，手中已有三张，在跳出提示可以
    // 杠的前提下，先选择碰，后面几圈再杠是没有杠分的。
    // 举例：东家手里3个八万，西家打出八万，这个时候东家先选择了碰，
    // 然后第二圈的时候再用自己手里的另一个八万去杠，这样是没有杠分的！
    if (c >= 3) {
        game.unScoreGangs.push(pai);
    }

    //进行碰牌处理
    //扣掉手上的牌
    //从此人牌中扣除
    for (var i = 0; i < 2; ++i) {
        var index = seatData.holds.indexOf(pai);
        if (index == -1) {
            console.log("can't find mj.");
            return;
        }
        seatData.holds.splice(index, 1);
        seatData.countMap[pai]--;
    }
    seatData.pengs.push(pai);

    //--新增----提示碰谁的碰--------
    var n = seatData.seatIndex - game.turn;
    if (n < 0) {
        n += 4;
    }
    seatData.pengsId.push(n);
    seatData.pengAndwangangID.push([pai, n]);
    //--end----------------

    game.chuPai = -1;

    if (game.jingMap[pai]) {
        seatData.fangJingSeat[pai] = game.turn;
        seatData.lastFangJingSeat = game.turn;
    }

    recordGameAction(game, seatData.seatIndex, ACTION_PENG, pai);

    var roomId = roomMgr.getUserRoom(seatData.userId);
    var room = roomMgr.getRoom(roomId);

    //不能碰什么 出什么牌
    game.cantChupaiList = [pai];

    //广播通知其它玩家
    userMgr.broacastInRoom('peng_notify_push', {
        userid: seatData.userId,
        pai: pai,
        pengsId: seatData.pengsId,
        cantChupaiList: game.cantChupaiList,
    }, room, seatData.userId, true);

    addChiPengGang(seatData, game.gameSeats[game.turn]);

    //碰的玩家打牌
    moveToNextUser(game, seatData.seatIndex);

    //广播通知玩家出牌方
    seatData.canChuPai = true;
    userMgr.broacastInRoom('game_chupai_push', seatData.userId, room, seatData.userId, true);

    //托管时间刷新
    game.tuoTime = Date.now() + TOUGUANTIMES;
    //刷新托管 碰杠吃胡
    game.waitPengGang = [];

    //玩法是碰之后不可以暗杠或者明杠
    //检查是否可以暗杠或者弯杠。
    // checkCanAnGang(game, seatData);
    // checkCanWanGang(game, seatData, pai);

    //通知玩家做对应操作
    sendOperations(game, seatData);

    if (seatData.seatIndex == game.button) {
        game.numTurn++;
    }

    //如果托管 碰之后通知出牌
    if (seatData.isAutoPlay && !hasOperations(seatData)) {
        setTimeout(function () {
            exports.chuPai(seatData.userId, seatData.holds[seatData.holds.length - 1]);
        }, ChuPaituoguantime);
    }
};

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
}

function checkCanQiangGang(game, turnSeat, seatData, pai) {
    // 瞎子麻将不准抢杠胡
    if (game.conf.wanfaxuanze == 1) {
        return false;
    }
    var gangCount = seatData.angangs.length + seatData.diangangs.length + seatData.wangangs.length;
    if (game.conf.sangang && gangCount >= 2) {
        return false;
    }
    var hasActions = false;
    for (var i = 0; i < game.gameSeats.length; ++i) {
        //杠牌者不检查
        if (seatData.seatIndex == i) {
            continue;
        }
        var ddd = game.gameSeats[i];
        //已经和牌的不再检查
        if (ddd.hued) {
            continue;
        }

        checkCanHu(game, ddd, pai, true);
        if (ddd.canHu) {
            sendOperations(game, ddd, pai);
            hasActions = true;
        }
    }
    if (hasActions) {
        game.qiangGangContext = {
            turnSeat: turnSeat,
            seatData: seatData,
            pai: pai,
            isValid: true,
        }
    }
    else {
        game.qiangGangContext = null;
    }
    return game.qiangGangContext != null;
}

function doGang(game, turnSeat, seatData, gangtype, numOfCnt, pai) {
    var seatIndex = seatData.seatIndex;
    var gameTurn = turnSeat.seatIndex;
    seatData.guoHuFan = -1;
    var isZhuanShouGang = false;
    if (gangtype == "wangang") {
        var idx = seatData.pengs.indexOf(pai);
        if (idx >= 0) {
            seatData.pengs.splice(idx, 1);
        }

        //如果最后一张牌不是杠的牌，则认为是转手杠
        //万州麻将里面，没有转手杠的说法，改这里最快
        //if(seatData.holds[seatData.holds.length - 1] != pai){
        //     isZhuanShouGang = true;
        // }
    }
    //进行碰牌处理
    //扣掉手上的牌
    //从此人牌中扣除
    for (var i = 0; i < numOfCnt; ++i) {
        var index = seatData.holds.indexOf(pai);
        if (index == -1) {
            //console.log(seatData.holds);
            console.log("can't find mj.");
            return;
        }
        seatData.holds.splice(index, 1);
        seatData.countMap[pai]--;
    }

    recordGameAction(game, seatData.seatIndex, ACTION_GANG, pai);

    //记录下玩家的杠牌
    if (gangtype == "angang") {
        seatData.angangs.push(pai);
        game.anGangChuPaiNum.push({ pai: pai, Num: 0, OneRing: false });
        var ac = recordUserAction(game, seatData, "angang");
        ac.score = 20;
        ac.pai = pai;
    }
    else if (gangtype == "diangang") {
        seatData.diangangs.push(pai);
        var ac = recordUserAction(game, seatData, "diangang", gameTurn);
        ac.score = 20;
        ac.pai = pai;
        var fs = turnSeat;
        recordUserAction(game, fs, "fanggang", seatIndex);

        //--新增---增加提示-明杠谁的牌--
        var n = seatData.seatIndex - game.turn;
        if (n < 0) {
            n += 4;
        }
        seatData.diangangsId.push(n);
        var roomId = roomMgr.getUserRoom(seatData.userId);
        var chupaiseatData = gameSeatsOfUsers[diangangAndjiegang[roomId]];
        chupaiseatData.jiegangs.push(pai);
        //--end-------------
    }
    else if (gangtype == "wangang") {
        seatData.wangangs.push(pai);
        if (isZhuanShouGang == false) {
            var ac = recordUserAction(game, seatData, "wangang");
            ac.score = 10;
            ac.pai = pai;
            if (game.unScoreGangs.indexOf(pai) > -1) {
                ac.state = 'nop';
            }
        }
        else {
            recordUserAction(game, seatData, "zhuanshougang");
        }

        //--新增---提示杠谁的弯杠---------------
        var n = -1;
        var itMun = -1;
        for (var k in seatData.pengAndwangangID) {
            if (seatData.pengAndwangangID[k][0] === pai) {
                n = seatData.pengAndwangangID[k][1];
                seatData.pengAndwangangID.splice(k, 1);
                itMun = k;
                break;
            }
        }
        if (n > 0) {
            seatData.wangangsId.push(n);
        }
        for (var k in seatData.pengsId) {
            if (seatData.pengsId[k] === n && k === itMun) {
                seatData.pengsId.splice(k, 1);
                break;
            }
        }
        //--end------------------------------
    }

    if (game.jingMap[pai] && gangtype == 'diangang') {
        seatData.fangJingSeat[pai] = game.turn;
        seatData.lastFangJingSeat = game.turn;
    }

    if (gangtype == 'diangang') {
        addChiPengGang(seatData, game.gameSeats[game.turn]);
    }

    var roomId = roomMgr.getUserRoom(seatData.userId);
    var room = roomMgr.getRoom(roomId);

    //通知其他玩家，有人杠了牌
    userMgr.broacastInRoom('gang_notify_push', {
        userid: seatData.userId,
        pai: pai,
        gangtype: gangtype,
        diangangsId: seatData.diangangsId,
        wangangsId: seatData.wangangsId,
        pengsId: seatData.pengsId
    }, room, seatData.userId, true);

    if (seatData.isPaoLong) {
        seatData.isPaoLong = checkPaoLong(game, seatData);
    }

    //变成自己的轮子
    moveToNextUser(game, seatIndex);
    //再次摸牌
    doUserMoPai(game, gameTurn);
}

exports.gang = function (userId, pai) {
    var seatData = gameSeatsOfUsers[userId];

    if (seatData == null) {
        console.log("can't find user game data.");
        return;
    }

    var seatIndex = seatData.seatIndex;
    var game = seatData.game;

    //如果没有杠的机会，则不能再杠
    if (seatData.canGang == false) {
        console.log("seatData.gang == false");
        return;
    }

    //和的了，就不要再来了
    if (seatData.hued) {
        console.log('you have already hued. no kidding plz.');
        return;
    }

    if (game.jingMap[pai] == true) {
        console.log('cant gang long');
        return;
    }

    if (seatData.gangPai.indexOf(pai) == -1) {
        console.log("the given pai can't be ganged.");
        return;
    }

    //如果有人可以胡牌，则需要等待
    var i = game.turn;
    while (true) {
        var i = (i + 1) % 4;
        if (i == game.turn) {
            break;
        }
        else {
            var ddd = game.gameSeats[i];
            if (ddd.canHu && i != seatData.seatIndex) {
                return;
            }
        }
    }

    var numOfCnt = seatData.countMap[pai];

    var gangtype = ""
    //弯杠 去掉碰牌
    if (numOfCnt == 1) {
        gangtype = "wangang"
    }
    else if (numOfCnt == 3) {
        gangtype = "diangang"
    }
    else if (numOfCnt == 4) {
        gangtype = "angang";
    }
    else {
        console.log("invalid pai count.");
        return;
    }

    game.chuPai = -1;

    //这里还要处理过胡的情况
    if (seatData.canHu) {
        seatData.guoHuFan = seatData.tingInfo.fan;
    }

    clearAllOptions(game);
    seatData.canChuPai = false;
    var roomId = roomMgr.getUserRoom(seatData.userId);
    var room = roomMgr.getRoom(roomId);
    userMgr.broacastInRoom('hangang_notify_push', seatIndex, room, seatData.userId, true);

    //托管时间刷新
    game.tuoTime = Date.now() + TOUGUANTIMES;
    //刷新托管 碰杠吃胡
    game.waitPengGang = [];

    //如果是弯杠，则需要检查是否可以抢杠
    var turnSeat = game.gameSeats[game.turn];
    if (numOfCnt == 1) {
        var canQiangGang = checkCanQiangGang(game, turnSeat, seatData, pai);
        if (canQiangGang) {
            return;
        }
    }

    doGang(game, turnSeat, seatData, gangtype, numOfCnt, pai);

    if (seatData.seatIndex == game.button) {
        game.numTurn++;
    }
};

function getHuLevel(seatData) {
    var pattern = seatData.tingInfo.pattern;
    if (pattern == 'quanfengxiang' || pattern == 'sangang' || pattern == 'silong') {
        return 3;
    }
    if (seatData.dandiao || seatData.isQingYiSe || pattern == 'qing7pairs') {
        return 2;
    }
    return 0;
}

exports.hu = function (userId) {
    var seatData = gameSeatsOfUsers[userId];
    if (seatData == null) {
        console.log("can't find user game data.[uiserid]:" + userId);
        return;
    }

    var seatIndex = seatData.seatIndex;
    var game = seatData.game;

    //如果他不能和牌，那和个啥啊
    if (seatData.canHu == false) {
        console.log("invalid request.[uiserid]:" + userId);
        return;
    }

    //和的了，就不要再来了
    if (seatData.hued) {
        console.log('you have already hued. no kidding plz.[uiserid]:' + userId);
        return;
    }

    var maxHuLevel = 0;
    for (var i = 0; i < game.gameSeats.length; i++) {
        var td = game.gameSeats[i];
        if (td.canHu) {
            if (td.tingInfo.huLevel > maxHuLevel) {
                maxHuLevel = td.tingInfo.huLevel;
            }
        }
    }
    if (maxHuLevel > seatData.tingInfo.huLevel) {
        console.log('not the max hu level');
        return;
    }

    var roomId = roomMgr.getUserRoom(seatData.userId);
    var room = roomMgr.getRoom(roomId);

    var i = game.turn;
    while (true) {
        var i = (i + 1) % 4;
        if (i == game.turn) {
            break;
        }
        else {
            var ddd = game.gameSeats[i];
            if (ddd.canHu && ddd.tingInfo.huLevel >= seatData.tingInfo.huLevel) {
                if (i != seatData.seatIndex) {
                    //如果前面有人可以胡牌，则需要等待
                    return;
                }
                break;
            }
        }
    }

    //标记为和牌
    seatData.hued = true;
    var hupai = game.chuPai;
    var isZimo = false;

    if (game.jingMap[hupai]) {
        seatData.fangJingSeat[hupai] = game.turn;
        seatData.lastFangJingSeat = game.turn;
    }

    var turnSeat = game.gameSeats[game.turn];
    seatData.isGangHu = turnSeat.lastFangGangSeat >= 0;
    var notify = -1;

    if (game.qiangGangContext != null) {
        var gangSeat = game.qiangGangContext.seatData;
        hupai = game.qiangGangContext.pai;
        notify = hupai;
        var ac = recordUserAction(game, seatData, "qiangganghu", gangSeat.seatIndex);
        ac.iszimo = false;
        recordGameAction(game, seatIndex, ACTION_HU, hupai);
        seatData.isQiangGangHu = true;
        game.qiangGangContext.isValid = false;


        var idx = gangSeat.holds.indexOf(hupai);
        if (idx != -1) {
            gangSeat.holds.splice(idx, 1);
            gangSeat.countMap[hupai]--;
            userMgr.sendMsg(gangSeat.userId, 'game_holds_push', gangSeat.holds);
        }
        //将牌添加到玩家的手牌列表，供前端显示
        seatData.holds.push(hupai);
        if (seatData.countMap[hupai]) {
            seatData.countMap[hupai]++;
        }
        else {
            seatData.countMap[hupai] = 1;
        }

        recordUserAction(game, gangSeat, "beiqianggang", seatIndex);
    }
    else if (game.chuPai == -1) {
        hupai = seatData.holds[seatData.holds.length - 1];
        notify = -1;
        if (seatData.isGangHu) {
            if (turnSeat.lastFangGangSeat == seatIndex) {
                var ac = recordUserAction(game, seatData, "ganghua");
                ac.iszimo = true;
            }
            else {
                var diangganghua_zimo = true;//game.conf.dianganghua == 1;
                if (diangganghua_zimo) {
                    var ac = recordUserAction(game, seatData, "dianganghua");
                    ac.iszimo = true;
                }
                else {
                    var ac = recordUserAction(game, seatData, "dianganghua", turnSeat.lastFangGangSeat);
                    ac.iszimo = false;
                }
            }
        }
        else {
            var ac = recordUserAction(game, seatData, "zimo");
            ac.iszimo = true;
        }

        isZimo = true;
        recordGameAction(game, seatIndex, ACTION_ZIMO, hupai);
    }
    else {
        notify = game.chuPai;
        //将牌添加到玩家的手牌列表，供前端显示
        seatData.holds.push(game.chuPai);
        if (seatData.countMap[game.chuPai]) {
            seatData.countMap[game.chuPai]++;
        }
        else {
            seatData.countMap[game.chuPai] = 1;
        }

        console.log(seatData.holds);

        var at = "hu";
        //炮胡
        if (turnSeat.lastFangGangSeat >= 0) {
            at = "gangpaohu";
        }

        var ac = recordUserAction(game, seatData, at, game.turn);
        ac.iszimo = false;

        //记录玩家放炮信息
        var fs = game.gameSeats[game.turn];
        recordUserAction(game, fs, "fangpao", seatIndex);

        recordGameAction(game, seatIndex, ACTION_HU, hupai);

        game.fangpaoshumu++;

        if (game.fangpaoshumu > 1) {
            game.yipaoduoxiang = seatIndex;
        }
    }

    if (game.firstHupai < 0) {
        game.firstHupai = seatIndex;
    }

    //保存番数
    var ti = seatData.tingInfo;
    seatData.fan = ti.fan;
    seatData.pattern = ti.pattern;
    seatData.iszimo = isZimo;
    seatData.hupai = hupai;
    //如果是最后一张牌，则认为是海底胡
    seatData.isHaiDiHu = game.currentIndex == game.mahjongs.length;
    //非自摸都不算精吊
    if (!isZimo) {
        seatData.isJingDiao = false;
    }
    game.hupaiList.push(seatData.seatIndex);

    clearAllOptions(game);

    //通知前端，有人和牌了
    userMgr.broacastInRoom('hu_push', { seatIndex: seatIndex, iszimo: isZimo, hupai: hupai, isQuanJiao: seatData.isQuanJiao }, room, seatData.userId, true);

    //
    if (game.lastHuPaiSeat == -1) {
        game.lastHuPaiSeat = seatIndex;
    }
    else {
        var lp = (game.lastFangGangSeat - game.turn + 4) % 4;
        var cur = (seatData.seatIndex - game.turn + 4) % 4;
        if (cur > lp) {
            game.lastHuPaiSeat = seatData.seatIndex;
        }
    }

    setTimeout(function () {
        doGameOver(game, seatData.userId);
    }, 500);
};

exports.guo = function (userId, checkchupai) {
    var seatData = gameSeatsOfUsers[userId];
    if (seatData == null) {
        console.log(new Date(), "[BUGCHECK]--guobug--seatData is null 玩家ID:[" + userId + "]");
        return;
    }

    if (seatData.isQuanJiao) {
        console.log(new Date(), "[BUGCHECK]--guohu--quanjiao--玩家ID:[" + userId + "]");
    } else if (seatData.canHu) {
        console.log(new Date(), "[BUGCHECK]--guohu----玩家ID:[" + userId + "]");
    }

    if (seatData.canHu && seatData.isQuanJiao) {
        console.log("quanjiao can't guo");
        return;
    }

    seatData.paoLong = false;
    if (seatData.canHu == true) {
        seatData.paoLong = true;
    }

    var seatIndex = seatData.seatIndex;
    var game = seatData.game;

    if (game.state == 'baoting') {
        var idx = game.couldBaoTing.indexOf(seatIndex);
        if (idx != -1) {
            game.couldBaoTing.splice(idx, 1);
            if (game.couldBaoTing.length == 0) {
                start(game);
            }
        }
        userMgr.sendMsg(seatData.userId, "guo_result");
        return;
    }

    //如果玩家没有对应的操作，则也认为是非法消息
    if (!hasOperations(seatData)) {
        console.log("no need guo.");
        return;
    }

    //如果是玩家自己的轮子，不是接牌，则不需要额外操作
    var doNothing = game.chuPai == -1 && game.turn == seatIndex;

    //这里还要处理过胡的情况
    if (seatData.canHu) {
        seatData.guoHuFan = seatData.tingInfo.fan;
    }

    if (seatData.canPeng == true) {
        seatData.guoPengPai = game.chuPai;
    }

    userMgr.sendMsg(seatData.userId, "guo_result");
    clearAllOptions(game, seatData);
    console.log('======过1======[doNothing]:', doNothing);
    console.log('======过2======[userid]:', seatData.userId);
    if (doNothing) {
        console.log('======过3======[userid]:', checkchupai);
        console.log('======过4======[userid]:', seatData.holds.length);
        if (checkchupai) {
            exports.chuPai(seatData.userId, seatData.holds[seatData.holds.length - 1]);
        }
        return;
    }

    //如果还有人可以操作，则等待
    for (var i = 0; i < game.gameSeats.length; ++i) {
        var ddd = game.gameSeats[i];
        if (hasOperations(ddd)) {
            return;
        }
    }

    var roomId = roomMgr.getUserRoom(seatData.userId);
    var room = roomMgr.getRoom(roomId);

    //如果是已打出的牌，则需要通知。
    if (game.chuPai >= 0) {
        var turnSeat = game.gameSeats[game.turn];
        userMgr.broacastInRoom('guo_notify_push', { userId: turnSeat.userId, pai: game.chuPai }, room, seatData.userId, true);
        turnSeat.folds.push(game.chuPai);
        game.chuPai = -1;
    }


    var qiangGangContext = game.qiangGangContext;
    //清除所有的操作
    clearAllOptions(game);

    if (qiangGangContext != null && qiangGangContext.isValid) {
        doGang(game, qiangGangContext.turnSeat, qiangGangContext.seatData, "wangang", 1, qiangGangContext.pai);
    }
    else {
        //下家摸牌
        moveToNextUser(game);
        doUserMoPai(game);
    }
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


var DI_FEN = [1, 2];
var ZHUA_MA = [0, 2, 4, 6, 1];
//亮子玩法 扣费和选择
var JU_SHU = [16, 999]; //局数
var JU_SHU_COST = [4, 8]; //扣费
var AA_SHU_COST = [1, 2];  //AA扣费
exports.getConf = function (creator, roomConf, gems) {
    var res = {
        ret: RET_OK,
        conf: null,
    };

    if (
        roomConf.type == null
        || roomConf.difen == null
        || roomConf.jushuxuanze == null
        || roomConf.zhuang == null
        || roomConf.pinghu == null
    ) {
        return res;
    }

    // var cost = JU_SHU_COST[roomConf.jushuxuanze];
    // if (cost > gems) {
    //     res.ret = GAME_ERRS.GEMS_NOT_ENOUGH;
    //     return res;
    // }

    //瞎子玩法
    var cost = 4;
    var maxGames = 999;
    var qingyise = 1;
    //如果是亮子 玩法 
    if (roomConf.wanfaxuanze == 0) {
        if (roomConf.aa) {
            cost = AA_SHU_COST[roomConf.jushuxuanze];
        } else {
            //游戏币
            cost = JU_SHU_COST[roomConf.jushuxuanze];
        }
        //局数
        maxGames = JU_SHU[roomConf.jushuxuanze];
        //无龙清一色 取消
        qingyise = 0;
    } else if (roomConf.aa) {
        //瞎子玩法AA扣费
        cost = 1;
    }
    if (!roomConf.club_id) {
        if (cost > gems) {
            res.ret = GAME_ERRS.GEMS_NOT_ENOUGH;
            return res;
        }
    }

    res.errcode = 0;
    res.conf = {
        type: roomConf.type,
        baseScore: 11,
        maxGames: maxGames,
        zhuang: roomConf.zhuang,
        pinghu: 0,
        cost: cost,
        creator: creator,
        model: roomConf.model,
        wanfaxuanze: roomConf.wanfaxuanze,
        shiyifeng: roomConf.shiyifeng,
        sangang: roomConf.sangang,
        qingqidui: roomConf.qingqidui,
        qingyise: qingyise,
        //ip限制
        ipstrict: false,//roomConf.ipstrict,
        qiqian: roomConf.qiqian,
        numOfButton: 0,
        tuoguan: roomConf.tuoguan,
        aa: roomConf.aa,
        club_id: roomConf.club_id ? roomConf.club_id : 0,
        //道具限制
        daojustrict: roomConf.daojustrict,
    }
    return res;
}

exports.syncLocation = function (userId, checkroomid) {//gps
    try {
        var roomId = checkroomid
        if (!roomId) {
            roomId = roomMgr.getUserRoom(userId);
        }

        if (roomId == null) {
            return;
        }

        var roomInfo = roomMgr.getRoom(roomId);
        if (roomInfo == null) {
            return;
        }
        var data = [];
        for (var i = 0; i < roomInfo.seats.length; ++i) {
            var rs = roomInfo.seats[i];
            var loc = userIdLocation[rs.userId];
            if (rs.userId == 0) {
                loc = null;
            }
            if (loc != null) {
                data.push({ userId: rs.userId, location: loc, name: rs.name });
            } else {
                data.push({ userId: rs.userId, location: null, name: rs.name });
            }
        }
        userMgr.broacastInRoom('location_push', data, roomInfo, userId, true);
    } catch (error) {
        console.error(new Date(), "gps" + error);
    }
}

exports.setLocation = function (userId, location, data) {
    //如果传过来的gps 不等于null 就赋值.
    if (location != null || !userIdLocation[userId]) {
        userIdLocation[userId] = location;
    }
    exports.syncLocation(userId);
}


var dissolvingList = [];

exports.doDissolve = function (roomId, judge) {
    var roomInfo = roomMgr.getRoom(roomId);
    if (roomInfo == null) {
        return null;
    }

    var game = games[roomId];
    if (game != null) { //如果游戏开始就 通知游戏结束
        doGameOver(game, roomInfo.seats[0].userId, true, roomId);
    }
    else { //否则解散直接踢玩家出房间
        var time = 0;
        if (roomInfo.numOfGames >= 1) {
            time = 10000;
        }
        var userId = 0;
        for (var i = 0; i < 4; ++i) {//如果房间有人超过1个小时不开始游戏就删除房间
            userId = roomInfo.seats[i].userId;
            if (userId > 0) {
                break
            }
        }
        console.log('[CHECKBUG]-teshu--gameover--->roomId:[' + roomId + ']');
        //如果是俱乐部 特殊申请房间走这里
        if (roomInfo.conf.for_others && roomInfo.conf.club_id) {
            var temp = true;
            if (userId > 0) {
                temp = false;
            }
            if (roomInfo.numOfGames != 0) {
                applyGameOver(userId, roomId);
                //刷新房间数据
                roomMgr.closeRoom(roomId, temp);
            } else {
                //超过特殊指定时间还未开局 删除房间走这里
                for (var i = 0; i < 4; ++i) {
                    userId = roomInfo.seats[i].userId;
                    if (userId > 0) {
                        userMgr.broacastInRoom('Tiren_push', userId, roomInfo, userId, true);
                        userMgr.kickOne(userId);
                        roomMgr.exitRoom(userId, roomId);
                    }
                }
                roomMgr.destroy(roomId);
                console.log("[GAMEBUG]--Dissolve the delete room--numOfGames == 0  [roomid]:", roomId);
            }
        } else if (userId > 0) {
            if (roomInfo.numOfGames >= 1) {
                applyGameOver(userId, roomId);
            }
            setTimeout(() => {
                userMgr.broacastInRoom('room_close_push', null, roomInfo, userId, true);
                userMgr.broacastInRoom('dispress_push', {}, roomInfo, userId, true);
                userMgr.kickAllInRoom(roomInfo);
                roomMgr.destroy(roomId);
            }, time);
        }
    }

    if (judge) {
        roomMgr.destroy(roomId);
    }
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
        endTime: Date.now() + 120000,
        states: [false, false, false, false]
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
    //托管出牌-------
    for (var i = tuoguanRoomList.length - 1; i >= 0; --i) {
        var roomId = tuoguanRoomList[i];
        if (games[roomId]) {
            var game = games[roomId];
            if (Date.now() > game.tuoTime) {
                var room = roomMgr.getRoom(roomId);
                if (game.waitPengGang.length > 0) {
                    for (var n = 0; n < game.waitPengGang.length; n++) {
                        var temp = gameSeatsOfUsers[game.waitPengGang[n]];
                        console.log('====是否托管[' + i + ']:1.5====[hu]:', temp.canHu + '[canGang]:' + temp.canGang + '[canPeng]' + temp.canPeng + '[canChi]' + temp.canChi);
                        if (temp.canHu) {
                            exports.hu(temp.userId);
                        } else if (temp.canGang) {
                            exports.guo(temp.userId, true);
                        } else if (temp.canPeng) {
                            exports.peng(temp.userId);
                        } else if (temp.canChi) {
                            exports.guo(temp.userId, true);
                        }
                    }
                } else {
                    var turnSeat = game.gameSeats[game.turn];
                    var seatData = gameSeatsOfUsers[turnSeat.userId];
                    if (!seatData) {
                        console.error('[CHECKBUG]---seatData.isAutoPlay is null---[userid]:', turnSeat.userId);
                        return;
                    }
                    seatData.isAutoPlay = true;

                    userMgr.broacastInRoom('set_autoplay_push', {
                        userid: turnSeat.userId,
                    }, room, turnSeat.userId, true);

                    userMgr.broacastInRoom('user_autoplay_push', {
                        userid: turnSeat.userId,
                        isAutoPlay: true,
                    }, room, turnSeat.userId, true);

                    exports.chuPai(seatData.userId, seatData.holds[seatData.holds.length - 1]);
                }
            }
        } else {
            tuoguanRoomList.splice(i, 1);
        }
    }
}

setInterval(update, 1000);

