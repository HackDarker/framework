var WindChecker = require("./windchecker");
var windchecker = new WindChecker();
var kanzi = [];
var jingMap = {};
var numOfJings = 0;
var record = false;

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

function debugRecord(pai) {
    if (record) {
        kanzi.push(pai);
    }
}

function addCount(seatData, pai, value) {
    var cnt = seatData.countMap[pai];
    if (cnt != null) {
        cnt += value;
        seatData.countMap[pai] = cnt;
    }
}

function isZhongFaBai(selected) {
    return selected >= 31 && selected <= 33;
}

function isWind(selected) {
    return selected >= 27 && selected <= 30;
}

function MatchABO(seatData, selected, jingMode) {
    //分开匹配 A-2,A-1,A
    var matched = true;
    var requireJings = 0;
    if (isZhongFaBai(selected)) {
        //只有白板可以向左拼
        return false;
    }
    else if (isWind(selected)) {
        return false;
    }
    else {
        var v = selected % 9;
        if (v < 2) {
            matched = false;
        }
    }

    if (matched) {
        for (var i = 0; i < 3; ++i) {
            var t = selected - 2 + i;
            var cc = seatData.countMap[t];
            if (cc == null || cc <= 0) {

                if (jingMode && numOfJings > requireJings) {
                    requireJings++;
                }
                else {
                    matched = false;
                    break;
                }
            }
        }
    }


    //匹配成功，扣除相应数值
    if (matched) {
        addCount(seatData, selected - 2, -1);
        addCount(seatData, selected - 1, -1);
        addCount(seatData, selected - 0, -1);
        numOfJings -= requireJings;

        var ret = checkSingle(seatData, jingMode);
        addCount(seatData, selected - 2, 1);
        addCount(seatData, selected - 1, 1);
        addCount(seatData, selected - 0, 1);
        numOfJings += requireJings;

        if (ret == true) {
            debugRecord(selected - 2);
            debugRecord(selected - 1);
            debugRecord(selected);
            return true;
        }
    }
    return false;
}

function MatchAOB(seatData, selected, jingMode) {
    //分开匹配 A-1,A,A + 1
    var matched = true;
    var requireJings = 0;
    if (isZhongFaBai(selected)) {
        //只有发财可以左右拼
        return false;
    }
    else if (isWind(selected)) {
        return false;
    }
    else {
        var v = selected % 9;
        if (v < 1 || v > 7) {
            matched = false;
        }
    }

    if (matched) {
        for (var i = 0; i < 3; ++i) {
            var t = selected - 1 + i;
            var cc = seatData.countMap[t];
            if (cc == null || cc <= 0) {
                if (jingMode && numOfJings > requireJings) {
                    requireJings++;
                }
                else {
                    matched = false;
                    break;
                }
            }
        }
    }
    //匹配成功，扣除相应数值
    if (matched) {
        addCount(seatData, selected - 1, -1);
        addCount(seatData, selected - 0, -1);
        addCount(seatData, selected + 1, -1);
        numOfJings -= requireJings;

        var ret = checkSingle(seatData, jingMode);
        addCount(seatData, selected - 1, 1);
        addCount(seatData, selected - 0, 1);
        addCount(seatData, selected + 1, 1);
        numOfJings += requireJings;

        if (ret == true) {
            debugRecord(selected - 1);
            debugRecord(selected - 0);
            debugRecord(selected + 1);
            return true;
        }
    }
    return false;
}

function MatchOAB(seatData, selected, jingMode) {
    //分开匹配 A,A+1,A + 2
    var matched = true;
    var requireJings = 0;
    if (isZhongFaBai(selected)) {
        //只有红中可以向右拼
        return false;
    }
    else if (isWind(selected)) {
        return false;
    }
    else {
        var v = selected % 9;
        if (v > 6) {
            matched = false;
        }
    }

    if (matched) {
        for (var i = 0; i < 3; ++i) {
            var t = selected + i;
            var cc = seatData.countMap[t];

            if (cc == null || cc <= 0) {

                if (jingMode && numOfJings > requireJings) {
                    requireJings++;
                }
                else {
                    matched = false;
                    break;
                }
            }
        }
    }


    //匹配成功，扣除相应数值
    if (matched) {
        addCount(seatData, selected - 0, -1);
        addCount(seatData, selected + 1, -1);
        addCount(seatData, selected + 2, -1);
        numOfJings -= requireJings;

        var ret = checkSingle(seatData, jingMode);
        addCount(seatData, selected - 0, 1);
        addCount(seatData, selected + 1, 1);
        addCount(seatData, selected + 2, 1);
        numOfJings += requireJings;

        if (ret == true) {
            debugRecord(selected - 0);
            debugRecord(selected + 1);
            debugRecord(selected + 2);
            return true;
        }
    }
    return false;
}

