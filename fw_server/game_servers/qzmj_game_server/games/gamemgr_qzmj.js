var roomMgr = require("../roommgr");
var userMgr = (require('../../../externals/game_utils/usermgr')).getUserMgr('qzmj');
var mjutils = require('./laizimjutils');
var db = require("../../../externals/utils/dbsync");
var crypto = require("../../../externals/utils/crypto");
var games = {};
var gamesIdBase = 0;

var ACTION_CHUPAI = 1;
var ACTION_MOPAI = 2;
var ACTION_PENG = 3;
var ACTION_AN_GANG = 4;
var ACTION_HU = 5;
var ACTION_ZIMO = 6;
var ACTION_BUHUA = 7;
var ACTION_CHI = 8;
var ACTION_DIAN_GANG = 9;
var ACTION_WAN_GANG = 10;

var gameSeatsOfUsers = {};

var userIdLocation = {};//gps

function getMJType(id){
    if(id >= 0 && id < 9){
        //筒
        return 0;
    }
    else if(id >= 9 && id < 18){
        //条
        return 1;
    }
    else if(id >= 18 && id < 27){
        //万
        return 2;
    }
    else if(id >=27){
        return 3;
    }
}

function shuffle(game) {
    
    var mahjongs = game.mahjongs;
    
    //筒 (0 ~ 8 表示筒子
    var index = 0;
    for(var i = 0; i < 9; ++i){
        for(var c = 0; c < 4; ++c){
            mahjongs[index] = i;
            index++;
        }
    }

    //条 9 ~ 17表示条子
    for(var i = 9; i < 18; ++i){
        for(var c = 0; c < 4; ++c){
            mahjongs[index] = i;
            index++;
        }
    }

    //万
    //条 18 ~ 26表示万
    for(var i = 18; i < 27; ++i){
        for(var c = 0; c < 4; ++c){
            mahjongs[index] = i;
            index++;
        }
    }
    
    //东南西北中发白
    for(var i = 27; i < 34; ++i){
        for(var c = 0; c < 4; ++c){
            mahjongs[index] = i;
            index++;
        }
    }

    //春夏秋冬梅兰竹菊
    for(var i = 34; i < 42; ++i){
        mahjongs[index] = i;
        index++;
    }

    // for(var i = 0; i < mahjongs.length; ++i){
    //     var lastIndex = mahjongs.length - 1 - i;
    //     var index = Math.floor(Math.random() * lastIndex);
    //     var t = mahjongs[index];
    //     mahjongs[index] = mahjongs[lastIndex];
    //     mahjongs[lastIndex] = t;
    // }

    //---新增---测试碰杠用-------------------------------
    var fapai = [0,4,7,11,0,4,7,11,0,4,7,11,0,1,8,12,2,5,8,12,2,5,8,12,2,5,9,13,2,6,9,13,1,6,9,13,1,6,11,14,1,7,12,14,4,8,13,14,5,9,14,15,6];

    var num = mahjongs.length;
    for (var i = 0; i < fapai.length; i++) {
        var t = mahjongs[i];
        mahjongs[i] = fapai[i]
        for (var j = i + 1; j < num; j++) {
            if (mahjongs[i] == mahjongs[j]) {
                mahjongs[j] = t;
                break;
            }
        }
    }
    //--end------------------------------------------------

    //在筒条万牌里翻出一张作为百搭牌
    var jing = Math.floor(Math.random()*34);
    game.jings = [jing];
    game.jingMap[jing] = true;
    //移除金牌。
    var index = mahjongs.indexOf(jing);
    if(index != -1){
        mahjongs.splice(index,1);
    }
}

function getRemainningCount(game){
    if(game.forceEndPai){
        return game.forceEndPai - game.currentIndex;
    }
    var numOfCnt = game.mahjongs.length - game.currentIndex - 18;
    if(numOfCnt < 0){
        numOfCnt = 0;
    }
    return numOfCnt;
}

function bupai(game,seatIndex) {
    var data = game.gameSeats[seatIndex];
    var mahjongs = data.holds;
    var pai = game.mahjongs[game.lastIndex];
    game.lastIndex--;
    mahjongs.push(pai);

    //统计牌的数目 ，用于快速判定（空间换时间）
    var c = data.countMap[pai];
    if(c == null) {
        c = 0;
    }
    data.countMap[pai] = c + 1;
    return pai;
}

function mopai(game,seatIndex) {
    if(getRemainningCount(game) <= 0){
        return -1;
    }
    var data = game.gameSeats[seatIndex];
    var mahjongs = data.holds;
    var pai = game.mahjongs[game.currentIndex];
    mahjongs.push(pai);

    //统计牌的数目 ，用于快速判定（空间换时间）
    var c = data.countMap[pai];
    if(c == null) {
        c = 0;
    }
    data.countMap[pai] = c + 1;
    game.currentIndex ++;
    return pai;
}

function isHua(game,pai){
    //如果是东南西北中发白，春夏秋冬，梅兰竹菊，则要补花
    if(pai >= 34){
        return true;
    }
    return false;
}

function buhua(game,seatData,pai){
    //移除花牌
    var index = seatData.holds.indexOf(pai);
    seatData.holds.splice(index,1);
    seatData.countMap[pai]--;
    //把花记录下来
    if(!seatData.huaMap[pai]){
        seatData.huaMap[pai] = 1;
    }
    else{
        seatData.huaMap[pai] ++;
    }
}

function deal(game){
    //当前摸牌位
    game.currentIndex = 0;
    //当前补牌位
    game.lastIndex = game.mahjongs.length - 1;

    //摸牌。
    var seatIndex = game.button;
    while(true){
        var sd = game.gameSeats[seatIndex];
        var holds = sd.holds;
        if(holds == null){
            holds = [];
            sd.holds = holds;
        }
        mopai(game,seatIndex);
        seatIndex ++;
        seatIndex %= game.gameSeats.length;
        //摸齐17张，表示庄家摸完了。摸牌结束
        if(sd.holds.length == 17){
            break;
        }
    }
    //当前轮设置为庄家
    game.turn = game.button;
}

//检查是否可以碰
function checkCanPeng(game,seatData,targetPai) {
    if(getMJType(targetPai) == seatData.que){
        return;
    }

    if(game.jingMap[targetPai]){
        return;
    }

    //2游不能碰
    if(game.isShuangYou){
        return;
    }

    //3游不能碰
    if(game.isSanYou){
        return;
    }

    var count = seatData.countMap[targetPai];
    if(count != null && count >= 2){
        seatData.canPeng = true;
    }
}

//检查是否可以吃
function checkCanChi(game,seatData,targetPai) {

    //检查玩家手上的牌
    seatData.canChi = false;

    if(game.conf.bukechibukepinghu){
        return;
    }

    //2游不能吃
    if(game.isShuangYou){
        return;
    }

    //3游不能吃
    if(game.isSanYou){
        return;
    }

    var fnCheckValid = function(pai){
        if( !game.jingMap[pai] && seatData.countMap[pai] > 0 ){
            return true;
        }
        return false;
    }

    //如果是筒条万，则检查A-2,A-1,A | A-1,A,A+1 | A,A+1,A+2
    var isNumeric = targetPai >= 0 && targetPai <= 26;
    if(isNumeric){
        var t = targetPai % 9;
        if( t > 1 ){
            if(fnCheckValid(targetPai - 2) > 0
            && fnCheckValid(targetPai - 1) > 0){
                seatData.canChi = true;
                return;
            }
        }
        
        if( t > 0 && t < 8 ){
            if(fnCheckValid(targetPai - 1) > 0
            && fnCheckValid(targetPai + 1) > 0){
                seatData.canChi = true;
                return;
            }
        }
        
        if( t < 7 ){
            if(fnCheckValid(targetPai + 1) > 0
            && fnCheckValid(targetPai + 2) > 0){
                seatData.canChi = true;
                return;
            }
        }
    }
}

//检查是否可以点杠
function checkCanDianGang(game,seatData,targetPai){
    //检查玩家手上的牌
    //如果没有牌了，则不能再杠
    if(getRemainningCount(game) <= 0){
        return;
    }
    if(getMJType(targetPai) == seatData.que){
        return;
    }

    //光游模式下，游金不能杠牌
    // if(game.conf.youjing == 1 && seatData.isJingDiao){
    //     return;
    // }
    
    if(game.jingMap[targetPai]){
        return;
    }

    var count = seatData.countMap[targetPai];
    if(count != null && count >= 3){
        seatData.canGang = true;
        seatData.gangPai.push(targetPai);
        return;
    }
}

