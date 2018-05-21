var crypto = require('../../externals/utils/crypto');
var db = require('../../externals/utils/dbsync');
var http = require('../../externals/utils/http');
var comdef = require('../config');

const cashChangeReasons = comdef.CASH_CHANGE_RESONS;

var config = null;

const MAX_LUCKY_MSG = 20;
var luckyMsgList = [];

var propCtrlMap = {};
function updatePropCtrl(awards) {
    var len = awards ? awards.length : 0;
    for (var i = 0; i < len; i++) {
        var award = awards[i];
        if (award == null) {
            continue;
        }

        var ctrlItem = propCtrlMap[award.id];
        if (ctrlItem && ctrlItem.prop != award.prop) {
            ctrlItem.prop = award.prop;
            ctrlItem.usedCnt = 0;
            ctrlItem.ctrlCnt = Math.ceil(10000 / award.prop);
            ctrlItem.ignoreCtrlCnt = false;
        } else if (ctrlItem == null) {
            propCtrlMap[award.id] = {
                prop: award.prop,
                usedCnt: 0,
                ctrlCnt: Math.ceil(10000 / award.prop),
                ignoreCtrlCnt: false
            };
        }

        if (i == 0) {
            propCtrlMap[award.id].ignoreCtrlCnt = true;
        }
    }
}

function clonePropCtrlMap(ctrlMap) {
    var tempPropMap = {};
    ctrlMap = ctrlMap ? ctrlMap : propCtrlMap;
    for (var awardId in ctrlMap) {
        var ctrlItem = ctrlMap[awardId];
        tempPropMap[awardId] = {
            prop: ctrlItem.prop,
            usedCnt: ctrlItem.usedCnt,
            ctrlCnt: ctrlItem.ctrlCnt,
            ignoreCtrlCnt: ctrlItem.ignoreCtrlCnt,
        };
    }
    return tempPropMap;
}

function isPropEnable(awardId, ctrlMap) {
    ctrlMap = ctrlMap ? ctrlMap : propCtrlMap;
    var ctrlItem = ctrlMap[awardId];
    if (ctrlItem == null) {
        return false;
    }

    return ctrlItem.ignoreCtrlCnt == true || ctrlItem.usedCnt >= ctrlItem.ctrlCnt;
}

function incrPropCtrl(num, ctrlMap) {
    ctrlMap = ctrlMap ? ctrlMap : propCtrlMap;
    for (var awardId in ctrlMap) {
        var ctrlItem = ctrlMap[awardId];
        ctrlItem.usedCnt += num;
    }
}

function clearPropCtrl(awards, ctrlMap) {
    if (awards == null) {
        return;
    }

    ctrlMap = ctrlMap ? ctrlMap : propCtrlMap;
    for (var i in awards) {
        var award = awards[i];
        if (award == null) {
            continue;
        }
        var awardId = award.id;
        var ctrlItem = ctrlMap[awardId];
        if (ctrlItem) {
            ctrlItem.usedCnt = 0;
        }
    }
}

var userMap = {};
function checkGetLuckyTime(userId) {
    var now = Date.now();
    var item = userMap[userId];
    if (item == null) {
        userMap[userId] = {
            lastTime: now,
        }
        return true;
    } else {
        var lastTime = item.lastTime;
        item.lastTime = now;
        return now - lastTime >= 2000;
    }
}

function getZeroTimeOfToday() {
    //当前日期的00:00:00的时间戳
    var today = new Date();
    var dateStr = '{0}-{1}-{2} {3}:{4}:{5}';
    dateStr = dateStr.format(today.getFullYear(), today.getMonth() + 1, today.getDate(), 0, 0, 0);
    return Math.ceil(Date.parse(dateStr) * 0.001);
}