function matchSingle(seatData, selected, jingMode) {
    //分开匹配 A-2,A-1,A
    //console.log(seatData.countMap);
    var matched = MatchABO(seatData, selected, jingMode);
    if (matched) {
        return true;
    }

    //分开匹配 A-1, A, A+1
    //console.log(seatData.countMap);
    matched = MatchAOB(seatData, selected, jingMode);
    if (matched) {
        return true;
    }


    //分开匹配 A, A+1, A+2
    matched = MatchOAB(seatData, selected, jingMode);
    if (matched) {
        return true;
    }
    return false;
}

function checkSingle(seatData, jingMode) {
    var holds = seatData.holds;
    var selected = -1;
    var c = 0;
    for (var i = 0; i < holds.length; ++i) {
        var pai = holds[i];
        // if (isWind(pai)) {
        //     continue;
        // }
        c = seatData.countMap[pai];
        if (c > 0) {
            selected = pai;
            break;
        }
    }
    //如果没有找到剩余牌，则检查东南西北风
    if (selected == -1) {
        return true;
    }
    //否则，进行匹配
    if (c == 3) {
        //直接作为一坎
        seatData.countMap[selected] = 0;
        debugRecord(selected);
        debugRecord(selected);
        debugRecord(selected);
        var ret = checkSingle(seatData, jingMode);
        //立即恢复对数据的修改
        seatData.countMap[selected] = c;
        if (ret == true) {
            return true;
        }
    }
    else if (c == 4) {
        //直接作为一坎
        seatData.countMap[selected] = 1;
        debugRecord(selected);
        debugRecord(selected);
        debugRecord(selected);
        var ret = checkSingle(seatData, jingMode);
        //立即恢复对数据的修改
        seatData.countMap[selected] = c;
        //如果作为一坎能够把牌匹配完，直接返回TRUE。
        if (ret == true) {
            return true;
        }
    }
    else if (c == 2) {
        //替用作为一坎
        if (jingMode && numOfJings >= 1) {
            seatData.countMap[selected] = 0;
            numOfJings -= 1;
            var ret = checkSingle(seatData, jingMode);
            seatData.countMap[selected] = c;
            numOfJings += 1;
            if (ret == true) {
                return true;
            }
        }
    }
    else if (c == 1) {
        //替用作为一坎
        if (jingMode && numOfJings >= 2) {
            seatData.countMap[selected] = 0;
            numOfJings -= 2;
            var ret = checkSingle(seatData, jingMode);
            seatData.countMap[selected] = c;
            numOfJings += 2;
            if (ret == true) {
                return true;
            }
        }
    }

    //按单牌处理
    return matchSingle(seatData, selected, jingMode);
}

exports.setJings = function (jings) {
    jingMap = {};
    for (var i = 0; i < jings.length; ++i) {
        jingMap[jings[i]] = true;
    }
}

function storeJingMap(seatData, chupai) {
    var oldJingMap = {}
    for (var k in jingMap) {
        oldJingMap[k] = seatData.countMap[k];
        if (chupai == k) {
            seatData.countMap[k] = 1;
        }
        else {
            seatData.countMap[k] = 0;
        }
    }
    return oldJingMap;
}

function restoreJingMap(seatData, oldJingMap) {
    //将备份的精还原
    if (oldJingMap) {
        for (var k in jingMap) {
            var c = oldJingMap[k];
            if (c) {
                seatData.countMap[k] = c;
            }
        }
    }
}