//检查是否可以暗杠
function checkCanAnGang(game,seatData){
    //如果没有牌了，则不能再杠
    if(getRemainningCount(game) <= 0){
        return;
    }
    
    //光游模式下，游金不能杠牌
    // if(game.conf.youjing == 1 && seatData.isJingDiao){
    //     return;
    // }
    
    for(var key in seatData.countMap){
        var pai = parseInt(key);
        if(game.jingMap[pai]){
            continue;
        }
        if(getMJType(pai) != seatData.que){
            var c = seatData.countMap[key];
            if(c != null && c == 4){
                seatData.canGang = true;
                seatData.gangPai.push(pai);
            }
        }
    }
}

//检查是否可以弯杠(自己摸起来的时候)
function checkCanWanGang(game,seatData){
    //如果没有牌了，则不能再杠
    if(getRemainningCount(game) <= 0){
        return;
    }

    //
    var canGuosSouGang = false;
    if (!canGuosSouGang) {
        for (var i = 0; i < seatData.holds.length; i++) {
            var pai = seatData.holds[i];
            if (seatData.pengs.indexOf(pai) != -1) {
                seatData.canGang = true;
                seatData.gangPai.push(pai);
            }
        }
    }
    else{
        for(var i = 0; i < seatData.pengs.length; ++i){
            var pai = seatData.pengs[i];
            if(seatData.countMap[pai] == 1){
                seatData.canGang = true;
                seatData.gangPai.push(pai);
            }
        }
    }
}

function checkCanHu(game,seatData,targetPai) {
    game.lastHuPaiSeat = -1;
    seatData.canHu = false;
    seatData.tingInfo = null;
    //双游或者三游，不能点炮胡。
    if(targetPai != null){
        if(game.conf.bukechibukepinghu){
            return;
        }
        if(seatData.isJingDiao){ //游金不能平胡
            return;
        }

        if(game.isShuangYou || game.isSanYou){ //双游 三游不能平胡
            return;
        }

        for(let k in game.jingMap){//如果手上有双金 不能平胡
            for(let n in seatData.countMap){
                if(k == n){
                    if(seatData.countMap[n]==2){
                        console.log("手牌有双金 不可以平胡哟");
                        return;
                    }
                }
            }
        }
        
        let numOfMJ = getRemainningCount(game);
        if(4 >= numOfMJ){//提示最后一圈 不可以平胡哟 
            return;
        }  
        
        seatData.holds.push(targetPai);
        if(seatData.countMap[targetPai]){
            seatData.countMap[targetPai]++;
        }
        else{
            seatData.countMap[targetPai] = 1;
        }
    }

    if(game.isSanYou){ //三游不能普通自摸 自能杠上自摸
        if (!seatData.iSsanyou){//如果是自己三游不需要杠上自摸
            if (game.GangShanghu) { //杠上自摸
                console.log("三游 杠上自摸哟");
            } else {
                console.log("三游 只能杠上自摸哟");
                return;
            }
        }
    }

    //如果手上3个百搭，则算三金倒
    var pattern = null;
    //if(targetPai == null){
        var jingCnt = 0;
        for(var k in game.jings){
            var pai = game.jings[k];
            var cnt = seatData.countMap[pai]; 
            if(cnt){
                jingCnt = cnt;
            }
        }
        if(jingCnt == 3){
            pattern = '3jingdao';
            seatData.iSsanjindao = true; //能胡三金倒
        }
    //}
    if(!pattern){
        pattern = mjutils.checkCanHu(game.jingMap,seatData,targetPai);
    }

    if(pattern != null){
        seatData.canHu = true;
        seatData.tingInfo = {
            pattern:pattern,
            fan:0,
            pai:targetPai,   
        }
    }
    
    if(targetPai != null){
        seatData.holds.pop();
        seatData.countMap[targetPai]--;
    }
}

function clearAllOptions(game,seatData){
    var fnClear = function(sd){
        sd.canPeng = false;
        sd.canGang = false;
        sd.canChi = false;
        sd.gangPai = [];
        sd.canHu = false;
        sd.noGuo = false;
        sd.lastFangGangSeat = -1;    
    }
    if(seatData){
        fnClear(seatData);
    }
    else{
        game.qiangGangContext = null;
        for(var i = 0; i < game.gameSeats.length; ++i){
            fnClear(game.gameSeats[i]);
        }
    }
}

function getSeatIndex(userId){
    var seatIndex = roomMgr.getUserSeat(userId);
    if(seatIndex == null){
        return null;
    }
    return seatIndex;
}

function getGameByUserID(userId){
    var roomId = roomMgr.getUserRoom(userId);
    if(roomId == null){
        return null;
    }
    var game = games[roomId];
    return game;
}

function hasOperations(seatData){
    if(seatData.canGang || seatData.canPeng || seatData.canHu || seatData.canChi){
        return true;
    }
    return false;
}

function sendOperations(game,seatData,pai) {
    if(hasOperations(seatData)){
        if(pai == -1){
            pai = seatData.holds[seatData.holds.length - 1]; //抢杠胡 这里 玩家重新 连接网络 会有问题 
        }
        
        var data = {
            pai:pai,
            hu:seatData.canHu,
            peng:seatData.canPeng,
            gang:seatData.canGang,
            gangpai:seatData.gangPai,
            chi:seatData.canChi,
            noguo:seatData.noGuo,
            iSyoujing:seatData.iSyoujing,//能胡 游金
            iSshuangyou:seatData.iSshuangyou,//能胡 双游
            iSsanyou:seatData.iSsanyou,//能胡 三游
            iSsanjindao:seatData.iSsanjindao,//能胡 三金倒
        };
        //如果可以有操作，则进行操作
        userMgr.sendMsg(seatData.userId,'game_action_push',data);

        data.si = seatData.seatIndex;
    }
    else{
        userMgr.sendMsg(seatData.userId,'game_action_push');
    }
}

function moveToNextUser(game,nextSeat){
    //找到下一个没有和牌的玩家
    if(nextSeat == null){
        while(true){
            game.turn ++;
            game.turn %= game.gameSeats.length;
            var turnSeat = game.gameSeats[game.turn];
            if(turnSeat.hued == false){
                return;
            }
        }
    }
    else{
        game.turn = nextSeat;
    }
}

function doUserMoPai(game,lastFangGangSeat,isBuPai){
    if(lastFangGangSeat == null){
        lastFangGangSeat = -1;
    }
    game.chuPai = -1;
    var turnSeat = game.gameSeats[game.turn];
    turnSeat.lastFangGangSeat = lastFangGangSeat;
    turnSeat.guoHuFan = -1;
    var pai = -1;
    if(!isBuPai){
        pai = mopai(game,game.turn);
    }
    else{
        pai = bupai(game,game.turn);
    }

    var roomId = roomMgr.getUserRoom(turnSeat.userId);
    var room = roomMgr.getRoom(roomId);
    roomMgr.dissolveAgreedf(roomId);//清空不出牌5分钟就解散房间
    roomMgr.dissolveRequestdf(roomId);//不出牌5分钟就解散房间
    
    //牌摸完了，结束
    if(pai == -1){
        doGameOver(game.roomInfo);
        return;
    }
    else{
        var numOfMJ = getRemainningCount(game);
        userMgr.broacastInRoom('mj_count_push', numOfMJ, room, turnSeat.userId, true);
    }
    
    //补花
    if(isHua(game,pai)){
        buhua(game,turnSeat,pai);
        recordGameAction(game,game.turn,ACTION_BUHUA,pai);
        userMgr.broacastInRoom('game_newhua_push', { si: turnSeat.seatIndex, pai: pai }, room, turnSeat.userId, true);
        doUserMoPai(game);
        return;
    }

    recordGameAction(game,game.turn,ACTION_MOPAI,pai);

    //通知前端新摸的牌
    userMgr.sendMsg(turnSeat.userId,'game_mopai_push',{si:turnSeat.seatIndex,pai:pai});
    //检查是否可以暗杠或者胡
    //检查胡，直杠，弯杠
    checkCanAnGang(game,turnSeat);
    checkCanWanGang(game,turnSeat,pai);

    //检查看是否可以和
    checkCanHu(game,turnSeat);

    //广播通知玩家出牌方
    turnSeat.canChuPai = true;
    userMgr.broacastInRoom('game_turn_changed_push', turnSeat.seatIndex, room, turnSeat.userId, true);

    //通知玩家做对应操作
    sendOperations(game,turnSeat,game.chuPai);

    //游金状态下
    //如果是光游，则必须胡
    //如果是暗游，游到金牌可以打出，形成双游，三游。 游到非金牌，直接胡

    turnSeat.noGuo = false;
    //通知玩家做对应操作
    sendOperations(game,turnSeat,game.chuPai);
}