function getLuckyConfigs(needProp, needLock, filterZero) {
    // //获取配置
    // var tempConfigs = db.get_configs();
    // if (tempConfigs == null) {
    //     console.log('[Error] - configs is null');
    //     return null;
    // }

    // //获取每日签到配置字串
    // tempConfigs = tempConfigs.lucky_wheel_configs;
    // if (tempConfigs == null) {
    //     console.log('[Error] - cant get lucky configs');
    //     return null;
    // }

    var configs = {};

    // configs.costs = JSON.parse(tempConfigs);

    //1-coin，2-gems，3-rmb，4-other
    tempConfigs = db.getLuckyAwardConfigs(needProp, needLock, filterZero);
    if (tempConfigs == null) {
        console.log('[Error] - cant get lucky configs');
        return null;
    }
    configs.awards = tempConfigs;

    if (configs == null) {
        console.log('[Error] - parse configs string failed.');
        return null;
    }

    if (needProp && filterZero) {
        updatePropCtrl(configs.awards);
    }

    return configs.awards;
}

function checkAccount(req, res) {
    var account = req.query.account;
    var sign = req.query.sign;
    if (account == null || sign == null) {
        http.send(res, -1, "unknown error");
        return null;
    }

    // var serverSign = crypto.md5(account +req.ip+ config.ACCOUNT_PRI_KEY);
    // if (serverSign != sign) {
    //     http.send(res, -2, "verify sign failed.");
    //     return null;
    // }

    var userData = db.get_user_data(account);
    if (userData == null) {
        http.send(res, -3, 'cant get user data');
        return null;
    }

    return userData;
}

function resetLuckyData(data) {
    data = data ? data : {};
    data.last_lucky_wheel_time = 0;
    data.lucky_wheel_cnt = 0;
    data.lock_id = 0;
    return data;
}

function calcCost(count, costConfig, cnt) {
    if (count > 1) {
        if (cnt < costConfig.free_cnt) {
            count = count - (costConfig.free_cnt - cnt);
            count = count < 0 ? 0 : count;
        }

        var discount = 100;
        if (count >= 10) {
            discount = costConfig.gameble_discount;
        }
        return Math.floor(costConfig.cost.num * count * discount * 0.01);
    } else {
        if (cnt < costConfig.free_cnt) {
            return 0;
        } else {
            return costConfig.cost.num;
        }
    }
}

function recordLuckyMsg(msgList) {
    if (msgList == null) {
        return;
    }
    var shiftNum = msgList.length - (20 - luckyMsgList.length);
    shiftNum = shiftNum < 0 ? 0 : shiftNum;
    for (var i = 0; i < shiftNum; i++) {
        luckyMsgList.shift();
    }

    luckyMsgList = luckyMsgList.concat(msgList);
}