exports.isPingHu = function (jm, seatData, checkJings, chupai) {
    jingMap = jm;
    numOfJings = 0;
    for (var k in seatData.countMap) {
        if (jingMap[k] == true) {
            var c = seatData.countMap[k];
            numOfJings += c;
        }
    }

    if (jingMap[chupai] == true) {
        numOfJings -= 1;
    }

    var hasJing = numOfJings > 0;
    var oldJings = numOfJings;
    var fn = function (jingMode) {

        if (jingMode) {
            if (hasJing == false) {
                return false;
            }

            //如果全把精，则返回可以胡(不可能是七对和十三烂，只能是精吊平胡)
            if (seatData.holds.length == numOfJings) {
                return true;
            }
        }

        //将精的数目备份 然后清除精的数目
        var oldJingMap = null;
        if (jingMode) {
            oldJingMap = storeJingMap(seatData, chupai);
        }

        var ret = false;
        for (var k in seatData.countMap) {
            numOfJings = oldJings;
            k = parseInt(k);
            var c = seatData.countMap[k];

            if (!(c > 0)) {
                continue;
            }

            if (c < 2) {
                if (jingMode == false || numOfJings < 1) {
                    continue;
                }
                else {
                    numOfJings -= 1;
                }
            }


            //如果当前牌大于等于２，则将它选为将牌
            seatData.countMap[k] -= 2;
            //逐个判定剩下的牌是否满足　３Ｎ规则,一个牌会有以下几种情况
            //1、0张，则不做任何处理
            //2、2张，则只可能是与其它牌形成匹配关系
            //3、3张，则可能是单张形成 A-2,A-1,A  A-1,A,A+1  A,A+1,A+2，也可能是直接成为一坎
            //4、4张，则只可能是一坎+单张
            ret = checkSingle(seatData, jingMode);
            seatData.countMap[k] += 2;
            if (ret) {
                break;
            }
        }

        restoreJingMap(seatData, oldJingMap);
        return ret;
    }

    var ret = fn(false);
    if (ret) {
        return 1;
    }

    if (checkJings) {
        if (fn(true)) {
            return 2;
        }
    }
    return 0;
};

exports.isJingDiao = function (jm, seatData) {
    jingMap = jm;
    var jing = null;
    numOfJings = 0;
    for (var k in seatData.countMap) {
        if (jingMap[k] == true) {
            jing = k;
            numOfJings += seatData.countMap[k];
        }
    }
    if (jing == null) {
        return null;
    }

    //拿掉一个精，然后判定是否胡牌
    numOfJings -= 1;
    seatData.countMap[jing] -= 1;
    var oldJingMap = storeJingMap(seatData);
    var oldNumOfJings = numOfJings;
    var ret = exports.canTing4Melds(jm, seatData, true);
    restoreJingMap(seatData, oldJingMap);

    if (ret != 0) {
        seatData.countMap[jing] += 1;
        return '4melds';
    }

    var oldJingMap = storeJingMap(seatData);
    numOfJings = oldNumOfJings;

    var ret = exports.is6Pairs(seatData);
    restoreJingMap(seatData, oldJingMap);
    if (ret) {
        seatData.countMap[jing] += 1;
        return '7pairs';
    }

    var oldJingMap = storeJingMap(seatData);
    numOfJings = oldNumOfJings;

    var ret = checkSingle(seatData, true);
    restoreJingMap(seatData, oldJingMap);
    seatData.countMap[jing] += 1;
    if (ret) {
        return 'normal'
    }
    return null;
}

function has7Stars(seatData, checkJings) {
    for (var i = 27; i <= 33; ++i) {
        //如果要检查精，则此牌精必须大于等于1（因为七星十三烂中的牌，不能用听用代替)
        if (checkJings && jingMap[i] == true) {
            if (seatData.countMap[i] == null || seatData.countMap[i] == 0) {
                return false;
            }
            continue;
        }
        //东南西北中发白必需为1
        if (seatData.countMap[i] != 1) {
            return false;
        }
    }
    return true;
};