function computeFanScore(game,fan){
    if(fan > game.conf.maxFan){
        fan = game.conf.maxFan;
    }
    if(fan == 0){
        return 2;
    }
    return (1 << fan) * game.conf.baseScore * 6;
}


//计算盘数
function computePan(game,sd){
    var difan = 5;
    var roomInfo = game.roomInfo;
    if(!roomInfo.lianzhuang){
        roomInfo.lianzhuang = 1;
    }
    if(sd.seatIndex == game.button){
        difan += (roomInfo.lianzhuang) * 5;
    }

    sd.difan = difan;

    var shui = 0;
    //暗杠*3，直杠*2，补杠*1
    shui += sd.angangs.length*3 + sd.diangangs.length * 2 + sd.wangangs.length;

    for(let i=0;i<sd.wangangs.length;i++){ //如果是弯杠检查 是否有风牌,有风牌多加 1盘
        if(sd.wangangs[i]>=27){
            shui += 1
        }
    }

    //每个花+1
    shui += sd.numOfHua;
    
    sd.numJing = 0;
    for(var k in game.jings){
        var pai = game.jings[k];
        if(sd.countMap[pai]){
            sd.numJing += sd.countMap[pai];
        }
    }

    //每个金+1
    shui += sd.numJing;

    //每一碰字牌，加1盘
    sd.zipai = 0;
    for(var i = 0; i < sd.pengs.length; ++i){
        var pai = sd.pengs[i];
        if(getMJType(pai) == 3){
            sd.zipai++;
        }
    }
    shui += sd.zipai;
    //TO DO
    //手上的刻子
    sd.kezi = 0;
    if (!sd.iSsanjindao) {//如果是三金倒,不算刻字不加盘
        for (var k in sd.countMap) {
            if (sd.countMap[k] >= 3) {
                sd.kezi++;
            }
        }
    }

    shui += sd.kezi;
    

    //胡牌玩家，盘要加底
    if(sd.hued){
        shui += sd.difan;
    }
    
    sd.totalPan = shui;
}

function initlianzhuang(game){ //流局连庄
    for (var i = 0; i < game.gameSeats.length; ++i) {
        var sd = game.gameSeats[i];
        var difan = 5;
        var roomInfo = game.roomInfo;
        if (!roomInfo.lianzhuang) {
            roomInfo.lianzhuang = 1;
        }
        if (sd.seatIndex == game.button) {
            difan += (roomInfo.lianzhuang) * 5;
        }
        sd.difan = difan;
    }
}

function calculateResult(game,roomInfo){
    //找出胡牌的那家，然后统计胡牌的玩家应得的子
    var baseScore = game.conf.baseScore;
    
    for(var i = 0; i < game.gameSeats.length; ++i){
        var sd = game.gameSeats[i];
        
        //统计杠的数目
        sd.numAnGang = sd.angangs.length;
        sd.numMingGang = sd.wangangs.length + sd.diangangs.length;

        //算花
        sd.numOfHua = 0;
        for(var k in sd.huaMap){
            var num = sd.huaMap[k];
            sd.numOfHua += num;
        }
        sd.numChaJiao += sd.numOfHua;

        //统计所有玩家的盘数。
        computePan(game,sd);
    }

    //未胡牌的玩家，向其他玩家PK盘
    for(var i = 0; i < game.gameSeats.length; ++i){
        var sd = game.gameSeats[i];
        if(!sd.hued){
            for(var j = 0; j < game.gameSeats.length; ++j){
                var td = game.gameSeats[j];
                if(!td.hued){
                    var diff = sd.totalPan - td.totalPan;
                    if(diff > 0){
                        //如果选择的是1课，则需要做特殊处理
                        if(game.roomInfo.conf.maxGames == -1){
                            var rtd = game.roomInfo.seats[td.seatIndex];
                            if((rtd.score + td.score - diff) < 0){
                                diff = rtd.score + td.score;
                            }
                        }
                        sd.score += diff;
                        td.score -= diff;
                    }
                }
            }        
        }
    }

    for(var i = 0; i < game.gameSeats.length; ++i){
        var sd = game.gameSeats[i];
        //对所有胡牌的玩家进行统计
        if(sd.hued){
            var fan = sd.fan;
            var additonalscore = 0;
            for(var a = 0; a < sd.actions.length; ++a){
                var ac = sd.actions[a];
                if(ac.type == "zimo" || ac.type == "hu" || ac.type == "ganghua" || ac.type == "dianganghua" || ac.type == "gangpaohu" || ac.type == "qiangganghu"){
                    // if(ac.iszimo){
                    //     sd.numZiMo ++;
                    // }
                    // else{
                    //     sd.numJiePao ++;
                    // }

                    var factor = 1;

                    if(sd.isSanYou){ //三游
                        sd.numSanYou++;
                        factor = 16;
                    }
                    else if(sd.isShuangYou){//双游
                        sd.numShuangYou++;
                        factor = 8;
                    }
                    else if(sd.isJingDiao){//游金
                        sd.numYouJin++;
                        if(game.conf.youjing == 1){
                            factor = 4;
                        }
                        else{
                            factor = 3;
                        }
                    }
                    else if(sd.isTianHu||sd.pattern == '3jingdao'){//天胡==三金倒
                        sd.numTianHu++;
                        sd.numSanJinDao++; 
                        factor = 3;
                    }
                    // else if(sd.pattern == '3jingdao'){//三金倒
                    //     sd.numSanJinDao++; 
                    //     factor = 3;
                    // }
                    else if(sd.iszimo){ //自摸
                        sd.numZiMo ++;
                        factor = 2;
                    }else{
                         sd.numJiePao ++; //平胡
                     }

                    //杠上花翻倍
                    if(ac.type == 'dianganghua' || ac.type == 'ganghua'){
                        //score *= 2;
                    }
                    
                    sd.totalPan *= factor;
                    for(var t = 0; t < game.gameSeats.length; ++t){
                        var td = game.gameSeats[t];
                        if(td != sd){
                            var score = sd.totalPan;

                            //如果被胡牌者的底分比胡牌者大，则需要多出钱
                            var diff = td.difan - sd.difan;
                            if(diff > 0){
                                score += diff * factor;
                            }
                            //如果选择的是1课，则需要做特殊处理
                            if(game.roomInfo.conf.maxGames == -1){
                                var rtd = game.roomInfo.seats[td.seatIndex];
                                console.log("======1课======1","(1)"+rtd.score+"(2)"+td.score+"(3)"+score+"(4id)"+td.seatIndex+"(5userid)"+td.userId);
                                if((rtd.score+td.score - score) < 0){
                                    score = rtd.score + td.score;
                                }
                            }
                            td.score -= score;
                            sd.score += score;
                            console.log("======1课======2","(1)"+td.score);
                        }
                    }
                }
            }
        }
    }
}