exports.start = function (encryptRoutMgr, app, conf) {
    config = conf;
    encryptRoutMgr.get('/get_luckywheel_data', function (req, res) {
        var userData = checkAccount(req, res);
        if (userData == null) {
            return;
        }

        var userId = userData.userid;

        var luckyConfigs = getLuckyConfigs(false, false, false);
        // console.log('游戏奖品配置列表：',luckyConfigs);
        if (luckyConfigs == null) {
            http.send(res, -4, 'cant get configs');
            return;
        }
        //获取今天零点时间戳，昨天的数小于今天
        var date = new Date();
        var lastNight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        var timestamp = lastNight.getTime();

        var lottery = userData.lottery;

        if (lottery == null) {//第一次
            lottery = {
                lotteryTimes: 0,
                HasShare: false,
                playTimes: 0,
                dateTime: 0//保存数据修改时间
            }
            var updateLottery = db.update_lottery(userId, JSON.stringify(lottery))
        } else {
            lottery = JSON.parse(userData.lottery);
            // console.log(lottery.dateTime)
            // console.log(timestamp)
            if (lottery.dateTime < timestamp) {
                //新的一天重置数据
                lottery = {
                    lotteryTimes: lottery.lotteryTimes,
                    HasShare: false,
                    playTimes: 0,
                    dateTime: timestamp//保存数据修改时间
                }
                var updateLottery = db.update_lottery(userId, JSON.stringify(lottery))
            }
        }
        var luckyData = db.getLuckyData(userId);
        var ret = {
            lucky_cnt: lottery.lotteryTimes,
            hasShare: lottery.HasShare,
            playTimes: lottery.playTimes,
            awards: luckyConfigs,
            // luckymsgs: luckyMsgList,
        };


        var now = Math.ceil(Date.now() * 0.001);
        //获取今天凌晨0：00时间戳
        var zeroToday = getZeroTimeOfToday();
        if (luckyData) {
            if (luckyData.last_lucky_wheel_time < zeroToday) {
                db.resetLuckyData(userId);
                luckyData = resetLuckyData(luckyData);
            } else {
                ret.cnt = luckyData.lucky_wheel_cnt;
            }
        } else {
            db.createLuckyData(userId);
        }
        http.send(res, RET_OK, ret);
    });

    encryptRoutMgr.get('/get_lucky', function (req, res) {
        //return http.send(res, -15, 'the frequency is too high');
        var userData = checkAccount(req, res);
        if (userData == null) {
            return;
        }
        //查询该玩家拥有的抽奖次数
        var temp =  db.get_user_data_by_userid(userData.userid);
        if (temp == null) {
            http.send(res, { code: 101, msg: '查询数据库出错,没有该玩家' });
            return;
        }
        
        if (1 > temp.luckynum) {
            http.send(res, { code: 102, msg: '玩家今天的抽奖次数已无' });
            return;
        }
        // console.log('req:',req.query)
        var usegems = Boolean(req.query.usegems);//无抽奖次数时使用钻石抽奖
        // console.log('usegems:',typeof(usegems))
        // console.log('userData.lottery',usegems != true)
        // console.log('typeof[lottery]:',typeof(userData.lottery))
        // 检查时间，不能频繁操作
        if (checkGetLuckyTime(userData.userid) == false && usegems !== true) {
            http.send(res, -15, 'the frequency is too high');
            return;
        }
        var lottery = JSON.parse(userData.lottery);
        console.log('userData.lottery:', lottery)
        console.log('userData.lottery:', typeof (lottery))

        var luckyOperation = function (usegems, gems) {
            var userId = userData.userid;
            var count = parseInt(req.query.count);
            count = isNaN(count) ? 1 : count;

            var luckyConfigs = getLuckyConfigs(true, true, true);
            if (luckyConfigs == null) {
                http.send(res, -4, 'cant get configs');
                return;
            }

            var luckyData = db.getLuckyData(userId);
            var ret = {
                realAward: null,
                awards: [],
                // luckymsgs: [],
            }

            var now = Math.ceil(Date.now() * 0.001);
            var zeroToday = getZeroTimeOfToday();
            if (luckyData) {
                // 判断是否需要重置
                if (luckyData.last_lucky_wheel_time < zeroToday) {
                    db.resetLuckyData(userId);
                    luckyData = resetLuckyData(luckyData);
                }
            } else {
                if (!db.createLuckyData(userId)) {
                    http.send(res, -6, 'get lucky failed');
                    return;
                }

                luckyData = resetLuckyData(luckyData);
            }
            //#region 
            // //计算费用
            // var costConfig = luckyConfigs.costs;
            // if (costConfig == null) {
            //     http.send(res, -9, 'cant get cost config.');
            //     return;
            // }

            //扣费
            // var totalCost = calcCost(count, costConfig, luckyData.lucky_cnt);

            // var enough = false;
            // var addFunc = null;
            // var costFunc = null;
            // if (costConfig.cost.type == 1) {
            //     enough = userData.coins >= totalCost;
            //     addFunc = db.add_user_coins;
            //     costFunc = db.cost_coins;
            // } else if (costConfig.cost.type == 2) {
            //     enough = userData.gems >= totalCost;
            //     addFunc = db.add_user_gems;
            //     costFunc = db.cost_gems;
            // }

            // if (costFunc == null || addFunc == null) {
            //     http.send(res, -10, 'undefined cost type');
            //     return;
            // }

            // if (!enough) {
            //     http.send(res, -11, 'cash is not enough');
            //     return;
            // }
            //#endregion
            //对奖品按概率从大到小排序，然后修正概率，使得总概率为1
            //奖品概率排序
            var awardsConfigs = luckyConfigs;

            //奖品概率修正
            var totalProp = 0;
            var availAwards = [];
            var awardConfig = null;
            for (var i in awardsConfigs) {
                awardConfig = awardsConfigs[i];
                if (awardConfig.prop <= 0) {
                    continue;
                }

                var leftProp = 10000 - totalProp;
                if (leftProp > 0) {
                    if (awardConfig.prop <= leftProp) {

                    } else {
                        awardConfig.prop = leftProp;
                    }
                    totalProp += awardConfig.prop;
                    availAwards.push(awardConfig);
                }
            }

            //按概率计算奖品
            var awardsMap = {};
            var awardsList = [];
            var awardDatas = {};
            var tmpPropCtrl = clonePropCtrlMap(propCtrlMap);
            for (var i = 0; i < count; i++) {
                var prop = Math.ceil((Math.random() * 10000));
                var lastProp = 0;
                var index = 0;
                var len = availAwards.length;
                for (var k = 0; k < len; k++) {
                    awardConfig = availAwards[k];
                    index = k;
                    if (lastProp <= prop && prop < awardConfig.prop + lastProp) {
                        // 概率满足，理论上中奖
                        break;
                    }

                    lastProp += awardConfig.prop;
                }

                // 按正常概率未中奖则降级处理
                var awardData = null;
                for (var j = index; j >= 0; j--) {
                    awardConfig = availAwards[j];
                    awardData = awardDatas[awardConfig.id];
                    if (awardData == null) {
                        awardData = { cnt: awardConfig.cnt, lockId: awardConfig.lock_id, costNum: 0 };
                    }
                    if (awardData.cnt > 0 && isPropEnable(awardConfig.id, tmpPropCtrl)) {
                        break;
                    } else {
                        awardConfig = null;
                    }
                }

                if (awardConfig == null || awardData == null) {
                    if (usegems) {
                        console.log('奖品数量不足，返还玩家钻石x4')
                        db.add_user_gems(userId, 4)
                    }
                    http.send(res, -8, 'get nothing OR prize is none');
                    return;
                }

                awardData.cnt -= 1;
                awardData.costNum += 1;
                awardDatas[awardConfig.id] = awardData;

                if ((awardConfig.type == 1 && awardConfig.num >= 50000) ||
                    (awardConfig.type == 2 && awardConfig.num >= 5) ||
                    (awardConfig.type >= 4)) {
                    awardsList.push({
                        user_id: userId,
                        name: userData.name,
                        award_name: awardConfig.name,
                        type: awardConfig.type,
                        num: awardConfig.num,
                    });
                }

                var award = awardsMap[awardConfig.name];
                if (award && award.type == awardConfig.type) {
                    award.num += awardConfig.num;
                } else if (award == null) {
                    awardsMap[awardConfig.name] = {
                        type: awardConfig.type,
                        num: awardConfig.num
                    };
                }

                // console.log('获得奖励,名字:' + awardConfig.name + ', id:' + awardConfig.id);
                ret.awards.push({
                    name: awardConfig.name,
                    gain_type: awardConfig.type,
                    gain: awardConfig.num,
                    id: awardConfig.id
                });

                incrPropCtrl(1, tmpPropCtrl);
                clearPropCtrl([{ id: awardConfig.id }], tmpPropCtrl);
            }

            // //扣费
            // if (!costFunc(userId, totalCost, cashChangeReasons.COST_BY_LUKY)) {
            //     http.send(res, -12, 'cost cash failed');
            //     return;
            // }

            var subCntSuc = true;
            for (var id in awardDatas) {
                var awardData = awardDatas[id];
                subCntSuc = subCntSuc && db.subLuckyAwardsCnt(id, awardData.costNum, awardData.lockId);
                if (subCntSuc == false) {
                    break;
                }
            }

            //发放奖励
            var retAddAwards = false;
            //发放标记
            var hasRealAward = false;
            if (subCntSuc && db.getLucky(userId, count)) {

                //金币和钻石立即发放，其他通知玩家领取
                // console.log("awardsMap")
                // console.log(awardsMap)
                for (var key in awardsMap) {
                    var award = awardsMap[key];
                    // console.log("award.type")     
                    // console.log(award.type)
                    //类型1 添加礼券 创建礼券流水记录
                    if (award.type == 1) {
                        ret.coupon = award.num;
                        //给邀请人添加礼券
                        var player1 = db.add_user_coupon(userId, award.num);
                        var DK1 = 'BK' + Date.now() + Math.floor(Math.random() * 1000) + userId;
                        //1.玩家id 2.创建礼券单号 3.礼券数量 4.房卡数量 5.1代表 活动状态 2代表 税换状态
                        db.create_pay_coupon(userId, DK1, award.num, null, 1);
                    } else if (award.type == 2) {
                        db.add_user_gems(userId, award.num, cashChangeReasons.ADD_BY_LUCKY);
                    } else if (award.type == 3) {
                        console.log('没中奖，谢谢惠顾')
                    } else {
                        hasRealAward = true;
                    }
                }

                retAddAwards = true;
            }

            // if (retAddAwards != true) {
            //     addFunc(userId, totalCost, cashChangeReasons.RETURN_LUCKY);
            //     http.send(res, -13, 'get lucky failed');
            //     return;
            // }

            // 增加概率控制的使用次数
            incrPropCtrl(count);
            // 中奖的东西次数清零
            clearPropCtrl(ret.awards);

            //消息记录
            recordLuckyMsg(awardsList);
            ret.luckymsgs = luckyMsgList;

            var awardState = hasRealAward ? 0 : 1;
            var realAward = hasRealAward ? 1 : 0;
            var cost = usegems ? 4 : 0;
            var welfareId = db.addWelfareRecord(userId, 2, 0, cost, realAward, awardsMap, awardState, '幸运转盘' + count + '连抽');
            if (hasRealAward && welfareId != null) {
                ret.realAward = welfareId;
            }
            //  console.log('中奖后：',lottery);
            if (!usegems) {
                lottery.lotteryTimes = lottery.lotteryTimes - 1;
                ret.lucky_cnt = lottery.lotteryTimes;
                // console.log('JSON.stringify(lottery)',JSON.stringify(lottery));
                var updateLottery = db.update_lottery(userId, JSON.stringify(lottery))
            } else {
                ret.lucky_cnt = 0;
                ret.gems = gems;
            }
            console.log('用户[' + userId + ']抽奖信息：', ret.awards);
            ret.id = ret.awards[0].id;

            //扣除玩家抽奖次数
            db.sub_user_luckynum(userId,1);
            http.send(res, RET_OK, ret);

        }

        if (!usegems) {//不使用钻石抽奖的情况下

            //   if(lottery == null){//第一次
            //       // lottery = {
            //       //     lotteryTimes:10,
            //       //     HasShare:false,
            //       //     playTimes:0,
            //       //     dateTime:0//保存数据修改时间
            //       // }

            //       http.send(res, -1, '抽奖次数不足');
            //       return;
            //   }else{

            //       lottery = JSON.parse(userData.lottery);
            //       if(lottery.lotteryTimes <= 0){
            //           // lottery.lotteryTimes = 10
            //           http.send(res, -1, '抽奖次数不足');
            //           return;
            //       }
            //   }
            luckyOperation();
        } else {//使用钻石抽奖的情况
            var ret = db.get_gems(userData.account);

            if (ret.gems < 4) {
                console.log('钻石不足，无法兑换抽奖');
                http.send(res, -2, '钻石不足，无法兑换抽奖!');
                return;
            } else {
                var success = db.cost_gems(userData.userid, 4);
                if (!success) {
                    http.send(res, -1, '扣钻失败，无法兑换抽奖!');
                    return;
                } else {
                    console.log('无抽奖机会使用钻石抽奖');

                    luckyOperation(true, ret.gems - 4);
                }
            }
        }

    });

    //获取中奖纪录
    encryptRoutMgr.get('/get_welfare_records_by_id', function (req, res) {
        if (!checkAccount(req, res)) {
            return;
        }
        var userid = req.query.userId;
        var data = db.get_welfare_records_by_id(userid, 0, 10);

        if (data) {
            http.send(res, RET_OK, { data: data });
        }
        else {
            http.send(res, 1, "null");
        }

    });

    encryptRoutMgr.get('/get_lucky_msg', function (req, res) {
        var userData = checkAccount(req, res);
        if (userData == null) {
            return;
        }

        http.send(res, 0, 'ok', { luckymsgs: luckyMsgList });
    });

    encryptRoutMgr.get('/reg_award_user_info', function (req, res) {
        var userData = checkAccount(req);
        if (userData == null) {
            return;
        }

        var userId = userData.userid;

        var awardRecordId = req.query.award_record_id;
        awardRecordId = awardRecordId == '' ? null : awardRecordId;

        var name = req.query.name;
        name = name == '' ? null : name;

        var phone = req.query.phone;
        phone = phone == '' ? null : phone;

        var cardId = req.query.card_id;
        cardId = cardId == '' ? null : cardId;

        if (userId == null || awardRecordId == null
            || name == null || phone == null
            || cardId == null) {
            http.send(res, 1, 'invalid parameters');
            return;
        }

        var ret = db.regAwardUserInfo(awardRecordId, userId, name, cardId, phone);
        if (!ret) {
            http.send(res, -3, 'reg user info faild.');
            return;
        }

        http.send(res, 0, 'ok');
    });


    encryptRoutMgr.get('/share_lottery', function (req, res) {
        if (!checkAccount(req, res)) {
            return;
        }

        var data = req.query;
        var account = data.account;
        var userId = data.userid;
        // console.log(data);
        db.get_lottery_msg_Id(userId, function (data) {
            if (data == 1) {
                console.log('获取抽奖信息失败！');
                http.send(res, 2, '获取抽奖信息失败！');
                return;
            }
            if (data == 2) {
                console.log('lottery 为空！');
                http.send(res, 1, 'lottery 为空！');
                return;
            }
            var date = new Date();
            var lastNight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            var timestamp = lastNight.getTime();

            console.log('----time', timestamp);
            var lottery = JSON.parse(data.lottery);
            console.log('----data', lottery);
            if (lottery == null) {//第一次参与分享活动
                lottery = {
                    lotteryTimes: 0,//1,
                    HasShare: true,
                    playTimes: 0,
                    dateTime: timestamp//保存数据修改时间
                }
            } else {
                if (lottery.HasShare == false) {
                    console.log('第二天数据重置')
                    lottery.lotteryTimes = lottery.lotteryTimes;// + 1;//活动分享不给抽奖机会了
                    lottery.HasShare = true;
                    lottery.playTimes = lottery.playTimes;
                    lottery.dateTime = Date.now();
                } else {
                    http.send(res, 1, 'has share today!');

                    console.log('今天已经分享过，不能添加抽奖机会！');
                    return;
                }

            }

            var temp = JSON.stringify(lottery);

            console.log('分享成功，抽奖机会+1！');
            db.update_lottery(userId, temp, function (data) {
                if (data == 1) {
                    console.log('update err,无法插入数据到数据库！');
                    http.send(res, 2, 'update err,无法插入数据到数据库！');
                } else if (data == 0) {
                    http.send(res, 0, 'ok', { lucky_cnt: lottery.lotteryTimes });
                    console.log(userId + ' 的 lottery数据更新成功');
                }
            });
        })

    });
};