exports.is7Stars13Lan = function (jm, seatData, checkJings, chupai) {
    jingMap = jm;
    numOfJings = 0;
    for (var k in seatData.countMap) {
        if (jingMap[k] == true) {
            var c = seatData.countMap[k];
            numOfJings += c;
        }
    }

    if (jingMap[chupai] == true) {
        numOfJings -= 1;
    }
    var hasJing = numOfJings > 0;

    var fn = function (seatData, jingMode) {
        if (has7Stars(seatData, jingMode) == false) {
            return false;
        }

        var oldJingMap = null;
        if (jingMode) {
            if (!hasJing) {
                return false;
            }
            oldJingMap = storeJingMap(seatData, chupai);
        }

        var ret = true;
        for (var i = 0; i < seatData.holds.length; ++i) {
            var p = seatData.holds[i];

            //十三烂，所有牌不能重复
            var c = seatData.countMap[p];
            if (c == 0) {
                continue;
            }

            if (c > 1) {
                ret = false;
                break;
            }

            //东南西北中发白可以是顺子
            if (p >= 27 && p <= 33) {
                continue;
            }
            else {
                //检查左右
                var t = p % 9;
                if (t > 0 && seatData.countMap[p - 1] > 0) {
                    ret = false;
                    break;
                }
                if (t > 1 && seatData.countMap[p - 2] > 0) {
                    ret = false;
                    break;
                }

                if (t < 7 && seatData.countMap[p + 2] > 0) {
                    ret = false;
                    break;
                }
                if (t < 8 && seatData.countMap[p + 1] > 0) {
                    ret = false;
                    break;
                }
            }
        }
        restoreJingMap(seatData, oldJingMap);
        return ret;
    }

    if (seatData.holds.length != 14) {
        return 0;
    }

    var ret = fn(seatData, false);
    if (ret) {
        return 1;
    }
    if (checkJings) {
        ret = fn(seatData, true);
        if (ret) {
            return 2;
        }
    }
    return 0;
}

exports.is13Lan = function (jm, seatData, checkJings, chupai) {
    jingMap = jm;

    numOfJings = 0;
    for (var k in seatData.countMap) {
        if (jingMap[k] == true) {
            var c = seatData.countMap[k];
            numOfJings += c;
        }
    }

    if (jingMap[chupai] == true) {
        numOfJings -= 1;
    }

    var hasJing = numOfJings > 0;

    var fn = function (seatData, jingMode) {

        var oldJingMap = null;
        if (jingMode) {
            if (!hasJing) {
                return false;
            }
            oldJingMap = storeJingMap(seatData, chupai);
        }

        var ret = true;
        for (var i = 0; i < seatData.holds.length; ++i) {
            var p = seatData.holds[i];
            //十三烂，所有牌不能重复
            var c = seatData.countMap[p];
            if (c == 0) {
                continue;
            }

            if (c > 1) {
                ret = false;
                break;
            }

            //东南西北中发白可以顺子
            if (p >= 27 && p <= 33) {
                continue;
            }
            else {
                //检查左右
                var t = p % 9;
                if (t > 0 && seatData.countMap[p - 1] > 0) {
                    ret = false;
                    break;
                }
                if (t > 1 && seatData.countMap[p - 2] > 0) {
                    ret = false;
                    break;
                }

                if (t < 7 && seatData.countMap[p + 2] > 0) {
                    ret = false;
                    break;
                }
                if (t < 8 && seatData.countMap[p + 1] > 0) {
                    ret = false;
                    break;
                }
            }
        }
        restoreJingMap(seatData, oldJingMap);
        return ret;
    }

    if (seatData.holds.length != 14) {
        return 0;
    }

    var ret = fn(seatData, false);
    if (ret) {
        return 1;
    }
    if (checkJings) {
        ret = fn(seatData, true);
        if (ret) {
            return 2;
        }
    }
    return 0;
}

exports.is7Pairs = function (jm, seatData, checkJings, chupai) {
    jingMap = jm;
    numOfJings = 0;
    for (var k in seatData.countMap) {
        if (jingMap[k] == true) {
            var c = seatData.countMap[k];
            numOfJings += c;
        }
    }
    if (jingMap[chupai] == true) {
        numOfJings -= 1;
    }
    var hasJing = numOfJings > 0;

    //检查是否是七对 前提是没有碰，也没有杠 ，即手上拥有13张牌
    var fn = function (seatData, jingMode) {

        var oldJingMap = null;
        if (jingMode) {
            if (!hasJing) {
                return false;
            }
            oldJingMap = storeJingMap(seatData, chupai);
        }

        var pairCount = 0;
        for (var k in seatData.countMap) {
            var c = seatData.countMap[k];
            if (c == 2) {
                pairCount++;
            }
            else if (c == 4) {
                pairCount += 2;
            }
            else if (c == 3) {
                pairCount += 1;
            }
        }

        restoreJingMap(seatData, oldJingMap);
        //检查是否有7对
        var j = jingMode ? numOfJings : 0;
        if (pairCount + j >= 7) {
            return true;
        }
        return false;
    }
    if (seatData.holds.length != 14) {
        return 0;
    }

    var ret = fn(seatData, false);
    if (ret) {
        return 1;
    }
    if (checkJings) {
        ret = fn(seatData, true);
        if (ret) {
            return 2;
        }
    }
    return 0;
}