function doGameOver(roomInfo,forceEnd){
    var roomId = roomInfo.id;
    roomMgr.onRoomEnd(roomInfo,forceEnd);

    var game = roomInfo.game;

    roomInfo.game = null;

    var results = [];
    var dbresult = [0,0,0,0];

    if(game != null){
        roomMgr.dissolveAgreedf(roomId);//清空不出牌5分钟就解散房间
        //如果不是主动解散，并且有人胡牌，才进行分数统计。 否则就是平局
        if(!forceEnd){
            if(game.firstHupai >= 0){
                calculateResult(game,roomInfo);
            }else{
                initlianzhuang(game);//流局连庄
            }
        }
        for(var i = 0; i < roomInfo.seats.length; ++i){
            var rs = roomInfo.seats[i];
            var sd = game.gameSeats[i];

            if(sd.score > 0){
                //db.add_win_record(sd.userId);
                //db.add_user_coins(sd.userId,sd.score);
            }

            rs.ready = false;
            rs.score += sd.score;
            
            rs.numZiMo += sd.numZiMo;//自摸
            rs.numJiePao += sd.numJiePao;//平胡
            rs.numDianPao += sd.numDianPao;
            rs.numAnGang += sd.numAnGang;
            rs.numMingGang += sd.numMingGang;
            rs.numChaJiao += sd.numChaJiao;
            rs.numYouJin += sd.numYouJin; //游金次数
            rs.numShuangYou += sd.numShuangYou;//双游次数
            rs.numSanYou += sd.numSanYou;//三游次数
            rs.numSanJinDao += sd.numSanJinDao;//三金倒次数
            rs.numTianHu += sd.numTianHu;//天胡


            var userRT = {
                userId:sd.userId,
                actions:sd.actions,
                pengs:sd.pengs,
                chis:sd.chis,
                wangangs:sd.wangangs,
                diangangs:sd.diangangs,
                angangs:sd.angangs,
                holds:sd.holds,
                score:sd.score,
                totalscore:rs.score,
                tianhu:sd.isTianHu,
                jingdiao:sd.isJingDiao,
                shuangyou:sd.isShuangYou,
                sanyou:sd.isSanYou,
                pattern:sd.pattern,
                numhua:sd.numOfHua,
                numjing:sd.numJing,
                difan:sd.difan,
                totalpan:sd.totalPan,
                kezi:sd.kezi,
                zipai:sd.zipai,
            };
            
            for(var k in sd.actions){
                userRT.actions[k] = {
                    type:sd.actions[k].type,
                };
            }
            results.push(userRT);


            dbresult[i] = sd.score;
            delete gameSeatsOfUsers[sd.userId];
        }
        delete games[roomId];
        
        var old = roomInfo.nextButton;
        //流庄之后,如果是4人按顺序下家拿庄。
        if(game.firstHupai >= 0){
            if(roomInfo.conf.numPeople == 2){ //如果是2人,谁赢谁拿庄
                roomInfo.nextButton = game.firstHupai;
            }else if(game.firstHupai !=roomInfo.nextButton){//否则按顺序拿庄
                if(roomInfo.nextButton<3){
                    roomInfo.nextButton++;
                }else{
                    roomInfo.nextButton = 0;
                }  
            }
        }

        if(old != roomInfo.nextButton){
            db.update_next_button(roomInfo.gametype, roomInfo.gamemode, roomId, roomInfo.nextButton);
            roomInfo.lianzhuang = 1;
        }
        else{
            if(!roomInfo.lianzhuang){
                roomInfo.lianzhuang = 1;
            }
            roomInfo.lianzhuang ++;
        }
    }
    
    var isEnd = forceEnd;

    if(!forceEnd && game){
        //保存游戏
        store_game(game);
        db.update_game_result(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid,game.gameIndex,dbresult);
        roomMgr.updateScores(roomId);
        //记录打牌信息
        var str = JSON.stringify(game.actionList);
        db.update_game_action_records(roomInfo.gametype, roomInfo.gamemode, roomInfo.uuid,game.gameIndex,str);
    
        //保存游戏局数
        db.update_num_of_turns(roomInfo.gametype, roomInfo.gamemode, roomId,roomInfo.numOfGames);

        var isEnd = (roomInfo.numOfGames >= roomInfo.conf.maxGames);
        if(roomInfo.conf.maxGames == -1){
            isEnd = false;
            for(var i = 0; i < roomInfo.seats.length; ++i){
                var rs = roomInfo.seats[i];
                if(rs.score <= 0){
                    isEnd = true;
                    break;
                }
            }
        }
    }

    var endinfo = null;
    if (isEnd) {
        endinfo = [];
        for (var i = 0; i < roomInfo.seats.length; ++i) {
            var rs = roomInfo.seats[i];
            endinfo.push({
                numzimo: rs.numZiMo,//自摸
                numjiepao: rs.numJiePao,//平胡
                numdianpao: rs.numDianPao,
                numangang: rs.numAnGang,
                numminggang: rs.numMingGang,
                numchadajiao: rs.numChaJiao,
                numYouJin: rs.numYouJin, //游金次数
                numShuangYou: rs.numShuangYou,//双游次数
                numSanYou: rs.numSanYou,//三游次数
                numSanJinDao: rs.numSanJinDao,//三金倒次数
                numTianHu: rs.numTianHu,//天胡
            });
        }
    }

    var userId = roomInfo.seats[0].userId;
    var isHuangZhuang = false;
    if(game && !forceEnd){
        isHuangZhuang = game.firstHupai == -1;
    }
    userMgr.broacastInRoom('game_over_push', { results: results, endinfo: endinfo, huang_zhuang:isHuangZhuang }, roomInfo, userId, true);
    //如果局数已够，则进行整体结算，并关闭房间
    if(isEnd){
        roomInfo.lianzhuang = 1;//游戏结束 连庄清0
        roomInfo.destroy = true;
        if(roomInfo.numOfGames > 1){
            store_history(roomInfo);
        }
        roomMgr.closeRoom(roomId,forceEnd);
    }
}

function recordUserAction(game,seatData,type,target){
    var d = {type:type,targets:[]};
    if(target != null){
        if(typeof(target) == 'number'){
            d.targets.push(target);    
        }
        else{
            d.targets = target;
        }
    }
    else{
        for(var i = 0; i < game.gameSeats.length; ++i){
            var s = game.gameSeats[i];
            if(i != seatData.seatIndex && s.hued == false){
                d.targets.push(i);
            }
        }        
    }

    seatData.actions.push(d);
    return d;
}

function recordGameAction(game,si,action,pai,p1,p2){
    game.actionList.push(si);
    game.actionList.push(action);
    if(pai != null){
        game.actionList.push(pai);
    }
    if(p1 != null){
        game.actionList.push(p1);
    }
    if(p2 != null){
        game.actionList.push(p2);
    }
}

function getYouJingState(game){
    if(game.isSanYou){
        return 'sanyou';
    }
    else if(game.isShuangYou){
        return 'shuangyou';
    }
    return '';
}

exports.sync = function(userId){
    var roomId = roomMgr.getUserRoom(userId);
    if(roomId == null){
        return;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return;
    }

    var game = roomInfo.game;

    var numOfMJ = game.mahjongs.length - game.currentIndex;
    var remainingGames = roomInfo.conf.maxGames - roomInfo.numOfGames;

    var data = {
        state:game.state,
        numofmj:numOfMJ,
        button:game.button,//庄家
        lianzhuang:game.roomInfo.lianzhuang,//连庄
        turn:game.turn,
        chuPai:game.chuPai,
        huanpaimethod:game.huanpaiMethod,
        jings:game.jings,
        lastChuPaiTurn:game.lastChuPaiTurn,//重新连接 发送最后出的牌
    };

    data.youjingstate = getYouJingState(game);

    data.seats = [];
    var seatData = null;
    for(var i = 0; i < game.gameSeats.length; ++i){
        var sd = game.gameSeats[i];

        var s = {
            userid:sd.userId,
            folds:sd.folds,
            chis:sd.chis,
            angangs:sd.angangs,
            diangangs:sd.diangangs,
            wangangs:sd.wangangs,
            pengs:sd.pengs,
            que:sd.que,
            hued:sd.hued,
            iszimo:sd.iszimo,
            hupai:sd.hupai,
            huamap:sd.huaMap,
            danyou:sd.isJingDiao,
            iSyoujing: sd.iSyoujing,//是否已游金
            iSshuangyou: sd.iSshuangyou,//是否已双游
            iSsanyou: sd.iSsanyou,//是否已三游
        }

        if(sd.userId == userId){
            s.holds = sd.holds;
            seatData = sd;
        }
        data.seats.push(s);
    }

    //同步整个信息给客户端
    userMgr.sendMsg(userId,'game_sync_push',data);
    sendOperations(game,seatData,game.chuPai);
}

function store_history(room) {
    var seats = room.seats;

    for (var i = 0; i < seats.length; ++i) {
        var seat = seats[i];
        db.create_user_history(room.gametype, room.gamemode, seat.userId, room.uuid);
    }
}

function construct_game_base_info(game){
    var baseInfo = {
        type:game.conf.type,
        button:game.button,
        lianzhuang:game.roomInfo.lianzhuang,
        index:game.gameIndex,
        mahjongs:game.mahjongs,
        jings:game.jings,
        game_seats:[],
        game_huas:[],
    }
    
    for(var i = 0; i < game.gameSeats.length; ++i){
        baseInfo.game_seats[i] = game.gameSeats[i].holds;
        baseInfo.game_huas[i] = game.gameSeats[i].huaMap;
    }
    game.baseInfoJson = JSON.stringify(baseInfo);
}

function store_game(game) {
    var ret = db.create_game(game.roomInfo.gametype, game.roomInfo.gamemode, game.roomInfo.uuid, game.gameIndex, game.baseInfoJson);
    return ret;
}

//开始新的一局
exports.begin = function(roomId) {
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo == null){
        return;
    }
    var seats = roomInfo.seats;

    var game = {
        conf:roomInfo.conf,
        roomInfo:roomInfo,
        gameIndex:roomInfo.numOfGames,

        button:roomInfo.nextButton,
        mahjongs:[],
        currentIndex:0,
        gameSeats:[],

        numOfQue:0,
        turn:0,
        chuPai:-1,
        state:"idle",
        firstHupai:-1,
        actionList:[],
        chupaiCnt:0,
        jingMap:{},
        lastChuPaiTurn:-1,
        GangShanghu:false,
        isShuangYou:false,
        isSanYou:false,
    };

    //如果是AA,并且是第一局，则随机决定庄家
    if(game.conf.aa && !roomInfo.numOfGames){
        game.button = Math.floor(Math.random()*roomInfo.conf.numPeople);
    }

    roomInfo.numOfGames++;
    roomInfo.game = game;
    for(var i = 0; i < roomInfo.conf.numPeople; ++i){
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
        //点杠的牌
        data.diangangs = [];
        //弯杠的牌
        data.wangangs = [];
        //碰了的牌
        data.pengs = [];
        //
        data.chis = [];
        //缺一门
        data.que = -1;

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

        //是否已游金
        data.iSyoujing = false;
        //是否已双游
        data.iSshuangyou = false;
        //是否已三游
        data.iSsanyou = false;
        //是否能三金倒胡
        data.iSsanjindao = false;

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
        data.lastFangGangSeat = -1;
        
        //统计信息
        data.numZiMo = 0;
        data.numJiePao = 0; //平胡
        data.numDianPao = 0;
        data.numAnGang = 0;
        data.numMingGang = 0;
        data.numChaJiao = 0;
        data.numYouJin = 0; //游金次数
        data.numShuangYou = 0;//双游次数
        data.numSanYou = 0;//三游次数
        data.numSanJinDao = 0;//三金倒次数
        data.numTianHu = 0;//天胡

        data.huaMap = {};

        gameSeatsOfUsers[data.userId] = data;
    }
    games[roomId] = game;
    //洗牌
    shuffle(game);
    //发牌
    deal(game);
    

    var numOfMJ = getRemainningCount(game);
    var huansanzhang = roomInfo.conf.hsz;

    if(game.roomInfo.lianzhuang==undefined||game.roomInfo.lianzhuang==null){//连庄
        game.roomInfo.lianzhuang = 1;
    }
    for(var i = 0; i < seats.length; ++i){
        //开局时，通知前端必要的数据
        var s = seats[i];
        //通知玩家手牌
        userMgr.sendMsg(s.userId,'game_holds_push',{
            si:i,
            holds:game.gameSeats[i].holds
        });
        //通知还剩多少张牌
        userMgr.sendMsg(s.userId,'mj_count_push',numOfMJ);
        //通知还剩多少局
        userMgr.sendMsg(s.userId,'game_num_push',roomInfo.numOfGames);
        //通知游戏开始 庄家-连庄状态
        userMgr.sendMsg(s.userId,'game_begin_push',{button:game.button,lianzhuang:game.roomInfo.lianzhuang});
    }

    start(game);
};

function start(game){        
    game.state = 'playing';
    var turnSeat = game.gameSeats[game.turn];

    var roomId = roomMgr.getUserRoom(turnSeat.userId);
    var room = roomMgr.getRoom(roomId);
    userMgr.broacastInRoom('game_state_changed_push', {state:'playing'}, room, turnSeat.userId, true);

    //等一秒 开金
    sleep(500);
    userMgr.broacastInRoom('game_jings_push', game.jings, room, turnSeat.userId, true);

    //等一秒 补花
    sleep(500);
    //补花
    for(var i = 0; i < game.gameSeats.length; ++i){
        var seatData = game.gameSeats[i];
        var huaCnt = 0;
        for(var j = seatData.holds.length - 1; j >= 0; --j){
            var pai = seatData.holds[j];
            if(isHua(game,pai)){
                buhua(game,seatData,pai);
                huaCnt++;
            }         
        }

        for(var j = 0; j < huaCnt; ++j){
            //如果是花，则需要补花
            var pai = mopai(game,seatData.seatIndex);
            while(isHua(game,pai)){
                buhua(game,seatData,pai);
                //摸新的一张牌
                pai = mopai(game,seatData.seatIndex);
            }
        }

        //通知房间里对应的玩家补花
        userMgr.broacastInRoom('game_buhua_push', { si: i, huamap: seatData.huaMap }, room, turnSeat.userId, true);

        if(huaCnt){
            //通知玩家手牌
            userMgr.sendMsg(seatData.userId,'game_holds_push',{
                si:i,
                holds:seatData.holds
            });
        }
    }

    var numOfMJ = getRemainningCount(game);
    userMgr.broacastInRoom('mj_count_push', numOfMJ, room, turnSeat.userId, true);

    construct_game_base_info(game);
    //等0.5秒
    sleep(500);
    
    //通知玩家出牌方
    turnSeat.canChuPai = true;
    userMgr.broacastInRoom('game_turn_changed_push', turnSeat.seatIndex, room, turnSeat.userId, true);
    //检查是否可以暗杠或者胡
    //直杠
    checkCanAnGang(game,turnSeat);
    //检查胡 用最后一张来检查
    checkCanHu(game,turnSeat);
    //通知前端
    sendOperations(game,turnSeat,game.chuPai);
}

exports.huanSanZhang = function(userId,p1,p2,p3,isMaipai){
};

exports.dingQue = function(userId,type){
};

exports.chuPai = function(userId,data){
    var pai = -1;
    var needYouJing = false;
    try{
        if(data == 'number'){
            pai = data;
        }
        else{
            var d = JSON.parse(data);
            pai = d.pai;
            needYouJing = d.yj;
        }
    }
    catch(e){
        return;
    }

    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }

    var game = seatData.game;
    var seatIndex = seatData.seatIndex;
    //如果不该他出，则忽略
    if(game.turn != seatData.seatIndex){
        console.log("not your turn.");
        return;
    }

    if(seatData.hued){
        console.log('you have already hued. no kidding plz.');
        return;
    }

    if(seatData.canChuPai == false){
        console.log('no need chupai.');
        return;
    }

    if(game.isYouJing){
        return;
    }

    if(hasOperations(seatData)){
        console.log('plz guo before you chupai.');
        return;
    }

    //从此人牌中扣除
    var index = seatData.holds.indexOf(pai);
    if(index == -1){
        console.log("holds:" + seatData.holds);
        console.log("can't find mj." + pai);
        return;
    }

    game.GangShanghu = false;//杠上自摸关闭

    game.lastChuPaiTurn = seatIndex;//记录最后出牌；

    var needYouJing = true;
    
    seatData.canChuPai = false;
    game.chupaiCnt ++;

    var isLastOne = seatData.holds[seatData.holds.length - 1] == pai;
    
    seatData.holds.splice(index,1);
    seatData.countMap[pai] --;
    game.chuPai = pai;
    recordGameAction(game,seatData.seatIndex,ACTION_CHUPAI,pai);

    var roomId = roomMgr.getUserRoom(seatData.userId);
    var room = roomMgr.getRoom(roomId);
    userMgr.broacastInRoom('game_chupai_notify_push', { si: seatData.seatIndex, pai: pai }, room, seatData.userId, true);
    
    //检查是否有人要胡，要碰 要杠
    var hasActions = false;

    var needCheck = !game.jingMap[pai];
    var lastState = seatData.isJingDiao;
    
    seatData.isJingDiao = false;
    if(needYouJing){
        seatData.isJingDiao = mjutils.isJingDiao(game.jingMap,seatData,false);
        //如果出了金牌，则需要判断双游，三游  （打出来的牌，是最后一张，并且还是金。 并且打完后还是金吊），
        if(seatData.isJingDiao){
            //如果之前不是游金状态，现在变成游金状态，则需要通知
            if(!lastState){//游金通知
                seatData.iSyoujing =true; //游金
                userMgr.sendMsg(seatData.userId,'game_danyou_push',seatData.seatIndex);
            }
            //游金状态下，再出金牌，则可能构成双游和三游
            else if(game.jingMap[pai]){
                //如果不是双游，则变成双游
                //如果是双游，则变成三游
                if(!game.isShuangYou){
                    seatData.iSshuangyou =true; //当前双游
                    game.isShuangYou = true;
                    seatData.isShuangYou = true;//游戏结算双游
                    userMgr.broacastInRoom('game_shuangyou_push', seatData.seatIndex, room, seatData.userId, true);
                }
                else{
                    seatData.iSsanyou =true; //当前三游
                    game.isSanYou = true;
                    seatData.isSanYou = true; //游戏结算三游
                    userMgr.broacastInRoom('game_sanyou_push', seatData.seatIndex, room, seatData.userId, true);
                }
                needCheck = false;
                userMgr.broacastInRoom('game_you_jing_state_push', { state: getYouJingState(game) }, room, seatData.userId, true);
            }
        }
        else{
            //如果之前处于双游或者三游的玩家，打出金牌后，处于非游金状态，强制清除标记。恢复到普通状态。
            if(!seatData.isJingDiao && (seatData.isSanYou || seatData.isShuangYou)){
                game.isShuangYou = false;
                game.isSanYou = false;
                seatData.isSanYou = false;
                seatData.isShuangYou = false;
                userMgr.broacastInRoom('game_you_jing_state_push', { state: getYouJingState(game) }, room, seatData.userId, true);
            }
        }
    }

    if(needCheck){
        for(var i = 0; i < game.gameSeats.length; ++i){
            //玩家自己不检查
            if(game.turn == i){
                continue;
            }
            var ddd = game.gameSeats[i];
            //已经和牌的不再检查
            if(ddd.hued){
                continue;
            }

            checkCanHu(game,ddd,pai,seatData.lastFangGangSeat != -1);
            if(true){
                if(ddd.canHu && ddd.guoHuFan >= 0 && ddd.tingInfo.fan <= ddd.guoHuFan){
                    console.log("ddd.guoHuFan:" + ddd.guoHuFan);
                    ddd.canHu = false;
                    userMgr.sendMsg(ddd.userId,'guohu_push');            
                }     
            }

            checkCanPeng(game,ddd,pai);
            checkCanDianGang(game,ddd,pai);

            //如果是下家，则检查是否可以吃
            if((i == (game.turn + 1)%game.gameSeats.length)){
                checkCanChi(game,ddd,pai);
            }

            if(hasOperations(ddd)){
                sendOperations(game,ddd,game.chuPai);
                hasActions = true;    
            }
        }
    }

    
    //如果没有人有操作，则向下一家发牌，并通知他出牌
    if(!hasActions){
        //sleep(500);
        userMgr.broacastInRoom('guo_notify_push', { si: seatData.seatIndex, pai: game.chuPai }, room, seatData.userId, true);
        seatData.folds.push(game.chuPai);
        game.chuPai = -1;
        moveToNextUser(game);
        doUserMoPai(game);
    }
};