exports.is6Pairs = function (seatData) {
    var pairCount = 0;
    if (seatData.holds.length != 13) {
        return false;
    }

    for (var k in seatData.countMap) {
        var c = seatData.countMap[k];
        if (c == 2) {
            pairCount++;
        }
        else if (c == 3) {
            pairCount++;
        }
        else if (c == 4) {
            pairCount += 2;
        }
    }

    //检查是否有6对
    if (pairCount + numOfJings >= 6) {
        return true;
    }

    return false;
}

exports.canTing4Melds = function (jm, seatData, checkJings, chupai) {
    jingMap = jm;
    if (seatData.chis && seatData.chis.length > 0) {
        return false;
    }

    var hasJing = numOfJings > 0;

    var fn = function (seatData, jingMode) {
        var oldJingMap = null;
        if (jingMode) {
            if (hasJing == false) {
                return false;
            }
            oldJingMap = storeJingMap(seatData, chupai);
        }

        var meldCount = 0;
        var pairCount = 0;
        var singleCount = 0;
        for (var k in seatData.countMap) {
            var c = seatData.countMap[k];
            if (c == 1) {
                singleCount++;
            }
            else if (c == 2) {
                pairCount++;
            }
            else if (c == 3) {
                meldCount++;
            }
            else if (c == 4) {
                meldCount++;
                singleCount++;
            }
        }

        restoreJingMap(seatData, oldJingMap);

        if (jingMode) {
            var needJing = pairCount + singleCount * 2;
            if (needJing > numOfJings) {
                return false;
            }
            return true;
        }
        else {
            //必须满足无单牌，无对子
            return pairCount == 0 && singleCount == 0;
        }
    }

    var ret = fn(seatData, false);
    if (ret) {
        return 1;
    }
    if (checkJings) {
        ret = fn(seatData, true);
        if (ret) {
            return 2;
        }
    }
    return 0;
};

function calculateGang(seatData) {
    return seatData.angangs.length + seatData.diangangs.length + seatData.wangangs.length;
};

/**
 * 组合
 * @param paiArr
 */
exports.isQiQian = function (seatData, checkJings) {
    if (seatData.holds.length < 14) {
        return 0
    }

    var countArr = new Array(27);
    for (var i = 0; i < countArr.length; i++) {
        countArr[i] = 0;
    }

    var pairCount = 0;
    var jingNum = 0
    for (var i = 0; i < seatData.holds.length; i++) {
        var pai = seatData.holds[i];
        var mjType = getMJType(pai);
        if (mjType == 3 && seatData.game.jingMap[pai] != true) {
            return 0;
        }

        if (seatData.game.jingMap[pai] == true) {
            jingNum++;
        } else {
            countArr[pai]++;
        }
    }

    for (var i = 0; i < countArr.length; i++) {
        var count = countArr[i];
        if (count <= 0) {
            continue;
        }
        var target = i + 2;
        // 8、9 这两张牌略过
        if (i % 9 + 2 > 8) {
            continue;
        }
        for (var j = 0; j < count; j++) {
            if (countArr[target] > 0) {
                countArr[target]--;
                pairCount++;
            }
        }
    }

    if (pairCount >= 7) {
        return 1;
    }

    if (checkJings) {
        if (pairCount + jingNum >= 7) {
            return 2;
        }
    }
    return 0;
}

// 一杠一达
exports.isYiGangYiDa = function (jm, seatData, checkJings, chupai) {
    if (seatData.chis.length > 0) {
        return 0;
    }
    jingMap = jm;

    var gangNum = calculateGang(seatData);
    if (gangNum != 1) {
        return 0;
    }

    var pairCount = 0;
    var singleCount = 0;
    var numOfJings = 0;
    for (var k in seatData.countMap) {
        var c = seatData.countMap[k];
        if (jingMap[k] == true) {
            numOfJings += c;
        } else if (c == 1) {
            singleCount++;
        } else if (c == 2) {
            pairCount++;
        } else if (c == 3) {
            pairCount++;
            singleCount++;
        } else if (c == 4) {
            pairCount += 2;
        }
    }

    if (pairCount >= 5) {
        return 1;
    }

    if (checkJings) {
        var jingPairCount = 0;
        if(singleCount >= numOfJings) {
            jingPairCount = numOfJings;
        } else {
            jingPairCount = singleCount + Math.floor(numOfJings / 2);
        }
        if (pairCount + jingPairCount >= 5) {
            return 2;
        }
    }

    return 0;
};