exports.chi = function(userId,p1,p2){
    if(p1 == null || p2 == null){
        console.log("p1==null || p2==null");
        return;
    }

    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }

    var game = seatData.game;
    game.curActionData = null;

    //如果是他出的牌，则忽略
    if(game.turn == seatData.seatIndex){
        console.log("it's your turn.");
        return;
    }

    //如果没有吃的机会，则不能再碰
    if(seatData.canChi == false){
        console.log("seatData.chi == false");
        return;
    }

    //和的了，就不要再来了
    if(seatData.hued){
        console.log('you have already hued. no kidding plz.');
        return;
    }

    //检查3张牌是否有相同的
    if(p1 == p2 || p1 == game.chuPai || p2 == game.chuPai){
        //
        console.log("can't be same.");
        return;
    }

    //检查此玩家手牌是否足够
    if(!(seatData.countMap[p1] >= 1 && seatData.countMap[p2] >= 1)){
        console.log("lack of p1,p2.");
        return;
    }

    //检查有没有人可以碰杠胡
    for(var k in game.gameSeats){
        var ddd = game.gameSeats[k];
        if(ddd.canHu || ddd.canDianGang || ddd.canPeng){
            if(ddd != seatData){
                return;
            }
        }
    }

    var pai = game.chuPai;

    var t1 = getMJType(p1);
    var t2 = getMJType(p2);
    var t3 = getMJType(pai);
    //检查是否为同一个花色
    if(t1 != t2 || t2 != t3 || t1 != t3){
        console.log("not same color.");
        return;
    }

    //检查是不是金 金牌不能参与吃
    if(game.jingMap[p1] || game.jingMap[p2] || game.jingMap[pai]){
        return;
    }

    //如果是风 则直接就是OK的，因为前面已经判定过3张牌都不相同了
    if(t1 == 3 && pai >=27 && pai <= 30){
    }
    //筒条万，或者中发白
    else if((p1 == pai - 2) && (p2 == pai - 1)
        || (p1 == pai - 1) && (p2 == pai + 1)
        || (p1 == pai + 1) && (p2 == pai + 2)){
        //ok.
    }
    else{
        console.log("invalid p1,p2");
        return;
    }

    recordGameAction(game,seatData.seatIndex,ACTION_CHI,pai,p1,p2);

    seatData.guoHuFan = -1;
    clearAllOptions(game);

    var idx = seatData.holds.indexOf(p1);
    seatData.holds.splice(idx,1);
    seatData.countMap[p1] --;

    var idx = seatData.holds.indexOf(p2);
    seatData.holds.splice(idx,1);
    seatData.countMap[p2] --;


    seatData.chis.push([pai,p1,p2]);
    game.chuPai = -1;

    if(game.jingMap[pai]){
        seatData.fangJingSeat[pai] = game.turn;
        seatData.lastFangJingSeat = game.turn;
    }

    //recordGameAction(game,seatData.seatIndex,ACTION_CHI,pai,p1,p2);
    seatData.lastActionIsGang = false;

    var roomId = roomMgr.getUserRoom(seatData.userId);
    var room = roomMgr.getRoom(roomId);
    //广播通知其它玩家
    game.lastChuPaiTurn = -1;
    userMgr.broacastInRoom('chi_notify_push', { si: seatData.seatIndex, chipai: [pai, p1, p2] }, room, seatData.userId, true);

    //碰的玩家打牌
    moveToNextUser(game,seatData.seatIndex);

    //检查是否可以暗杠或者弯杠。
    checkCanAnGang(game,seatData);
    checkCanWanGang(game,seatData);

    //广播通知玩家出牌方
    seatData.canChuPai = true;
    userMgr.broacastInRoom('game_turn_changed_push', seatData.seatIndex, room, seatData.userId, true);

    //通知玩家做对应操作
    sendOperations(game,seatData);
};

exports.peng = function(userId){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }

    var game = seatData.game;

    //如果是他出的牌，则忽略
    if(game.turn == seatData.seatIndex){
        console.log("it's your turn.");
        return;
    }

    //如果没有碰的机会，则不能再碰
    if(seatData.canPeng == false){
        console.log("seatData.peng == false");
        return;
    }

    //和的了，就不要再来了
    if(seatData.hued){
        console.log('you have already hued. no kidding plz.');
        return;
    }
    
    //如果有人可以胡牌，则需要等待
    var i = game.turn;
    while(true){
        var i = (i + 1)%game.gameSeats.length;
        if(i == game.turn){
            break;
        }
        else{
            var ddd = game.gameSeats[i];
            if(ddd.canHu && i != seatData.seatIndex){
                return;    
            }
        }
    }

    seatData.guoHuFan = -1;
    clearAllOptions(game);

    //验证手上的牌的数目
    var pai = game.chuPai;
    var c = seatData.countMap[pai];
    if(c == null || c < 2){
        console.log("pai:" + pai + ",count:" + c);
        console.log(seatData.holds);
        console.log("lack of mj.");
        return;
    }

    //进行碰牌处理
    //扣掉手上的牌
    //从此人牌中扣除
    for(var i = 0; i < 2; ++i){
        var index = seatData.holds.indexOf(pai);
        if(index == -1){
            console.log("can't find mj.");
            return;
        }
        seatData.holds.splice(index,1);
        seatData.countMap[pai] --;
    }
    seatData.pengs.push(pai);
    game.chuPai = -1;

    recordGameAction(game,seatData.seatIndex,ACTION_PENG,pai);

    var roomId = roomMgr.getUserRoom(seatData.userId);
    var room = roomMgr.getRoom(roomId);
    //广播通知其它玩家
    game.lastChuPaiTurn = -1;
    userMgr.broacastInRoom('peng_notify_push', { si: seatData.seatIndex, pai: pai }, room, seatData.userId, true);

    //碰的玩家打牌
    moveToNextUser(game,seatData.seatIndex);
    
    //广播通知玩家出牌方
    seatData.canChuPai = true;
    userMgr.broacastInRoom('game_turn_changed_push', seatData.seatIndex, room, seatData.userId, true);
    
    //通知玩家做对应操作
    sendOperations(game,seatData);
};

exports.isPlaying = function(userId){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        return false;
    }

    var game = seatData.game;

    if(game.state == "idle"){
        return false;
    }
    return true;
}


function checkCanQiangGang(game,turnSeat,seatData,pai){
    var hasActions = false;
    for(var i = 0; i < game.gameSeats.length; ++i){
        //杠牌者不检查
        if(seatData.seatIndex == i){
            continue;
        }
        var ddd = game.gameSeats[i];
        //已经和牌的不再检查
        if(ddd.hued){
            continue;
        }

        checkCanHu(game,ddd,pai,true);
        if(ddd.canHu){
            sendOperations(game,ddd,pai);
            hasActions = true;
        }
    }
    if(hasActions){
        game.qiangGangContext = {
            turnSeat:turnSeat,
            seatData:seatData,
            pai:pai,
            isValid:true,
        }
    }
    else{
        game.qiangGangContext = null;
    }
    return game.qiangGangContext != null;
}

function doGang(game,turnSeat,seatData,gangtype,numOfCnt,pai){
    game.lastChuPaiTurn = -1;
    var seatIndex = seatData.seatIndex;
    var gameTurn = turnSeat.seatIndex;
    seatData.guoHuFan = -1;
    var isZhuanShouGang = false;
    if(gangtype == "wangang"){
        var idx = seatData.pengs.indexOf(pai);
        if(idx >= 0){
            seatData.pengs.splice(idx,1);
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
    for(var i = 0; i < numOfCnt; ++i){
        var index = seatData.holds.indexOf(pai);
        if(index == -1){
            console.log(seatData.holds);
            console.log("can't find mj.");
            return;
        }
        seatData.holds.splice(index,1);
        seatData.countMap[pai] --;
    }

    var actionType = ACTION_AN_GANG;
    if(gangtype == 'diangang'){
        actionType = ACTION_DIAN_GANG;
    }
    else if(gangtype == 'wangang'){
        actionType = ACTION_WAN_GANG;
    }

    recordGameAction(game,seatData.seatIndex,actionType,pai);

    //记录下玩家的杠牌
    if(gangtype == "angang"){
        seatData.angangs.push(pai);
        var ac = recordUserAction(game,seatData,"angang");
        ac.score = 2;
    }
    else if(gangtype == "diangang"){
        seatData.diangangs.push(pai);
        var ac = recordUserAction(game,seatData,"diangang",gameTurn);
        ac.score = 3;
        var fs = turnSeat;
        recordUserAction(game,fs,"fanggang",seatIndex);
    }
    else if(gangtype == "wangang"){
        seatData.wangangs.push(pai);
        if(isZhuanShouGang == false){
            var ac = recordUserAction(game,seatData,"wangang");
            ac.score = 1;
        }
        else{
            recordUserAction(game,seatData,"zhuanshougang");
        }

    }

    var roomId = roomMgr.getUserRoom(seatData.userId);
    var room = roomMgr.getRoom(roomId);
    //通知其他玩家，有人杠了牌
    userMgr.broacastInRoom('gang_notify_push', { si: seatData.seatIndex, pai: pai, gangtype: gangtype }, room, seatData.userId, true);

    //变成自己的轮子
    moveToNextUser(game,seatIndex);
    //再次摸牌
    doUserMoPai(game,seatData.lastFangGangSeat);
}

exports.gang = function(userId,pai){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }

    var seatIndex = seatData.seatIndex;
    var game = seatData.game;

    //如果没有杠的机会，则不能再杠
    if(seatData.canGang == false) {
        console.log("seatData.gang == false");
        return;
    }

    //和的了，就不要再来了
    if(seatData.hued){
        console.log('you have already hued. no kidding plz.');
        return;
    }

    if(seatData.gangPai.indexOf(pai) == -1){
        console.log("the given pai can't be ganged.");
        return;   
    }
    
    //如果有人可以胡牌，则需要等待
    var i = game.turn;
    while(true){
        var i = (i + 1)%game.gameSeats.length;
        if(i == game.turn){
            break;
        }
        else{
            var ddd = game.gameSeats[i];
            if(ddd.canHu && i != seatData.seatIndex){
                return;    
            }
        }
    }

    var numOfCnt = seatData.countMap[pai];

    var gangtype = ""   //对照 弯杠wangang：碰杠，点杠diangang：明杠，暗杠angang 含义相同
    //弯杠 去掉碰牌
    if(numOfCnt == 1){
        gangtype = "wangang"
    }
    else if(numOfCnt == 3){
        gangtype = "diangang"
    }
    else if(numOfCnt == 4){
        gangtype = "angang";
    }
    else{
        console.log("invalid pai count.");
        return;
    }

    game.GangShanghu = true;//三游 杠上自摸开关
    
    game.chuPai = -1;
    clearAllOptions(game);
    seatData.canChuPai = false;
    
    var roomId = roomMgr.getUserRoom(seatData.userId);
    var room = roomMgr.getRoom(roomId);
    userMgr.broacastInRoom('hangang_notify_push', seatIndex, room, seatData.userId, true);
    
    //如果是弯杠（及碰杠），则需要检查是否可以抢杠,(补充)明杠也能抢杠胡
    var turnSeat = game.gameSeats[game.turn];
    if (!game.conf.bukechibukepinghu) {//如果是不能吃不能平胡,不检测抢杠胡
        if (numOfCnt == 1) { //|| numOfCnt == 3 
            var canQiangGang = checkCanQiangGang(game, turnSeat, seatData, pai);//checkCanQiangGang ,checkCanQiangGgang                
            if (canQiangGang) {
                return;
            }
        }
    }
    
    doGang(game,turnSeat,seatData,gangtype,numOfCnt,pai);
};

exports.hu = function(userId){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }

    var seatIndex = seatData.seatIndex;
    var game = seatData.game;

    //如果他不能和牌，那和个啥啊
    if(seatData.canHu == false){
        console.log("invalid request.");
        return;
    }

    //和的了，就不要再来了
    if(seatData.hued){
        console.log('you have already hued. no kidding plz.');
        return;
    }

    //依次检查
    //如果有人可以胡牌，则需要等待
    var i = game.turn;
    while(true){
        var i = (i + 1)%game.gameSeats.length;
        if(i == game.turn){
            break;
        }
        else{
            var ddd = game.gameSeats[i];
            if(ddd.canHu){
                if(i != seatData.seatIndex){
                    return;
                }
                else{
                    break;
                }    
            }
        }
    }

    //标记为和牌
    seatData.hued = true;
    var hupai = game.chuPai;
    var isZimo = false;

    var turnSeat = game.gameSeats[game.turn];
    seatData.isGangHu = turnSeat.lastFangGangSeat >= 0;
    var notify = -1;
    
    if(game.qiangGangContext != null){
        var gangSeat = game.qiangGangContext.seatData;
        hupai = game.qiangGangContext.pai;
        notify = hupai;
        var ac = recordUserAction(game,seatData,"qiangganghu",gangSeat.seatIndex);    
        ac.iszimo = false;
        recordGameAction(game,seatIndex,ACTION_HU,hupai);
        seatData.isQiangGangHu = true;
        game.qiangGangContext.isValid = false;
        
        
        var idx = gangSeat.holds.indexOf(hupai);
        if(idx != -1){
            gangSeat.holds.splice(idx,1);
            gangSeat.countMap[hupai]--;
            userMgr.sendMsg(gangSeat.userId,'game_holds_push',{
                si:gangSeat.seatIndex,
                holds:gangSeat.holds
            });
        }
        //将牌添加到玩家的手牌列表，供前端显示
        seatData.holds.push(hupai);
        if(seatData.countMap[hupai]){
            seatData.countMap[hupai]++;
        }
        else{
            seatData.countMap[hupai] = 1;
        }
        
        recordUserAction(game,gangSeat,"beiqianggang",seatIndex);
    }
    else if(game.chuPai == -1){
        hupai = seatData.holds[seatData.holds.length - 1];
        notify = -1;
        if(seatData.isGangHu){
            if(turnSeat.lastFangGangSeat == seatIndex){
                var ac = recordUserAction(game,seatData,"ganghua");    
                ac.iszimo = true;
            }
            else{
                var diangganghua_zimo = true;//game.conf.dianganghua == 1;
                if(diangganghua_zimo){
                    var ac = recordUserAction(game,seatData,"dianganghua");
                    ac.iszimo = true;
                }
                else{
                    var ac = recordUserAction(game,seatData,"dianganghua",turnSeat.lastFangGangSeat);
                    ac.iszimo = false;
                }
            }
        }
        else{
            var ac = recordUserAction(game,seatData,"zimo");
            ac.iszimo = true;
        }

        isZimo = true;
        recordGameAction(game,seatIndex,ACTION_ZIMO,hupai);
    }
    else{
        notify = game.chuPai;
        //将牌添加到玩家的手牌列表，供前端显示
        seatData.holds.push(game.chuPai);
        if(seatData.countMap[game.chuPai]){
            seatData.countMap[game.chuPai]++;
        }
        else{
            seatData.countMap[game.chuPai] = 1;
        }

        console.log(seatData.holds);

        var at = "hu";
        //炮胡
        if(turnSeat.lastFangGangSeat >= 0){
            at = "gangpaohu";
        }

        var ac = recordUserAction(game,seatData,at,game.turn);
        ac.iszimo = false;

        //记录玩家放炮信息
        var fs = game.gameSeats[game.turn];
        recordUserAction(game,fs,"fangpao",seatIndex);

        recordGameAction(game,seatIndex,ACTION_HU,hupai);
    }

    //保存番数
    var ti = seatData.tingInfo;
    seatData.fan = ti.fan;
    seatData.pattern = ti.pattern;
    seatData.iszimo = isZimo;
    seatData.hupai = hupai;
    //如果是最后一张牌，则认为是海底胡
    seatData.isHaiDiHu = game.currentIndex == game.mahjongs.length;
 
    if(game.chupaiCnt == 0 && game.button == seatData.seatIndex && game.chuPai == -1){
        seatData.isTianHu = true;
    }

    clearAllOptions(game);
    
    var roomId = roomMgr.getUserRoom(seatData.userId);
    var room = roomMgr.getRoom(roomId);
    //通知前端，有人和牌了
    game.lastChuPaiTurn = -1;
    var temp = [];
    try {
        for (var i = 0; i < game.roomInfo.seats.length; ++i) {
            var sd = game.roomInfo.game.gameSeats[i];
            var userRT = {
                actions:sd.actions,
                tianhu: sd.isTianHu,
                jingdiao: sd.isJingDiao,
                shuangyou: sd.isShuangYou,
                sanyou: sd.isSanYou,
                pattern:sd.pattern,
            };

            for(var k in sd.actions){
                userRT.actions[k] = {
                    type:sd.actions[k].type,
                };
            }
            temp.push(userRT);
        }
    } catch (error) {
        console.error(new Date(),error);
    }

    userMgr.broacastInRoom('hu_push', { si: seatIndex, iszimo: isZimo, hupai: hupai ,hutype:temp}, room, seatData.userId, true);

    game.firstHupai = seatData.seatIndex;
    sleep(500);
    doGameOver(game.roomInfo);
};