exports.isErGangYiDa = function (jm, seatData, checkJings, chupai) {
    jingMap = jm;

    var gangNum = calculateGang(seatData);
    if (gangNum != 2) {
        return 0;
    }

    var pairCount = 0;
    var singleCount = 0;
    var numOfJings = 0;
    for (var k in seatData.countMap) {
        var c = seatData.countMap[k];
        if (jingMap[k] == true) {
            numOfJings += c;
        } else if (c == 1) {
            singleCount++;
        } else if (c == 2) {
            pairCount++;
        } else if (c == 3) {
            pairCount++;
            singleCount++;
        } else if (c == 4) {
            pairCount += 2;
        }
    }

    if (pairCount >= 3) {
        return 1;
    }

    if (checkJings) {
        var jingPairCount = 0;
        if(singleCount >= numOfJings) {
            jingPairCount = numOfJings;
        } else {
            jingPairCount = singleCount + Math.floor(numOfJings / 2);
        }
        if (pairCount + jingPairCount >= 3) {
            return 2;
        }
    }

    return 0;
};

exports.is4Melds = function (jm, seatData, checkJings, chupai) {
    jingMap = jm;
    if (seatData.chis && seatData.chis.length > 0) {
        return false;
    }

    numOfJings = 0;
    for (var k in seatData.countMap) {
        if (jingMap[k] == true) {
            var c = seatData.countMap[k];
            numOfJings += c;
        }
    }
    if (jingMap[chupai] == true) {
        numOfJings -= 1;
    }
    var hasJing = numOfJings > 0;

    var fn = function (seatData, jingMode) {
        var oldJingMap = null;
        if (jingMode) {
            if (hasJing == false) {
                return false;
            }
            oldJingMap = storeJingMap(seatData, chupai);
        }

        var meldCount = 0;
        var pairCount = 0;
        var singleCount = 0;
        for (var k in seatData.countMap) {
            var c = seatData.countMap[k];
            if (c == 1) {
                singleCount++;
            }
            else if (c == 2) {
                pairCount++;
            }
            else if (c == 3) {
                meldCount++;
            }
            else if (c == 4) {
                meldCount++;
                singleCount++;
            }
        }

        restoreJingMap(seatData, oldJingMap);

        if (jingMode) {
            //扣除一对将后，其余的要组成一坎
            var needJing = 0;
            if (pairCount > 0) {
                needJing = (pairCount - 1) + singleCount * 2;
            }
            else {
                needJing = (singleCount - 1) * 2 + 1;
            }
            if (needJing > numOfJings) {
                return false;
            }
            return true;
        }
        else {
            //无精的话，必须要满足 只有一对将，且无单牌
            if (pairCount != 1 || singleCount > 0) {
                return false;
            }
            return true;
        }
    }

    var ret = fn(seatData, false);
    if (ret) {
        return 1;
    }
    if (checkJings) {
        ret = fn(seatData, true);
        if (ret) {
            return 2;
        }
    }
    return 0;
};

exports.checkTingPai = function (seatData, begin, end) {
    for (var i = begin; i < end; ++i) {
        //如果这牌已经在和了，就不用检查了
        if (seatData.tingMap[i] != null) {
            continue;
        }
        //将牌加入到计数中
        var old = seatData.countMap[i];
        if (old == null) {
            old = 0;
            seatData.countMap[i] = 1;
        }
        else {
            seatData.countMap[i]++;
        }

        seatData.holds.push(i);
        //逐个判定手上的牌
        var ret = exports.checkCanHu(seatData);
        if (ret) {
            //平胡 0番
            seatData.tingMap[i] = {
                pattern: "normal",
                fan: 0
            };
        }

        //搞完以后，撤消刚刚加的牌
        seatData.countMap[i] = old;
        seatData.holds.pop();
    }
};

exports.getMJType = function (pai) {
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
    else if (id >= 27 && id < 34) {
        //字
        return 3;
    }
}