exports.guo = function(userId){
    var seatData = gameSeatsOfUsers[userId];
    if(seatData == null){
        console.log("can't find user game data.");
        return;
    }

    var seatIndex = seatData.seatIndex;
    var game = seatData.game;
    
    if(game.state == 'baoting'){
        var idx = game.couldBaoTing.indexOf(seatIndex);
        if(idx != -1){
            game.couldBaoTing.splice(idx,1);
            if(game.couldBaoTing.length == 0){
                start(game);
            }
        }
        userMgr.sendMsg(seatData.userId,"guo_result");
        return;
    }

    //如果玩家没有对应的操作，则也认为是非法消息
    if(!(seatData.canGang || seatData.canPeng || seatData.canHu || seatData.canChi) || seatData.noGuo){
        console.log("no need guo.");
        return;
    }

    //如果是玩家自己的轮子，不是接牌，则不需要额外操作
    var doNothing = game.chuPai == -1 && game.turn == seatIndex;

    userMgr.sendMsg(seatData.userId,"guo_result");

    //这里还要处理过胡的情况
    if(seatData.canHu && game.chuPai != -1){
        seatData.guoHuFan = seatData.tingInfo.fan;
    }

    clearAllOptions(game,seatData);

    if(doNothing){
        return;
    }
    
    //如果还有人可以操作，则等待
    for(var i = 0; i < game.gameSeats.length; ++i){
        var ddd = game.gameSeats[i];
        if(hasOperations(ddd)){
            return;
        }
    }

    //如果是已打出的牌，则需要通知。
    if(game.chuPai >= 0){
        var turnSeat = game.gameSeats[game.turn];
        var uid = turnSeat.userId;
        var roomId = roomMgr.getUserRoom(turnSeat.userId);
        var room = roomMgr.getRoom(roomId);
        userMgr.broacastInRoom('guo_notify_push', { si: turnSeat.seatIndex, pai: game.chuPai }, room, turnSeat.userId, true);
        turnSeat.folds.push(game.chuPai);
        game.chuPai = -1;
    }
    
    
    var qiangGangContext = game.qiangGangContext;
    //清除所有的操作
    clearAllOptions(game);
    
    if(qiangGangContext != null && qiangGangContext.isValid){
        doGang(game,qiangGangContext.turnSeat,qiangGangContext.seatData,"wangang",1,qiangGangContext.pai);        
    }
    else{
        if ((game.turn + 1) % 4 == seatIndex) {
            setTimeout(function () {
                //下家摸牌
                moveToNextUser(game);
                doUserMoPai(game);
            }, 800);
        } else {
            //下家摸牌
            moveToNextUser(game);
            doUserMoPai(game);
        }  
    }
};

exports.hasBegan = function(roomId){
    var game = games[roomId];
    if(game != null){
        return true;
    }
    var roomInfo = roomMgr.getRoom(roomId);
    if(roomInfo != null){
        return roomInfo.numOfGames > 0;
    }
    return false;
};

var JU_SHU = [-1,8,12];//局数
var JU_SHU_COST = [5,4,5];//4人扣游戏币
var JU_SHU_COST_TOW = [3,3,4];//2人扣游戏币
var DI_FEN = [1,2,3,4,5,10];
var REN_SHU = [2,3,4];
exports.getConf = function(creator,roomConf,gems){
    console.log("==创建房间游戏币==1",gems);
    var res = {
        ret: RET_OK,
        conf: null,
    };


    if(
		roomConf.type == null
		|| roomConf.jushuxuanze == null
        || roomConf.youjing == null
        || roomConf.bukechibukepinghu == null
        || roomConf.renshuxuanze == null
        ){
        return res;
	}

	if(roomConf.jushuxuanze < 0 || roomConf.jushuxuanze > JU_SHU.length){
		return res;
	}
	if(roomConf.renshuxuanze < 0 || roomConf.renshuxuanze > REN_SHU.length){
        return res;
    }

    var numPeople = REN_SHU[roomConf.renshuxuanze];
    var numGames = JU_SHU[roomConf.jushuxuanze];
    var cost = 0;//numGames * numPeople * 5 / 4;
    if(roomConf.renshuxuanze == 2){ //4人 扣费
        cost = JU_SHU_COST[roomConf.jushuxuanze];
    }else{//2人 扣费
        cost = JU_SHU_COST_TOW[roomConf.jushuxuanze];
    }
    
    // if(roomConf.aa){
    //     cost /= numPeople;
    // }
	if(cost > gems){
        res.ret = GAME_ERRS.GEMS_NOT_ENOUGH;
		return res;
	}

    res.errcode = 0;
    res.conf = {
        type:roomConf.type,
        baseScore:1,
        jushuxuanze:roomConf.jushuxuanze,
        maxGames:numGames,
        youjing:roomConf.youjing,
        bukechibukepinghu:roomConf.bukechibukepinghu,
        danjingbupinghu:roomConf.danjingbupinghu,
        numPeople:numPeople,
        cost:cost,
        creator:creator,
    }
    return res;
}

exports.syncLocation = function (userId,temp) {//gps
    try {
        var roomId = roomMgr.getUserRoom(userId);
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
            if (loc != null) {
                data.push({ userId: rs.userId, location: loc, name: rs.name });
            }else{
                data.push({ userId: rs.userId, location: null, name: rs.name });
            }
        }
        userMgr.broacastInRoom('location_push', data, roomInfo,userId, true);
    } catch (error) {
        console.error(new Date(),"gps"+error);
    }
};

exports.setLocation = function (userId, location,data) {
    userIdLocation[userId] = location;
    exports.syncLocation(userId,data);
};

exports.forceEnd = function(roomInfo){
    doGameOver(roomInfo,true);
} 

/*
var mokgame = {
    gameSeats:[{folds:[]}],
    mahjongs:[],
    currentIndex:-1,
    jings:[1],
    jingMap:{'1':true},
    conf:{}
}
var mokseat = {
    holds:[2,3,4,5,6,7,24,24,24,25,25,25,26],
    isBaoTing:false,
    countMap:{},
    pengs:[4],
    feis:[],
    diangangs:[],
    angangs:[],
    wangangs:[],
    diansuos:[],
    wansuos:[],
    ansuos:[],
    gangPai:[]
}

for(var k in mokseat.holds){
    var pai = mokseat.holds[k];
    if(mokseat.countMap[pai]){
        mokseat.countMap[pai] ++;
    }
    else{
        mokseat.countMap[pai] = 1;
    }
}

var t = checkCanHu(mokgame,mokseat,1);
*/