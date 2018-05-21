var dbpool = require('./dbpool');
var crypto = require('./crypto');
var consts = require('./consts');
const CASH_CHANGE_RESONS = consts.CashChangeResons;

function generateUserId() {
    var Id = "";
    for (var i = 0; i < 6; ++i) {
        if (i > 0) {
            Id += Math.floor(Math.random() * 10);
        }
        else {
            Id += Math.floor(Math.random() * 9) + 1;
        }
    }
    return Id;
}



/**
 * 获取特定游戏类型+模式下房间数据表名称
 * @param {String} gameType 
 * @param {String} gameMode 
 */
function getRoomTabName(gameType, gameMode) {
    if (gameType == null || gameMode == null) {
        return null;
    }

    //游戏类型ID转缩写
    gameType = consts.GameID2Type[gameType];
    if (gameType == null) {
        return null;
    }

    return 't_' + gameType + '_norm_rooms';
}

/**
 * 获取特定游戏类型+模式下房间打包数据表名称
 * @param {String} gameType 
 * @param {String} gameMode 
 */
function getRoomArchiveTabName(gameType, gameMode) {
    if (gameType == null || gameMode == null) {
        return null;
    }

    //游戏类型ID转缩写
    gameType = consts.GameID2Type[gameType];
    if (gameType == null) {
        return null;
    }

    return 't_' + gameType + '_' + gameMode + '_rooms_archive';
}

/**
 * 获取特定游戏类型+模式下游戏数据表名称
 * @param {String} gameType 
 * @param {String} gameMode 
 */
function getGameTabName(gameType, gameMode) {
    if (gameType == null || gameMode == null) {
        return null;
    }

    //游戏类型ID转缩写
    gameType = consts.GameID2Type[gameType];
    if (gameType == null) {
        return null;
    }

    return 't_' + gameType + '_' + gameMode + '_games';
}

/**
 * 获取特定游戏类型+模式下游戏打包数据表名称
 * @param {String} gameType 
 * @param {String} gameMode 
 */
function getGameArchiveTabName(gameType, gameMode) {
    if (gameType == null || gameMode == null) {
        return null;
    }

    //游戏类型ID转缩写
    gameType = consts.GameID2Type[gameType];
    if (gameType == null) {
        return null;
    }

    return 't_' + gameType + '_' + gameMode + '_games_archive';
}

function getHistoryTabName(gameType, gameMode) {
    if (gameType == null || gameMode == null) {
        return null;
    }

    //游戏类型ID转缩写
    gameType = consts.GameID2Type[gameType];
    if (gameType == null) {
        return null;
    }

    return 't_' + gameType + '_' + gameMode + '_history';
}

/**
 * 初始化数据库模块
 * @param {Object} config 数据库参数
 */
exports.init = function (config) {
    dbpool.init(config);
};

/**
 * 通过token获取用户数据
 * @param {String} token 玩家token
 */
exports.get_userdata_by_token = function (token) {
    if (token == null || token == '') {
        return null;
    }

    var sql = 'SELECT * FROM t_users WHERE token = "' + token + '"';
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    } else {
        var data = ret.rows[0];
        data.name = crypto.fromBase64(data.name);
        return data;
    }
};

/**
 * 更新玩家token
 * @param {Number} userId 玩家ID
 * @param {String} token  token
 */
exports.update_token_of_user = function (userId, token) {
    if (userId == null || token == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET token = "' + token + '" WHERE userid = ' + userId;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
}

/**
 * 判断账号是否存在
 * @param {String} account 玩家账号
 */
exports.is_account_exist = function (account) {
    if (account == null) {
        return false;
    }

    var sql = 'SELECT * FROM t_accounts WHERE account = "' + account + '"';
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    } else {
        return ret.rows.length > 0;
    }
};

/**
 * 新建账号
 * @param {String} account  账号
 * @param {String} password 账号密码
 */
exports.create_account = function (account, password) {
    if (account == null || password == null) {
        return false;
    }

    var psw = crypto.md5(password);
    var sql = 'INSERT INTO t_accounts(account,password) VALUES("' + account + '","' + psw + '")';
    var ret = dbpool.query(sql);
    return ret.err == null;
};

exports.get_account_info = function (account, password) {
    if (account == null) {
        return null;
    }

    var sql = 'SELECT * FROM t_accounts WHERE account = "' + account + '"';
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    if (password != null) {
        var psw = crypto.md5(password);
        if (ret.rows[0].password != psw) {
            return null;
        }
    }
    return ret.rows[0];
};

exports.is_user_exist = function (account) {
    if (account == null) {
        return false;
    }

    var sql = 'SELECT userid FROM t_users WHERE account = "' + account + '"';
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }
    else {
        return ret.rows.length > 0;
    }
}


exports.get_user_data = function (account) {
    if (account == null) {
        return null;
    }

    // var sql = 'SELECT userid, account, name, lv, exp, coins, gems, roomid, gametype, gamemode,last_share_time FROM t_users WHERE account = "' + account + '"';
    var sql = 'SELECT * FROM t_users WHERE account = "' + account + '"';
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ---get_user_data--account:[" + account + "]", ret.err);
        return null;
    }

    if (ret.rows.length == 0) {
        return null;
    }

    var data = ret.rows[0];
    data.name = crypto.fromBase64(data.name);
    return data;
};
//查询有没有这个玩家
exports.get_user_data_by_userid = function (userid) {
    if (userid == null) {
        return null;
    }

    var sql = 'SELECT * FROM t_users WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----get_user_data_by_userid--userid:[" + userid + "]", ret.err);
        return null;
    } else if (ret.rows.length == 0) {
        return null;
    }

    var data = ret.rows[0];
    data.name = crypto.fromBase64(data.name);
    return data;

};


//查询玩家的房间和类型
exports.get_user_roomid = function (userid) {
    if (userid == null) {
        return null;
    }

    var sql = 'SELECT roomid,gametype FROM t_users WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----get_user_roomid--userid:[" + userid + "]", ret.err);
        return null;
    }

    if (!ret.rows || ret.rows.length == 0) {
        return null;
    }

    return ret.rows[0];
};

exports.add_share_gems = function (account, gems, luckynum, timestamp) {
    // callback = callback == null ? nop : callback;
    var sql = 'UPDATE t_users SET gems = gems +' + gems + ',' + 'last_share_time=' + Date.now() + ',' + 'luckynum = luckynum +' + luckynum + ' WHERE account = "' + account + '"';
    // console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }
    var affected = ret.rows.affectedRows > 0;
    return affected;
};

/**增加玩家房卡 */
exports.add_user_gems = function (userid, gems, log) {
    if (userid == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET gems = gems +' + gems + ' WHERE userid = ' + userid;
    // console.log(sql)
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    //如果变更成功，则添加变更记录
    var affected = ret.rows.affectedRows > 0;
    if (affected && false) {
        //log cash changes
        exports.record_gem_change(userid, gems, log);
    }

    return affected;
};

/**增加玩家房卡 */
exports.add_user_gemstow = function (userid, gems) {
    if (userid == null || gems == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET gems = gems +' + gems + ' WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    //如果变更成功，则添加变更记录
    var affected = ret.rows.affectedRows > 0;
    return affected;
};

/**
 * 增加玩家金币
 */
exports.add_user_coins = function (userid, coins, log) {
    if (userid == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET coins = coins +' + coins + ' WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    //如果变更成功，则添加变更记录
    var affected = ret.rows.affectedRows > 0;
    if (affected) {
        //log cash changes
        //exports.record_coin_change(userid, coins, log);
    }
    return affected;
};

exports.gems_buy_coins = function (userid, gems, coins) {
    if (!userid || !gems || !coins) {
        return false;
    }

    var sql = 'UPDATE t_users SET coins = coins +' + coins + ',gems = gems - ' + gems + ' WHERE userid = ' + userid + ' AND gems >= ' + gems;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    //如果变更成功，则添加变更记录
    var affected = ret.rows.affectedRows > 0;
    if (affected) {
        //log cash changes
        exports.record_gem_change(userid, -gems, CASH_CHANGE_RESONS.COST_BUY_COIN.format(coins));
        exports.record_coin_change(userid, coins, CASH_CHANGE_RESONS.ADD_EXCHANGE_GEMS);
    }

    return affected;
};

exports.get_gems = function (account) {
    if (account == null) {
        return null;
    }

    var sql = 'SELECT gems,coupon,luckynum,gamedaynum FROM t_users WHERE account = "' + account + '"';
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows[0];
};

exports.get_coupon = function (userid) {
    if (userid == null) {
        return null;
    }
    var sql = 'SELECT coupon FROM t_users WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----get_coupon--userId:[" + userid + "]", ret.err);
        return false;
    }

    if (ret.rows.length == 0) {
        return false;
    }

    return ret.rows[0];
};

exports.get_gems_by_userid = function (userid) {
    if (userid == null) {
        return 0;
    }

    var sql = 'SELECT gems FROM t_users WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----get_gems_by_userid--userId:[" + userid + "]", ret.err);
        return null;
    } else if (ret.rows.length == 0) {
        return null;
    }

    var data = ret.rows[0];
    return data.gems;
};

exports.has_bound_agent = function (userid) {
    var sql = 'SELECT userid FROM t_users WHERE userid = ' + userid + ' AND agent IS NOT NULL';
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return false;
    }
    return true;
};

exports.bind_agent = function (account, agentId, gems) {
    var sql = 'UPDATE t_users SET gems = gems +' + gems + ', ' + 'agent = "' + agentId + '" WHERE account = "' + account + '" AND agent IS NULL';
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    var affected = ret.rows.affectedRows > 0;
    if (true == affected) {
        sql = "SELECT userid FROM t_users WHERE account = '" + account + "'";
        ret = dbpool.query(sql);
        if (!ret.err) {
            exports.record_gem_change(ret.rows[0].userid, gems, CASH_CHANGE_RESONS.ADD_BIND_INVITOR.format(agentId));
        }
    }
    return affected;
};
//绑定代理  ----- start 
exports.is_user_bind_to_agent = function (account) {
    if (account == null) {
        return false;
    }
    var sql = 'SELECT agent FROM t_users WHERE account = "' + account + '"';
    ret = dbpool.query(sql);
    if (ret.err) {
        return null;
    }

    if (ret.rows.length === 0) {
        return 1;
    } else if (ret.rows.length == 1) {
        if (ret.rows[0].agent == null) {
            return 0;
        } else {
            return 2;
        }
    }
    return 2;
}

exports.set_agent_of_user = function (account, agent) {
    if (account == null) {
        return false;
    }
    if (agent != null) {
        agent = '"' + agent + '"';
    }
    var sql = 'UPDATE t_users SET agent = ' + agent + ' WHERE account = "' + account + '"';
    ret = dbpool.query(sql);
    if (ret.err) {
        return 1;
    } else {
        return 0;
    }
};

exports.update_user_agent = function (userid, agent) {


    var sql = `UPDATE t_users SET agent ='${agent}' where userid = ${userid}`;
    ret = dbpool.query(sql);
    if (ret.err) {
        return 1;
    } else {
        return 0;
    }
};

//绑定代理  ----- end

exports.get_users_num_by_agent = function (agentId) {
    if (agentId == null) {
        return null;
    }

    var sql = "SELECT userid FROM t_users WHERE agent = '" + agentId + "'";
    var ret = dbpool.query(sql);
    if (ret.err) {
        return 0;
    }

    return ret.rows.length;
};

exports.get_users_by_agent = function (agents, start, rows) {
    if (agents == null) {
        return null;
    }

    var agentset = '(';
    var num = 0;
    for (var i in agents) {
        var agent = agents[i];
        agentset += (num > 0 ? ',' : '') + "'" + agent + "'";
        num++;
    }
    agentset = agentset + ')';

    var limitSql = '';
    if (start != null && rows != null) {
        limitSql = ' LIMIT ' + start + ', ' + rows;
    }

    var sql = 'SELECT userid, agent FROM t_users' + ' WHERE agent IN ' + agentset + ' ORDER BY create_time ASC ' + limitSql;
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows;
};

exports.create_user_history = function (gameType, gameMode, userId, roomUUID) {
    var tableName = getHistoryTabName(gameType, gameMode);
    if (tableName == null || userId == null || roomUUID == null) {
        return false;
    }

    var sql = "INSERT INTO " + tableName + "(room_uuid, user_id) VALUES('" + roomUUID + "', " + userId + ")";
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG]--create_user_history-->userId:[" + userId + "]", ret.err);
        return false;
    }

    return true;
};

exports.get_user_history = function (gameType, gameMode, userId) {
    gameType = consts.GameID2Type[gameType];
    if (gameType == null) {
        return null;
    }

    var historyTabName = 't_' + gameType + '_' + gameMode + '_history';
    var tableName = 't_' + gameType + '_' + gameMode + '_rooms_archive';
    if (historyTabName == null || tableName == null) {
        return null;
    }

    var condStr = "";
    // if (userId != null) {
    //     condStr += ("WHERE user_id = " + userId);
    // }
    //var sql = "SELECT * FROM " + tableName + " WHERE uuid in(SELECT room_uuid FROM " + historyTabName + " " + condStr + ") ORDER BY create_time DESC";
    var sql = `SELECT ${tableName}.* FROM  ${tableName} left join
        ${historyTabName} on  ${tableName}.uuid = ${historyTabName}.room_uuid 
        WHERE   ${historyTabName}.user_id = ${userId} ORDER BY  ${tableName}.create_time DESC`
    // console.log(sql)
    console.log(Date.now())
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows;
};

exports.update_user_history = function (userid, history) {
    if (userid == null) {
        return false;
    }

    var historyStr = JSON.stringify(history);
    var sql = "UPDATE t_users SET history = '{0}' WHERE userid = {1}";
    sql = sql.format(historyStr, userid);
    var ret = dbpool.query(sql);
    if (!ret || ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};

exports.get_room_gameResults = function(gameType,gameMode,uuid){
    
    var tableName= getGameTabName(gameType,gameMode);
    var sql = "select room_uuid,game_index,result FROM "+ tableName +" WHERE room_uuid = " + uuid;

    //console.log(sql);
    var ret = dbpool.query(sql);
   // console.log(ret.err);
    if (ret.err || ret.rows.length == 0) {
        return [];
    }

    var list = [];
    for (var i = 0; i < ret.rows.length; i++) {
        var data = ret.rows[i];
        list.push(JSON.parse(data.result));
    }
    return list;

};
exports.get_games_of_room = function (gameType, gameMode, roomUUID) {
    var tableName = getGameArchiveTabName(gameType, gameMode);
    if (tableName == null || roomUUID == null) {
        return null;
    }

    // var sql = 'SELECT game_index, create_time, result FROM ' + tableName + ' WHERE room_uuid = "' + roomUUID + '"';
    var sql = 'SELECT * FROM ' + tableName + ' WHERE room_uuid = "' + roomUUID + '"';
    // console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows;
};

exports.get_detail_of_game = function (gameType, gameMode, roomUUID, index) {
    var tableName = getGameArchiveTabName(gameType, gameMode);
    if (tableName == null || roomUUID == null || index == null) {
        return null;
    }

    var sql = 'SELECT base_info, action_records FROM ' + tableName + ' WHERE room_uuid = "' + roomUUID + '" AND game_index = ' + index;
    // console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows[0];
}

exports.create_user = function (account, name, coins, gems, sex, headimg) {
    if (account == null || name == null || coins == null || gems == null) {
        return false;
    }
    if (headimg) {
        headimg = '"' + headimg + '"';
    }
    else {
        headimg = null;
    }

    name = crypto.toBase64(name);
    // while (true) {
    var userId = generateUserId();
    var create_time = parseInt(Date.now() * 0.001);
    var sql = 'INSERT INTO t_users(userid, account, name, coins, gems, sex, headimg, create_time) VALUES({0}, "{1}", "{2}", {3}, {4}, {5},' + headimg + ', {6})';
    sql = sql.format(userId, account, name, coins, gems, sex, create_time);
    var ret = dbpool.query(sql);
    if (!ret.err) {
        //log cash changes
        exports.record_gem_change(userId, gems, CASH_CHANGE_RESONS.ADD_NEW_USER);
        exports.record_coin_change(userId, coins, CASH_CHANGE_RESONS.ADD_NEW_USER);
        return true;
    }
    else {
        return false;
    }
    // }
};

exports.update_user_info = function (userid, name, headimg, sex) {
    if (userid == null) {
        return null;
    }

    if (headimg) {
        headimg = '"' + headimg + '"';
    }
    else {
        headimg = 'null';
    }
    name = crypto.toBase64(name);
    var sql = 'UPDATE t_users SET name="{0}",headimg={1},sex={2} WHERE account="{3}"';
    sql = sql.format(name, headimg, sex, userid);
    var ret = dbpool.query(sql);
    return ret.err == null;
};

exports.get_user_base_info = function (userid) {
    if (userid == null) {
        return null;
    }
    var sql = 'SELECT name, sex, headimg, coins, gems, create_time, agent FROM t_users WHERE userid = {0}';
    sql = sql.format(userid);

    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }
    ret.rows[0].name = crypto.fromBase64(ret.rows[0].name);
    return ret.rows[0];
};

exports.get_multi_names = function (userIdList) {
    if (userIdList == null || userIdList.length == 0) {
        return null;
    }
    var sql = 'SELECT userid,name FROM t_users WHERE';
    var sep = ' ';
    for (var i = 0; i < userIdList.length; ++i) {
        sql += sep + 'userid=' + userIdList[i];
        sep = ' OR ';
    }
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG]-get_multi_names-->" + sep, ret.err);
        return null;
    }

    var nameMap = {};
    for (var i = 0; i < ret.rows.length; ++i) {
        var r = ret.rows[i];
        nameMap[r.userid] = crypto.fromBase64(r.name);
    }

    return nameMap;
};
/**
 * 按不同游戏查询是否存在房间号
 */
exports.is_room_exist = function (gameType, gameMode, roomId) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null || roomId == null) {
        return false;
    }

    var sql = 'SELECT * FROM ' + tableName + ' WHERE id = "' + roomId + '"';
    var ret = dbpool.query(sql);

    if (ret.err) {
        return false;
    } else {
        return ret.rows.length > 0;
    }
};

/**
 * 查询数据库中所有游戏房间号，是否存在
 */
exports.is_room_exist2 = function (gameType, gameMode, roomId) {
    var gametype = consts.AllGameType;//getRoomTabName(gameType, gameMode);

    if (roomId == null) {
        return false;
    }
    var check = function (i) {
        var tableName = 't_' + gametype[i] + '_' + gameMode + '_rooms';
        var sql = 'SELECT * FROM ' + tableName + ' WHERE id = "' + roomId + '"';
        var ret = dbpool.query(sql);
        if (ret.err) {
            console.error("[DB-BUG] ----is_room_exist2--roomId:[" + roomId + "]", ret.err);
            return false;
        } else {
            return ret.rows.length > 0;
        }
    }
    console.log('check-room-exist');
    for (var i = 0; i < gametype.length; ++i) {
        // console.log(gametype[i]);
        if (check(i)) {
            console.log('room   ' + roomId + ' is used by ' + gametype[i]);
            return true;
        }
    }
    console.log('room   ' + roomId + '  is not exist,you can use!');
    return false;
};

exports.get_room_list = function (gameType, gameMode, serverId) {
    var tableName = getRoomTabName(gameType, gameMode);

    if (tableName == null || serverId == null) {
        return null;
    }

    var sql = 'SELECT * FROM ' + tableName + ' WHERE serverid = "' + serverId + '"';
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    var data = ret.rows;
    return data;
};

exports.cost_gems = function (userid, cost, log) {
    var sql = 'UPDATE t_users SET gems = gems -' + cost + ' WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    var affected = ret.rows.affectedRows > 0;
    if (affected == true) {
        //log cash changes
        //exports.record_gem_change(userid, -cost, log);
    }
    return affected;
};

exports.mj_cost_gems = function (userid, cost) {
    if (userid == null || cost == null) {
        return;
    }
    var sql = 'UPDATE t_users SET gems = gems -' + cost + ' WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("error[kouFei]---userid：[" + userid + "]");
        return false;
    }

    return true;
};

exports.set_room_id_of_user = function (userId, roomId, gametype, gamemode) {
    if (userId == null) {
        return false;
    }

    var setState = "SET ";
    setState += "roomid = " + (roomId != null ? "'" + roomId + "'" : null);
    setState += ',gametype = ' + (gametype != null ? "'" + gametype + "'" : null);
    setState += ',gamemode = ' + (gamemode != null ? "'" + gamemode + "'" : null);

    var sql = 'UPDATE t_users ' + setState + ' WHERE userid = "' + userId + '"';
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG]-set_room_id_of_user-->roomid:[" + roomId + "]", ret.err);
        return false;
    }

    return true;//ret.rows.affectedRows > 0;
};

exports.get_room_id_of_user = function (userId) {
    var sql = 'SELECT roomid, gametype, gamemode FROM t_users WHERE userid = "' + userId + '"';
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows[0];
};

/**
 * 创建房间
 */
exports.create_room = function (gameType, gameMode, serverId, roomId, conf, createTime) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null || roomId == null) {
        return null;
    }

    var sql = "INSERT INTO " + tableName + "(uuid, id, creator, base_info, serverid, create_time,club_id,club_time) \
               VALUES('{0}', '{1}', {2}, '{3}', '{4}', {5},{6},{7})";
    var uuid = Date.now() + roomId;
    conf.gametype = gameType;
    conf.gamemode = gameMode;
    var club_id = 0;
    if (conf.club_id) {
        club_id = conf.club_id;
    }
    var baseInfo = JSON.stringify(conf);//
    sql = sql.format(uuid, roomId, conf.creator, baseInfo, serverId, createTime, club_id, createTime);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----create_room faild-room:[" + roomId + "]", ret.err);
        return null;
    }
    return uuid;
};

exports.update_room_serverid = function (gameType, gameMode, roomId, serverId) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null || roomId == null) {
        return false;
    }

    var setState = " SET serverid = " + ((serverId != null) ? ("'" + serverId + "'") : null);
    var sql = "UPDATE " + tableName + setState + " WHERE id = '{1}'";
    sql = sql.format(serverId, roomId);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----update_room_serverid--roomId:[" + roomId + "]", ret.err);
        return false;
    }

    return ret.rows.affectedRows > 0;
}

/**
 * 获取账单
 * @param  {Number} userId [用户ID]
 * @return {Object}        [账单数据]
 */
exports.get_bills = function (userId) {
    if (userId == null) {
        return null;
    }

    var arr = [];
    var sql = 'SELECT * FROM t_rooms WHERE  creator = ' + userId + ' AND for_others=1';
    var ret = dbpool.query(sql);
    if (ret.err) {
        return null;
    }
    arr = arr.concat(ret.rows);

    var sql = 'SELECT * FROM t_rooms_archive WHERE  creator = ' + userId + ' AND for_others=1';
    var ret = dbpool.query(sql);
    if (ret.err) {
        return arr;
    }

    arr = arr.concat(ret.rows);

    return arr;
};

exports.delete_bill = function (uuid) {
    var sql = 'UPDATE t_rooms_archive SET for_others = 0 WHERE uuid = "{0}"';
    sql = sql.format(uuid);
    // console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }
    return ret.rows.affectedRows > 0;
};

exports.get_room_uuid = function (gameType, gameMode, roomId) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null) {
        return null;
    }

    var sql = 'SELECT uuid FROM ' + tableName + ' WHERE id = "' + roomId + '"';
    var ret = dbpool.query(sql);
    if (ret.err) {
        return null;
    }

    if (ret.rows.length == 0) {
        return null;
    }

    return ret.rows[0].uuid;
};

exports.update_seats_info = function (gameType, gameMode, roomId, seatsInfo) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null || roomId == null || seatsInfo == null) {
        return false;
    }

    var infos = null;
    try {
        infos = JSON.stringify(seatsInfo);
    } catch (e) {
        console.error("[DB-BUG]-json-faild-update_seats_info-->roomid:[" + roomId + "]", e);
        return false;
    }

    var sql = "UPDATE {0} SET seats_info = '{1}' WHERE id = '{2}'";
    sql = sql.format(tableName, infos, roomId);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG]--update_seats_info-->roomid:[" + roomId + "]", ret.err);
        return false;
    }
    return true;//ret.rows.affectedRows > 0;
}

exports.yymj_update_seats_info = function (gameType, gameMode, roomId, seatsInfo, si, userId) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null || roomId == null || seatsInfo == null) {
        return false;
    }

    var infos = null;
    try {
        infos = JSON.stringify(seatsInfo);
    } catch (e) {
        console.log('[Error] - JSON stringify seatInfos err - ' + e);
        return false;
    }

    var sql = "UPDATE {0} SET user_id{1}= '{2}', seats_info = '{3}' WHERE id = '{4}'";
    sql = sql.format(tableName, si, userId, infos, roomId);
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }
    return true;//ret.rows.affectedRows > 0;
}


exports.update_num_of_turns = function (gameType, gameMode, roomId, numOfTurns) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null) {
        return MSFIDOCredentialAssertion;
    }

    var sql = 'UPDATE ' + tableName + ' SET num_of_turns = {0} WHERE id = "{1}"'
    sql = sql.format(numOfTurns, roomId);
    // console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG]--update_num_of_turns-->roomid:[" + roomId + "]", ret.err);
        return false;
    }
    return true;//ret.rows.affectedRows > 0;
};

exports.update_next_button = function (gameType, gameMode, roomId, nextButton) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null) {
        return false;
    }
    var sql = 'UPDATE ' + tableName + ' SET next_button = {0} WHERE id = "{1}"'
    sql = sql.format(nextButton, roomId);
    // console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG]--update_newxt_button-->roomid:[" + roomId + "]", ret.err);
        return false;
    }
    return true;//ret.rows.affectedRows > 0;
};

exports.get_room_serverid = function (gameType, gameMode, roomId) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null || roomId == null) {
        return null;
    }

    var sql = 'SELECT serverid FROM ' + tableName + ' WHERE id = "' + roomId + '"';
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows[0];
};

exports.get_room_data = function (gameType, gameMode, roomId) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null || roomId == null) {
        return null;
    }

    var sql = 'SELECT * FROM ' + tableName + ' WHERE id = "' + roomId + '"';
    // console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err) {
        return null;
    }

    if (ret.rows.length == 0) {
        return null;
    }

    var data = ret.rows[0];
    return data;
};

exports.get_room_data2 = function (gameType, gameMode, roomId) {
    var gametype = consts.AllGameType;//getRoomTabName(gameType, gameMode);
    console.log('games:', gametype);
    if (roomId == null) {
        return false;
    }
    var check = function (i) {
        var tableName = 't_' + gametype[i] + '_' + gameMode + '_rooms';
        var sql = 'SELECT * FROM ' + tableName + ' WHERE id = "' + roomId + '"';
        var ret = dbpool.query(sql);
        if (ret.err || ret.rows.length == 0) {
            return null;
        }

        return ret.rows[0];
    }
    console.log('get_room_data_by_roomid');
    for (var i = 0; i < gametype.length; ++i) {
        console.log(gametype[i]);
        var roomdata = check(i);
        if (roomdata) {
            console.log('room  ' + roomId + ' is exist,getRoomdata');
            return roomdata;
        }
    }
    console.log('room   ' + roomId + '  is not exist,no roomdata!');
    return null;
};


exports.delete_room = function (gameType, gameMode, roomUUID) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null || roomUUID == null) {
        return false;
    }

    var sql = "DELETE FROM " + tableName + " WHERE uuid = '{0}'";

    sql = sql.format(roomUUID);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----delete_room--uuid:[" + roomUUID + "]", ret.err);
        return false;
    }

    return true;//ret.rows.affectedRows > 0;
}
exports.dissolve_room = function (roomid, type) {
    if (type == 1) {
        var tableName = 't_dht_norm_rooms '
    } else if (type == 2) {
        var tableName = 't_thirteen_norm_rooms '

    } else {
        return false;
    }


    var sql = `DELETE FROM  ${tableName} WHERE id = ${roomid}`;

    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----delete_room--id:[" + roomid + "]", ret.err);
        return false;
    }

    return true;//ret.rows.affectedRows > 0;
}
exports.create_game = function (gameType, gameMode, roomUUID, index, baseInfo) {
    var tableName = getGameTabName(gameType, gameMode);
    if (tableName == null || roomUUID == null || index == null) {
        return null;
    }
    var sql = "INSERT INTO " + tableName + "(room_uuid,game_index,base_info,create_time) VALUES('{0}',{1},'{2}',unix_timestamp(now()))";
    sql = sql.format(roomUUID, index, baseInfo);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG]--create_gamey-->uuid:[" + roomUUID + "]", ret.err);
        return null;
    }
    return true;//ret.rows.affectedRows > 0;
};

exports.delete_games = function (gameType, gameMode, roomUUID) {
    var tableName = getGameTabName(gameType, gameMode);
    if (tableName == null || roomUUID == null) {
        return false;
    }

    var sql = "DELETE FROM " + tableName + " WHERE room_uuid = '{0}'";
    sql = sql.format(roomUUID);
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return true;//ret.rows.affectedRows > 0;
}

exports.archive_games = function (gameType, gameMode, roomUUID) {
    var tableName = getGameTabName(gameType, gameMode);
    var archiveTableName = getGameArchiveTabName(gameType, gameMode);
    if (tableName == null || archiveTableName == null || roomUUID == null) {
        return null;
    }
    var sql = "INSERT INTO " + archiveTableName + "(SELECT * FROM " + tableName + " WHERE room_uuid = '{0}')";
    sql = sql.format(roomUUID);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----save games_archive faild-uuid:[" + roomUUID + "]", ret.err);
        return false;
    }

    exports.delete_games(gameType, gameMode, roomUUID);

    return true;//ret.rows.affectedRows > 0;
}

exports.archive_room = function (gameType, gameMode, roomUUID, needRenew) {
    var tableName = getRoomTabName(gameType, gameMode);
    var archiveTableName = getRoomArchiveTabName(gameType, gameMode);
    if (tableName == null || archiveTableName == null || roomUUID == null) {
        return null;
    }

    var sql = "INSERT INTO " + archiveTableName + "(SELECT * FROM " + tableName + " WHERE uuid = '{0}')";
    sql = sql.format(roomUUID);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----save rooms_archive faild-uuid:[" + roomUUID + "]", ret.err);
        return false;
    }

    //明确不续局的房间直接从房间表中删除数据
    // if (needRenew === false) {
    //     exports.delete_room(gameType, gameMode, roomUUID);
    // }

    return true;//ret.rows.affectedRows > 0;
};

exports.update_game_action_records = function (gameType, gameMode, roomUUID, index, actions) {
    var tableName = getGameTabName(gameType, gameMode);
    if (tableName == null || roomUUID == null || actions == null) {
        return false;
    }

    var sql = "UPDATE " + tableName + " SET action_records = '" + actions + "' WHERE room_uuid = '" + roomUUID + "' AND game_index = " + index;
    // console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG]--update_game_action_records-->uuid:[" + roomUUID + "]", ret.err);
        return false;
    }
    return true;//ret.rows.affectedRows > 0;
};

exports.update_game_result = function (gameType, gameMode, roomUUID, index, result) {
    var tableName = getGameTabName(gameType, gameMode);
    if (tableName == null || roomUUID == null || result == null) {
        return false;
    }

    result = JSON.stringify(result);
    var sql = "UPDATE " + tableName + " SET result = '" + result + "' WHERE room_uuid = '" + roomUUID + "' AND game_index = " + index;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }
    return true;//ret.rows.affectedRows > 0;
};

exports.update_mj_game_result = function (gameType, gameMode, roomUUID, index, result, gameOver) {//麻将
    var tableName = getGameTabName(gameType, gameMode);
    if (tableName == null || roomUUID == null || result == null) {
        return false;
    }

    result = JSON.stringify(result);
    var sql = "UPDATE " + tableName + " SET result = '" + result + "',game_over = '" + gameOver + "' WHERE room_uuid = '" + roomUUID + "' AND game_index = " + index;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG]--update_mj_game_result-->uuid:[" + roomUUID + "]", ret.err);
        return false;
    }
    return true;//ret.rows.affectedRows > 0;
};

exports.update_user_score = function (gameType, gameMode, roomId, roomInfo) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null || roomId == null || roomInfo == null) {
        return false;
    }
    var sql = 'UPDATE ' + tableName + ' SET '; //t_dht_norm_rooms
    for (var i = 0; i < roomInfo.seats.length; i++) {
        if (i > 0) {
            sql += ",";
        }
        sql += "user_id" + i + "=" + roomInfo.seats[i].userId;
        sql += ",user_score" + i + "=" + roomInfo.seats[i].score;
        sql += ",user_gang_score" + i + "=" + roomInfo.seats[i].gangScore;
    }
    sql += " WHERE id = " + roomId;
    // console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----update_user_score faild-roomid:[" + roomId + "]", ret.err);
        return false;
    }
    return true;
};

exports.add_games_and_scores = function (gameType, gameMode, userId, score) {
    var tableName = getGameTabName(gameType, gameMode);
    if (userId == null || score == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET total_games = total_games+1,total_score = total_score + ' + score + ' WHERE userid = ' + userId;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----add_games_and_scores faild-useid:[" + userId + "]", ret.err);
        return false;
    }
    return ret.rows.affectedRows > 0;
};

exports.get_message = function (type, version, start, rows) {
    var conStr = '';
    if (type != null && type != 'all') {
        conStr = ' WHERE type = "' + type + '"'
    }

    var limitsql = '';
    if (start != null && rows != null) {
        limitsql = ' ORDER BY type LIMIT ' + start + ',' + rows;
    }

    var sql = 'SELECT * FROM t_message' + conStr + limitsql;

    if (version == "null") {
        version = null;
    }

    if (version != null) {
        version = '"' + version + '"';
        sql += ' AND version != ' + version;
    }

    var sqlcCnt = `select count(*) as cnt from  t_message`
    var ret = dbpool.query(sql);
    var sqlcCnt = dbpool.query(sqlcCnt);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    if (type == null || type == 'all') {
        ret.rows[0].cnt = sqlcCnt.rows[0].cnt
        return ret.rows;
    }

    return ret.rows[0];
};

exports.update_message = function (type, message, version) {
    if (type == null || message == null) {
        return false;
    }

    if (version != null) {
        version = "'" + version + "'";
    } else {
        version = "''";
    }
    var sql = "UPDATE t_message SET msg = '" + message + "', version = " + version + " WHERE type = '" + type + "'";
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};

exports.create_message = function (type, message, version) {
    if (type == null || message == null) {
        return false;
    }

    if (version != null) {
        version = "'" + version + "'";
    } else {
        version = "''";
    }
    var sql = "INSERT INTO t_message(type, msg, version) VALUES('" + type + "','" + message + "'," + version + ")";
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};

exports.delete_message = function (type, message, version) {
    if (type == null) {
        return false;
    }

    var sql = "DELETE FROM t_message WHERE type = '" + type + "'";
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
}

exports.get_configs = function () {
    var sql = 'SELECT * FROM t_configs';
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }
    return ret.rows[0];
};

/**
 * [获取消费配置数据]
 * @param  {[Number]} gameType [游戏类型]
 * @param  {[Number]} modeType [游戏模式]
 * @return {[Object]}          [游戏消费配置]
 */
exports.get_cost_conf = function (gameType, modeType) {
    var sql = 'SELECT cost_conf FROM t_cost_configs WHERE game_type = "{0}" AND game_mode = "{1}"';
    sql = sql.format(gameType, modeType);
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return JSON.parse(ret.rows[0].cost_conf);
};

/**
 * [get_cost_confs description]
 * @param  {[Number]} gameType [description]
 * @return {[type]}          [description]
 */
exports.get_cost_confs = function () {
    var sql = 'SELECT * FROM t_cost_configs';
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    var list = [];
    for (var i = 0; i < ret.rows.length; i++) {
        var data = ret.rows[i];
        var item = {};
        item.game_type = data.game_type;
        item.game_mode = data.game_mode;
        item.cost_conf = JSON.parse(data.cost_conf);
        list.push(item);
    }
    return list;
};

/**
 * 更新房间状态
 */
exports.update_room_state = function (gameType, gameMode, roomId, state) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null) {
        return false;
    }

    var sql = 'UPDATE {0} SET state = {1} WHERE id = "{2}"';
    sql = sql.format(tableName, state, roomId);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----update_room_state--roomId:[" + roomId + "]", ret.err);
        return false;
    }

    return ret.rows.affectedRows > 0;
};

/**
 * 续局房间
 */
exports.renew_room = function (gameType, gameMode, roomId, seatsInfo) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null || roomId == null || seatsInfo == null) {
        return null;
    }

    var infos = null;
    var createTime = Math.ceil(Date.now() / 1000);
    try {
        infos = JSON.stringify(seatsInfo);
    } catch (e) {
        console.log('[Error] - JSON stringify seatInfos err - ' + e);
        return null;
    }

    var sql = "UPDATE {0} SET uuid = {1},create_time = {2}, seats_info = '{3}' WHERE id = '{4}'";
    var uuid = Date.now() + roomId;
    sql = sql.format(tableName, uuid, createTime, infos, roomId);
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.affectedRows == 0) {
        return null;
    }

    return uuid;
};

/**
 * 更新房间配置，主要是为了房间续费更换房主
 */
exports.update_room_creator = function (gameType, gameMode, roomId, creator) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null) {
        return false;
    }

    var sql = "UPDATE {0} SET creator = {1} WHERE id = '{2}'";
    sql = sql.format(tableName, creator, roomId);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----update_room_creator--roomId:[" + roomId + "]", ret.err);
        return false;
    }

    return ret.rows.length > 0;
};
//作用更新玩家 历史战绩时间
exports.update_room_time = function (gameType, gameMode, roomId) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null || roomId == null) {
        return false;
    }

    var createTime = Math.ceil(Date.now() / 1000);

    var sql = "UPDATE {0} SET create_time = {1} WHERE id = '{2}'";
    sql = sql.format(tableName, createTime, roomId);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----update_room_time--roomId:[" + roomId + "]", ret.err);
        return false;
    }

    return true;
};

/**
 * 更新房间配置，主要是为了房间续费更换房主
 */
exports.update_room_conf = function (gameType, gameMode, roomId, conf) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null) {
        return false;
    }

    var sql = "UPDATE {0} SET base_info = '{1}' WHERE id = '{2}'";
    var baseInfo = JSON.stringify(conf);
    sql = sql.format(tableName, baseInfo, roomId);
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.length > 0;
};

/**
 * 获取shop数据
 * @param {Number} shopId shop编号
 */
exports.get_shop_data = function (shopId, start, rows) {
    var conStr = '';
    if (shopId != null && shopId != 'all') {
        conStr = ' WHERE shop_id = ' + shopId;
    }

    var limitsql = '';
    if (start != null && rows != null) {
        limitsql = ' LIMIT ' + start + ',' + rows;
    }
    var sqlCnt = `SELECT count(*) as cnt from t_shop ${conStr} `
    var sql = 'SELECT * FROM t_shop' + conStr + ' ORDER BY item_id ' + limitsql;
    var ret = dbpool.query(sql);
    var sqlCnt = dbpool.query(sqlCnt);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }
    ret.rows[0].cnt = sqlCnt.rows[0].cnt
    return ret.rows;
};

exports.create_shop_data = function (shopId, itemId, icon, name, priceType, price, gainType, gain, desc) {
    if (shopId == null || itemId == null || name == null || priceType == null
        || price == null || gainType == null || gain == null) {
        return false;
    }

    icon = icon != null ? "'" + icon + "'" : "''";
    desc = desc != null ? "'" + desc + "'" : "''";

    var sql = "INSERT INTO t_shop(`item_id`, `shop_id`, `icon`, `name`, `price_type`, `price`, `gain_type`, `gain`, `desc`) \
               VALUES({0}, {1}, {2}, '{3}', {4}, {5}, {6}, {7}, {8})";

    sql = sql.format(itemId, shopId, icon, name, priceType, price, gainType, gain, desc);
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};

exports.update_shop_data = function (itemId, attrs) {
    if (itemId == null || attrs == null) {
        return false;
    }

    var setStr = null;
    for (var attr in attrs) {
        setStr = setStr != null ? setStr + ', ' : 'SET ';
        var val = attrs[attr];
        if (attr == 'icon' || attr == 'name' || attr == 'desc') {
            val = val != null ? "'" + val + "'" : "''";
        }
        setStr += "`" + attr + "`" + " = " + val;
    }

    if (setStr == null) {
        return false;
    }

    var sql = 'UPDATE t_shop ' + setStr + ' WHERE item_id = ' + itemId;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};

exports.delete_shop_data = function (itemId) {
    if (itemId == null) {
        return false;
    }

    var sql = 'DELETE FROM t_shop WHERE item_id = ' + itemId;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};

/**
 * 获取item数据
 * @param {Number} itemId item编号
 */
exports.get_item_data = function (itemId) {
    if (itemId == null) {
        return null;
    }

    var sql = 'SELECT * FROM t_shop WHERE item_id = ' + itemId;
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows[0];
};

exports.create_pay_record = function (userId, agentId, orderId, cost, itemId) {
    if (userId == null || orderId == null || itemId == null || cost == null) {
        return false;
    }

    var time = parseInt(Date.now() * 0.001);
    if (agentId == null) {
        agentId = null;
    } else {
        agentId = "'" + agentId + "'";
    }
    var sql = "INSERT INTO t_pay_records(user_id, agent, order_id, cost, item_id, state, time) VALUES({0}, " + agentId + ", '{1}', {2}, {3}, 1, {4})";
    sql = sql.format(userId, orderId, cost, itemId, time);
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return true;
};

exports.get_pay_data = function (orderId) {
    if (orderId == null) {
        return null;
    }

    var sql = "SELECT * FROM t_pay_records WHERE order_id = '" + orderId + "'";
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows[0];
};

exports.get_pay_liushui = function (userId) {
    if (userId == null) {
        return null;
    }

    var sql = "SELECT * FROM t_pay_records WHERE user_id = '" + userId + "'";
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows;
};

exports.get_pay_count = function (userId) {
    if (userId == null) {
        return 0;
    }

    var sql = "SELECT order_id FROM t_pay_records WHERE user_id = " + userId;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return 0;
    }

    return ret.rows.length;
}

exports.update_pay_state = function (orderId, state) {
    if (orderId == null || state == null || state < 1 || state > 3) {
        return false;
    }

    var sql = 'UPDATE t_pay_records SET state = ' + state + ' WHERE order_id = "' + orderId + '" AND state = 1';
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return false;
    }

    return true;
};

/**
 * 记录钻石变更记录
 * @param userId - 用户ID
 * @param changeNum - 变更数量
 * @param reason - 变更原因
 * @return boolean
 */
exports.record_gem_change = function (userId, changeNum, reason) {
    var sql = "INSERT INTO t_user_gem_records(userid, change_num, change_time, reason) \
               VALUES({0}, {1}, {2}, '{3}')";

    var now = parseInt(Date.now() * 0.001);
    sql = sql.format(userId, changeNum, now, reason);
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};

/**
 * 记录金币变更记录
 * @param userId - 用户ID
 * @param changeNum - 变更数量
 * @param reason - 变更原因
 * @return boolean
 */
exports.record_coin_change = function (userId, changeNum, reason) {
    var sql = "INSERT INTO t_user_coin_records(userid, change_num, change_time, reason) \
               VALUES({0}, {1}, {2}, '{3}')";

    var now = parseInt(Date.now() * 0.001);
    sql = sql.format(userId, changeNum, now, reason);
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};

exports.get_user_pays_by_agents = function (agents, startTime, endTime) {
    if (agents == null) {
        return null;
    }

    var agentset = '(';
    var num = 0;
    for (var i in agents) {
        var agent = agents[i];
        agentset += (num > 0 ? ',' : '') + "'" + agent + "'";
        num++;
    }
    agentset = agentset + ')';

    var timeSql = '';
    if (startTime != null && endTime != null) {
        timeSql = ' AND time BETWEEN ' + startTime + ' AND ' + endTime;
    }

    var sql = 'SELECT user_id, agent, SUM(cost) as total_pay FROM t_pay_records WHERE agent IN ' + agentset + timeSql + ' AND state = 3 GROUP BY user_id';
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows;
}

//维护类

//清除归档的房间数据
exports.clear_rooms_archive = function (gameType, gameMode, timestamp) {
    var raTableName = getRoomArchiveTabName(gameType, gameMode);
    if (!timestamp || !raTableName) {
        return false;
    }
    var sql = "DELETE FROM " + raTableName + " WHERE create_time < " + timestamp;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG]-clear_rooms_archive-->", ret.err);
        return false;
    }

    return ret.rows.affectedRows > 0;
}

//清除归档的游戏数据
exports.clear_games_archive = function (gameType, gameMode, timestamp) {
    var gaTableName = getGameArchiveTabName(gameType, gameMode);
    if (!timestamp) {
        return false;
    }
    var sql = "DELETE FROM " + gaTableName + " WHERE create_time < " + timestamp;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG]-clear_games_archive-->", ret.err);
        return false;
    }

    return ret.rows.affectedRows > 0;
};

exports.get_num_of_users = function () {
    var sql = 'SELECT userid FROM t_users';
    var ret = dbpool.query(sql);
    if (ret.err) {
        return 0;
    }

    return ret.rows.length;
};

exports.get_user_list = function (userId, start, rows) {
    var condSql = '';
    if (userId != null) {
        condSql = 'WHERE userid = ' + userId;
    }

    if (start == null || rows == null) {
        start = null;
        rows = null;
    }

    var limitSql = '';
    if (start != null && rows != null) {
        limitSql = ' LIMIT ' + start + ', ' + rows + ' ';
    }

    var sql = 'SELECT userid, name, sex, headimg, coins, gems, agent,forbidden FROM t_users ' + condSql + ' ORDER BY create_time ASC ' + limitSql;
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows;
};

exports.get_total_pay = function (itemType) {
    if (itemType == null) {
        return 0;
    }

    var sql = 'SELECT SUM(t_shop.gain) AS total FROM t_pay_records,\
               t_shop WHERE t_pay_records.state = 3 AND t_pay_records.item_id = t_shop.item_id AND \
               t_shop.gain_type = ' + itemType;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return 0;
    }

    return ret.rows[0].total;
};

/**
 * 查询玩家钻石消费记录，如果userId不存在，则查询所有玩家消费记录，否则查询指定玩家消费记录
 */
exports.get_gem_consume_records = function (userId, start, rows) {
    var condStr = '';
    if (userId != null) {
        condStr = `AND userid=${userId} `;
    }

    var limitSql = '';
    if (start != null && rows != null) {
        limitSql = ' LIMIT ' + start + ',' + rows + ' ';
    }
    var sqlCnt = `SELECT COUNT(*) FROM t_user_gem_records WHERE change_num < 0 ${condStr}  `
    var sql = `SELECT userid AS user_id, change_time, change_num, reason FROM t_user_gem_records WHERE change_num < 0 ${condStr} ORDER BY change_time ASC ${limitSql}`;
    var ret = dbpool.query(sql);
    var sqlCnt = dbpool.query(sqlCnt);
    if (ret.err) {
        return null;
    }
    ret.rows[0].cnt = sqlCnt.rows[0].cnt
    return ret.rows;
};

exports.get_user_buy_records = function (userId, start, rows) {
    var conStr = 'WHERE state = 3 AND t_pay_records.item_id = t_shop.item_id AND t_shop.gain_type = 2';
    if (userId != null) {
        conStr += ' ' + 'AND user_id = ' + userId;
    }

    var limitSql = '';
    if (start != null && rows != null) {
        limitSql = ' LIMIT ' + start + ',' + rows + ' ';
    }

    var sql = "SELECT t_pay_records.user_id, t_pay_records.agent, t_pay_records.order_id, t_pay_records.time, t_shop.gain FROM t_pay_records, t_shop" +
        " " + conStr + " " +
        "ORDER BY t_pay_records.time ASC" + limitSql;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return null;
    }

    return ret.rows;
};
// 玩家排名
exports.get_user_ranking = function (start, row, user_id) {

    var userid = "";
    var rank = "";
    if (user_id) {
        userid = `where userid = ${user_id}`;
    }

    var sql1 = `SELECT count(*) as cnt FROM t_users ${userid}`;

    var ret1 = dbpool.query(sql1);

    if (ret1.err || ret1.rows.length == 0) {
        return null
    }

    var sql = `SELECT * FROM t_users ${userid} order by userid desc limit ${start},${row}`;
    var ret2 = dbpool.query(sql, true);
    if (ret2.err) {
        console.error('[CHECKBUG]--get_user_ranking-->', ret2.err);
        return null
    }
    if (ret2.rows.length == 0) {
        return null
    }
    var j = new Array();
    var rank = 0;
    for (var i = 0; i < ret2.rows.length; i++) {
        // if(user_id){
        //     rank = ret1.rows[0].rank+1;
        // }else{
        //     rank = parseInt(start) + i + 1;
        // }
        j.push({
            userid: ret2.rows[i].userid,
            name: crypto.fromBase64(ret2.rows[i].name),
            score: ret2.rows[i].total_games + ret2.rows[i].total_score,
            rank: parseInt(start) + i + 1,
            total_games: ret2.rows[i].total_games,
            total_score: ret2.rows[i].total_score,
            gems: ret2.rows[i].gems,
            headimg: ret2.rows[i].headimg,
            agent: ret2.rows[i].agent,
            state: ret2.rows[i].forbidden,
        });
    }
    if (j.length != 0 && !user_id) {
        j[0].cnt = ret1.rows[0].cnt;
    } else {
        j[0].cnt = 0;
    }
    return j;


};
// 房间总数
// exports.get_rooms = function (start, row) {

//    var sql = 'SELECT count(DISTINCT room_uuid) as cnt from t_games';

//     var ret1 = dbpool.query(sql);
//     if(ret1.err || ret1.rows.length == 0){
//         return null
//     }
//     var sql = 'SELECT * FROM t_rooms where user_id3!=0 order by create_time asc limit {0},{1}';

//     sql = sql.format(start, row);

//     var ret2 = dbpool.query(sql);
//     console.log(ret2.rows)

//     if(ret2.err || ret2.rows.length == 0){
//         return null
//     }

//     if (ret2.rows.length != 0) {
//          ret2.rows[0].cnt = ret1.rows[0].cnt;
//     }
//     return ret2.rows;       


// };
exports.get_rooms = function (start, row, roomid) {
    var room_id = '';
    var room_id_online = '';
    if (roomid) {
        room_id = `where id=${roomid}`;
        room_id_online = `and id=${roomid}`;
    }
    var sqlCnt = `SELECT count(*) as cnt FROM t_thirteen_norm_rooms ${room_id}`;
    var sql = `SELECT * FROM t_thirteen_norm_rooms ${room_id} order by create_time desc limit ${start},${row}`;
    var minute = 60;  //多少分钟内更新一次房间
    var sqlOnline = `SELECT count(*) as onlineRoomCnt FROM t_thirteen_norm_rooms  where UNIX_TIMESTAMP(last_update_time)>UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL ${minute} MINUTE)) ${room_id_online}`;
    // console.log(sqlCnt);
    var ret1 = dbpool.query(sqlCnt);
    if (ret1.err || ret1.rows.length == 0) {
        return null
    }
    // console.log(sql);
    var ret2 = dbpool.query(sql);

    if (ret2.err || ret2.rows.length == 0) {
        return null
    }
    console.log(sqlOnline);
    var ret3 = dbpool.query(sqlOnline);
    if (ret3.err || ret3.rows.length == 0) {
        return null
    }

    if (ret2.rows.length != 0) {
        ret2.rows[0].cnt = ret1.rows[0].cnt;
        ret2.rows[0].onlineRoomCnt = ret3.rows[0].onlineRoomCnt;
    }
    return ret2.rows;
};

exports.get_rooms_dht = function (start, row, roomid) {
    var room_id = '';
    var room_id_online = '';
    if (roomid) {
        room_id = `where id=${roomid}`;
        room_id_online = `and id=${roomid}`;
    }
    var sqlCnt = `SELECT count(*) as cnt FROM t_dht_norm_rooms ${room_id}`;
    var sql = `SELECT * FROM t_dht_norm_rooms ${room_id} order by create_time desc limit ${start},${row}`;
    var minute = 60;  //多少分钟内更新一次房间
    var sqlOnline = `SELECT count(*) as onlineRoomCnt FROM t_dht_norm_rooms  where UNIX_TIMESTAMP(last_update_time)>UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL ${minute} MINUTE)) ${room_id_online}`;
    // console.log(sqlCnt);
    var ret1 = dbpool.query(sqlCnt);
    if (ret1.err || ret1.rows.length == 0) {
        if (ret1.err) {
            console.error("[CHECKBUG]--get_rooms_dht--ret1-->");
        }
        return null
    }
    // console.log(sql);
    var ret2 = dbpool.query(sql);

    if (ret2.err || ret2.rows.length == 0) {
        if (ret2.err) {
            console.error("[CHECKBUG]--get_rooms_dht--ret2-->");
        }
        return null
    }
    // console.log(sqlOnline);
    var ret3 = dbpool.query(sqlOnline);
    if (ret3.err || ret3.rows.length == 0) {
        if (ret3.err) {
            console.error("[CHECKBUG]--get_rooms_dht--ret3-->");
        }
        return null
    }

    if (ret2.rows.length != 0) {
        ret2.rows[0].cnt = ret1.rows[0].cnt;
        ret2.rows[0].onlineRoomCnt = ret3.rows[0].onlineRoomCnt;
    }
    return ret2.rows;
};

// 通过绑定的agent获取用户id列表
exports.get_userid_by_bind_agent = function (agent, start, row) {
    var sql = 'SELECT count(*) as cnt FROM t_users where agent="{0}"';
    // console.log(sql);
    sql = sql.format(agent);
    var ret1 = dbpool.query(sql);

    if (ret1.err || ret1.rows.length == 0) {
        return null
    }
    var sql = 'SELECT * FROM t_users where agent="{0}" limit {1},{2}';
    // console.log(sql);
    sql = sql.format(agent, start, row);
    var ret2 = dbpool.query(sql);

    if (ret2.err || ret2.rows.length == 0) {
        return null
    }

    var j = new Array();
    for (var i = 0; i < ret2.rows.length; i++) {
        j.push({
            userid: ret2.rows[i].userid,
        });
    }
    if (j.length != 0) {
        j[0].cnt = ret1.rows[0].cnt;
    }
    return j;

};


// 获取所有公告信息
exports.get_all_message = function (start, row) {

    var sql = `SELECT * FROM t_message limit ${start},${row}`;
    var ret = dbpool.query(sql);

    if (ret.err || ret.rows.length == 0) {
        return null;
    }
    return ret.rows;
};
// 增加公告信息
exports.add_message = function (type, msg, version) {
    var sql = "INSERT INTO t_message (`type`,`msg`,`version`)  VALUES ('{0}', '{1}', '{2}')";
    sql = sql.format(type, msg, version);
    var ret = dbpool.query(sql);

    if (ret.err || ret.rows.length == 0) {
        return null;
    }
    return ret.rows;
};
// // 更新公告信息
// exports.update_message = function(type,msg,version){

//     var sql = "UPDATE t_message SET `msg`='{0}',`version`='{1}' WHERE `type`='{2}'";
//     sql = sql.format(msg,version,type);
//     var ret = dbpool.query(sql);

//     if(ret.err || ret.rows.length == 0){
//         return null ;
//     }
//     return ret.rows;
// };
// 删除公告信息
exports.del_message = function (type) {

    var sql = "DELETE FROM t_message WHERE `type`='{0}'";
    sql = sql.format(type);

    var ret = dbpool.query(sql);

    if (ret.err || ret.rows.length == 0) {
        return null;
    }
    return ret.rows;
};



//------------大转盘抽奖-------start---------------
// exports.get_configs = function(){
//     var sql = 'SELECT * FROM t_configs';
//     var ret = dbpool.query(sql);
//     if(ret.err || ret.rows.length == 0){
//         return null;
//     }
//     return ret.rows[0];
// };

exports.getLuckyAwardConfigs = function (needProp, needLockId, filterZero) {
    var propSql = '';
    if (needProp == true) {
        propSql = ', prop';
    }

    var lockSql = '';
    if (needLockId == true) {
        lockSql = ', lock_id';
    }

    var condSql = '';
    if (filterZero == true) {
        condSql = 'WHERE prop > 0';
    }

    var sql = 'SELECT id, type, num, icon, name, cnt' + propSql + lockSql + ' FROM t_lucky_awards_config ' + condSql + ' ORDER BY prop DESC';
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows;
};
exports.getLuckyData = function (userId) {
    if (userId == null) {
        return null;
    }

    var sql = 'SELECT user_id, last_lucky_wheel_time, lucky_wheel_cnt,\
               lock_id FROM t_lucky_wheel_ctrl WHERE user_id = ' + userId;
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows[0];
};
exports.resetLuckyData = function (userId) {
    if (userId == null) {
        return false;
    }

    var sql = 'UPDATE t_lucky_wheel_ctrl SET last_lucky_wheel_time = 0' +
        ', lucky_wheel_cnt = 0, lock_id = 0 WHERE user_id = ' + userId;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};
exports.createLuckyData = function (userId) {
    if (userId == null) {
        return false;
    }

    var sql = 'INSERT INTO t_lucky_wheel_ctrl(user_id, last_lucky_wheel_time, lucky_wheel_cnt,\
               lock_id) VALUES(' + userId + ', 0, 0, 0)';
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};

exports.subLuckyAwardsCnt = function (awardId, cost, lastLock) {
    if (awardId == null || cost == null || lastLock == null) {
        return false;
    }

    var sql = 'UPDATE t_lucky_awards_config SET cnt = cnt - ' + cost + ', lock_id = lock_id + 1 WHERE id = ' + awardId + ' AND cnt >= ' + cost + ' AND lock_id = ' + lastLock;

    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};
exports.getLucky = function (userId, cnt) {
    if (userId == null || cnt == null) {
        return false;
    }

    var now = Math.ceil(Date.now() * 0.001);
    var sql = 'UPDATE t_lucky_wheel_ctrl SET last_lucky_wheel_time = ' + now +
        ', lucky_wheel_cnt = lucky_wheel_cnt + ' + cnt + ', lock_id = lock_id + 1 WHERE user_id = ' + userId;

    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};
exports.addWelfareRecord = function (userId, type, costType, cost, realAward, gainInfo, state, log) {
    if (userId == null || type == null || costType == null || cost == null ||
        gainInfo == null || state == null) {
        console.log('[Warning] - some parameters is null!');
        return null;
    }

    log = log != null ? '"' + log + '"' : null;
    gainInfo = "'" + JSON.stringify(gainInfo) + "'";
    var now = Date.now();
    var time = Math.ceil(now * 0.001);
    var id = '' + now + userId;
    var sql = 'INSERT INTO t_welfare_records(id, user_id, time, type, cost_type, cost, ' +
        'real_award, gain_info, state, log) VALUES(' + id + ', ' + userId + ', ' + time + ', ' +
        type + ', ' + costType + ', ' + cost + ', ' + realAward + ', ' + gainInfo + ', ' + state + ', ' + log + ')';

    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.affectedRows == 0) {
        return null;
    }

    return id;
};
exports.regAwardUserInfo = function (awardRecordId, userId, name, cardId, phone) {
    if (awardRecordId == null || userId == null || name == null || cardId == null || phone == null) {
        return;
    }

    awardRecordId = "'" + awardRecordId + "'";
    name = "'" + name + "'";
    cardId = "'" + cardId + "'";
    phone = "'" + phone + "'";
    var sql = 'UPDATE t_welfare_records SET name = ' + name + ', card_id = ' + cardId + ', phone = ' + phone + ' WHERE user_id = ' + userId + ' AND id = ' + awardRecordId;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};


exports.update_lottery = function (userid, lottery) {

    var sql = "UPDATE t_users SET lottery = '" + lottery + "' WHERE userid = '" + userid + "'";
    // console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----update_lottery faild-useid:[" + userid + "]", ret.err);
        return false;
    }

    return ret.rows.affectedRows > 0;
};

exports.get_welfare_records_by_id = function (userid, start, rows) {
    var limitSql = '';
    if (start != null && rows != null) {
        limitSql = ' LIMIT ' + start + ', ' + rows;
    }
    var sql = "SELECT * FROM t_welfare_records order by time desc " + limitSql;
    // console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }

    return ret.rows;
};

/* ---------------------俱乐部 ------------(采用promise写法)--------------start---------neng-- */
/* 
玩家在俱乐部状态state:{-1：屏蔽（不可再次申请），0:申请加入，1：拒绝加入（可再次申请),10:接受加入，999:表示该玩家是群主}
 */
//创建俱乐部
exports.create_club = function (club_id, club_name, userid, create_time, description, hotpush) {
    return new Promise(function (resolve, reject) {
        var sql = `INSERT INTO t_club(club_id,club_name,creator,create_time,description,hotpush) VALUES(${club_id},"${club_name}",${userid},${create_time},"${description}",${hotpush})`;
        var sql1 = `INSERT INTO t_club_users(club_id,userid,join_time,state) VALUES(${club_id},${userid},${create_time},999)`;
        // console.log(sql);
        console.log(sql1);
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err);
        } else {
            if (ret.rows.affectedRows > 0) {
                var ret1 = dbpool.query(sql1);
                if (ret1.err) {
                    reject(ret1.err);
                } else {
                    resolve(ret1.rows.affectedRows > 0);
                }
            }
        }
    })
}
//更新俱乐部的名称
exports.update_club_name = function (club_id, club_name) {
    return new Promise(function (resolve, reject) {
        var sql = `UPDATE t_club SET club_name = "${club_name}" where club_id=${club_id}`;
        // console.log(sql);
        var ret = dbpool.query(sql);
        if (ret.err || ret.rows.length == 0) {
            reject(ret.err);
        } else {
            resolve(ret.rows.affectedRows > 0);
        }
    })
}
//修改俱乐部热门推荐
exports.update_club_hotpush = function (club_id, hotpush) {
    return new Promise(function (resolve, reject) {
        var sql = `UPDATE t_club SET hotpush = "${hotpush}" where club_id=${club_id}`;
        // console.log(sql);
        var ret = dbpool.query(sql);
        if (ret.err || ret.rows.length == 0) {
            reject(ret.err);
        } else {
            resolve(ret.rows.affectedRows > 0);
        }
    })
}
//更新俱乐部的creator
exports.update_club_creator = function (club_id, creator) {
    return new Promise(function (resolve, reject) {
        var sql = `UPDATE t_club SET creator = "${creator}" where club_id=${club_id}`;
        var ret = dbpool.query(sql);
        if (ret.err || ret.rows.length == 0) {
            reject(ret.err);
        } else {
            resolve(ret.rows.affectedRows > 0);
        }
    })
}
//更新玩家在俱乐部的state 转出圈子的时候用
exports.update_user_state = function (club_id, userid, state) {
    return new Promise(function (resolve, reject) {
        var sql = `UPDATE t_club_users SET state = "${state}" where club_id=${club_id} and userid=${userid}`;
        var ret = dbpool.query(sql);
        if (ret.err || ret.rows.length == 0) {
            reject(ret.err);
        } else {
            resolve(ret.rows.affectedRows > 0);
        }
    })
}
//检测玩家是否在当前俱乐部
exports.check_club_member = function (club_id, userid) {
    return new Promise(function (resolve, reject) {
        var sql = `select * from t_club_users  where club_id=${club_id} and userid = ${userid}`;
        var ret = dbpool.query(sql);
        if (ret.err || ret.rows.length == 0) {
            reject(ret.err);
        } else {
            resolve(ret.rows);
        }
    })
}
//更新俱乐部的描述
exports.update_club_des = function (club_id, des) {
    return new Promise(function (resolve, reject) {
        var sql = `UPDATE t_club SET description = "${des}" where club_id=${club_id}`;
        // console.log(sql);
        var ret = dbpool.query(sql);
        if (ret.err || ret.rows.length == 0) {
            reject(ret.err);
        } else {
            resolve(ret.rows.affectedRows > 0);
        }
    })
}
//获取玩家创建或加入的俱乐部
/**
 * @param userid 用户id
 * @param club_id 俱乐部id
 * @param allstate 不根据用户状态进行筛选
 */
exports.get_user_club = function (userid, club_id, allstate) {
    var clubId = '';
    if (club_id) {
        clubId = `and t_club_users.club_id = ${club_id}`
    }
    return new Promise(function (resolve, reject) {
        var sql = `select t_club_users.*,t_club.club_name from t_club,t_club_users where t_club_users.userid = ${userid} and t_club.club_id = t_club_users.club_id ${clubId} and t_club_users.state >=10`;
        if (allstate) {
            var sql = `select t_club_users.*,t_club.club_name from t_club,t_club_users where t_club_users.userid = ${userid} and t_club.club_id = t_club_users.club_id ${clubId}`;
        }
        // console.log(sql);
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err);
        } else {
            for (var i = 0; i < ret.rows.length; i++) {
                ret.rows[i].club_name = crypto.fromBase64(ret.rows[i].club_name);
            }
            resolve(ret.rows);
        }

    })
}
//获取hotpush的俱乐部
/**
 * @param hotpush 俱乐部热门推荐
 * 
 */
exports.get_hotpush_club = function (hotpush) {
    var HotPush = '';
    if (hotpush != null) {
        hotpush = `and t_club.hotpush = ${hotpush}`
    }
    return new Promise(function (resolve, reject) {
        var sql = 'SELECT c.*,COUNT(c.club_id) as usernum from ' +
            '(SELECT * from t_club WHERE hotpush=1) c ' +
            'LEFT JOIN(SELECT * from t_club_users WHERE state>=10) b ' +
            'on (c.club_id = b.club_id' +
            ') GROUP BY c.club_id ORDER BY COUNT(c.club_id) DESC LIMIT 5'
        // console.log(sql);
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err);
        } else {
            for (var i = 0; i < ret.rows.length; i++) {
                ret.rows[i].club_name = crypto.fromBase64(ret.rows[i].club_name);
            }
            resolve(ret.rows);
        }

    })
}
/**
 * 获取俱乐部信息
 * @param userid 玩家id
 * @param club_id 俱乐部id
 */
exports.get_club_by_id = function (userid, club_id) {
    var clubId = '';
    if (club_id) {
        clubId = `and t_club_users.club_id = ${club_id}`
    }
    return new Promise(function (resolve, reject) {
        var sql = `select t_club.* ,t_users.name as creator_name from t_club,t_club_users,t_users where t_club_users.userid = ${userid} and t_club.club_id = t_club_users.club_id ${clubId} and
        t_club.creator = t_users.userid `;
        // console.log(sql);
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err);
        } else {
            for (var i = 0; i < ret.rows.length; i++) {
                ret.rows[i].club_name = crypto.fromBase64(ret.rows[i].club_name);
                ret.rows[i].creator_name = crypto.fromBase64(ret.rows[i].creator_name);
            }
            resolve(ret.rows);
        }
    })
}
/**
 * 获取俱乐部信息
 * @param club_id 俱乐部id
 */
exports.get_club_msg = function (club_id) {
    return new Promise(function (resolve, reject) {
        // var sql = `select t_club.* from t_club where club_id = ${club_id} `;
        var sql = `SELECT c.*,COUNT(c.club_id) as usernum from (SELECT * from t_club WHERE club_id =  ${club_id} ) c 
        LEFT JOIN(SELECT * from t_club_users WHERE state>=10) b 
        on(c.club_id = b.club_id) GROUP BY c.club_id ORDER BY COUNT(c.club_id) DESC LIMIT 5`;
        // console.log(sql);
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err);
        } else {
            for (var i = 0; i < ret.rows.length; i++) {
                ret.rows[i].club_name = crypto.fromBase64(ret.rows[i].club_name);
            }
            resolve(ret.rows);
        }
    })
}
/**
 * 获取当前俱乐部所开的房间信息
 * @param club_id 俱乐部id
 * @param type 游戏类型
 * @param roomid 房间id
 */
exports.get_club_room_info = function (club_id, type, roomid) {
    var gametype = consts.AllGameType;
    var gameMode = 'norm';
    var RoomId = '';
    if (type && roomid) {
        gametype = [type];
        RoomId = 'and id = ' + roomid;
    }
    var check = function (i) {
        var tableName = 't_' + gametype[i] + '_' + gameMode + '_rooms';
        var sql = 'SELECT * FROM ' + tableName + ' WHERE club_id = "' + club_id + '"' + RoomId;
        var ret = dbpool.query(sql);
        if (ret.err) {
            return false;
        } else {
            return ret.rows.length > 0 ? ret.rows : false;
        }
    }
    return new Promise(function (resolve, reject) {
        var gamedata = [];
        for (var i = 0; i < gametype.length; ++i) {
            console.log(gametype[i]);
            var ret = check(i);
            if (ret) {
                for (var k = 0; k < ret.length; k++) {
                    var data = {};
                    data.id = ret[k].id;
                    data.base_info = ret[k].base_info;
                    data.num_of_turns = ret[k].num_of_turns;
                    data.uuid = ret[k].uuid;
                    data.create_time = ret[k].club_time;
                    var num = 0;//房间内人数
                    data.seats_info = [];
                    if (gametype[i] == 'ptddz') {
                        for (let index = 0; index < 3; index++) {
                            const element = ret[k];
                            if (element["user_id" + index] > 0) {
                                num++;
                                data.seats_info[index] = {
                                    user: element["user_id" + index],
                                    score: element["user_score" + index]
                                };
                            }
                        }
                    } else {
                        try {
                            if (ret[k].seats_info.length != 0) {
                                var seatinfo = JSON.parse(ret[k].seats_info);
                                for (var j = 0; j < seatinfo.length; j++) {
                                    if (seatinfo[j].user > 0) {
                                        num++;
                                        data.seats_info[j] = seatinfo[j];
                                    }
                                }
                            }
                        } catch (error) {
                            console.log('获取位置信息异常', error);
                        }
                    }
                    data.num = num;
                    gamedata.push(data);
                }
            }
        }
        if (gamedata.length > 0) {
            resolve(gamedata);
        } else if (gamedata.length == 0) {
            resolve([]);
        } else {
            reject(null);
        }
    })
}
/**
 * 获取房间游戏数据：房间信息，局数，玩家总分
 */
exports.get_club_game_data = function (roomid, club_id, gametype, gamemode) {
    if (!club_id || !roomid || !gametype) {
        return null;
    }
    var tableName = 't_' + gametype + '_' + gameMode + '_rooms';
    return new Promise(function (resolve, reject) {
        // console.log(sql);
        var sql = "SELECT * FROM" + tableName + "WHERE "
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err);
        } else {
            resolve();
        }
    })
}
/**
 * 获取俱乐部信息
 * @param club_id 俱乐部id
 */
exports.get_club_data = function (club_id) {
    // var sql = `select t_club.* from t_club where club_id = ${club_id} `;
    var sql = `SELECT c.*,COUNT(c.club_id) as usernum from (SELECT * from t_club WHERE club_id =  ${club_id} ) c 
        LEFT JOIN(SELECT * from t_club_users WHERE state>=10) b 
        on(c.club_id = b.club_id) GROUP BY c.club_id ORDER BY COUNT(c.club_id) DESC LIMIT 5`;
    // console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err) {
        return ret.err;
    } else {
        for (var i = 0; i < ret.rows.length; i++) {
            ret.rows[i].club_name = crypto.fromBase64(ret.rows[i].club_name);
        }
        return ret.rows;
    }
}
//申请加入俱乐部
exports.apply_join_club = function (userid, club_id, apply_time, applyState) {
    return new Promise(function (resolve, reject) {
        var sql = `INSERT INTO t_club_users(club_id, userid, join_time, state) VALUES(${club_id}, ${userid}, ${apply_time}, 0) `;
        if (applyState) {
            sql = `update t_club_users set state = 0, join_time = ${apply_time} where userid = ${userid} and club_id = ${club_id} `
        }
        // console.log(sql);
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err);
        } else {
            resolve(ret.rows.affectedRows > 0);
        }
    })
}
//获取申请加入俱乐部名单
exports.get_apply_club = function (club_id, userid) {
    var userId = '';
    if (userid) {
        userId = `and t_club_users.userid = ${userid}`
    }
    return new Promise(function (resolve, reject) {
        var sql = `select t_club_users.*,t_users.name, t_users.headimg, t_users.userid from t_club_users, t_users where t_users.userid = t_club_users.userid ${userId} and state = 0 and t_club_users.club_id = ${club_id} `;
        // console.log(sql);
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err)
        } else {
            for (var i = 0; i < ret.rows.length; i++) {
                ret.rows[i].name = crypto.fromBase64(ret.rows[i].name);
            }
            resolve(ret.rows);
        }
    })
}

//获取俱乐部玩家名单
exports.get_club_users = function (club_id) {
    return new Promise(function (resolve, reject) {
        var sql = `select t_club_users.*,t_users.name, t_users.headimg, t_users.userid from t_club_users, t_users where t_users.userid = t_club_users.userid and state >= 10 and t_club_users.club_id = ${club_id} order by state desc, join_time asc`;
        // console.log(sql);
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err)
        } else {
            for (var i = 0; i < ret.rows.length; i++) {
                ret.rows[i].name = crypto.fromBase64(ret.rows[i].name);
            }
            resolve(ret.rows);
        }
    })
}
//更新玩家在俱乐部的状态
exports.update_user_club_state = function (id, state) {
    return new Promise(function (resolve, reject) {
        var sql = `UPDATE t_club_users SET state = ${state} where id= ${id} `;
        // console.log(sql);
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err)
        } else {
            resolve(ret.rows.affectedRows > 0);
        }
    })
}
//删除俱乐部玩家
exports.delete_club_user = function (club_id, userid) {
    return new Promise(function (resolve, reject) {
        var sql = `delete from t_club_users where club_id= ${club_id} and userid= ${userid} `;
        // console.log(sql);
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err)
        } else {
            resolve(ret.rows.affectedRows > 0);
        }
    })
}
//解散俱乐部
exports.dissolve_club = function (club_id) {
    return new Promise(function (resolve, reject) {
        var sql = `delete from t_club where club_id= ${club_id} `;
        var sql1 = `delete from t_club_users where club_id= ${club_id} `;
        // console.log(sql);
        console.log(sql1);
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err)
        } else {
            var ret1 = dbpool.query(sql1);
            if (ret1.err) {
                reject(ret1.err)
            } else {
                resolve(ret1.rows.affectedRows > 0);
            }
        }
    })
}

//查看俱乐部房间
exports.get_club_rooms = function (club_id) {
    return new Promise(function (resolve, reject) {
        var sql = `select * t_rooms where base_info like '%"club":${club_id}%'`;
        // console.log(sql);
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err)
        } else {
            resolve(ret.rows);
        }
    })
}
//代理花费1000房卡增加一个包间位
exports.add_maxrooms = function (club_id, creator) {
    return new Promise(function (resolve, reject) {
        var sql = `UPDATE t_club SET maxrooms = maxrooms + 1 where club_id= ${club_id} and creator = ${creator}`;
        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err)
        } else {
            resolve(ret.rows);
        }
    })
}
/**
 * 俱乐部房间每次结束都要更新uuid防止保存archive时uuid冲突
 */
exports.update_club_room_uuid = function (gameType, gameMode, roomId) {
    var tableName = getRoomTabName(gameType, gameMode);
    if (tableName == null || roomId == null) {
        return false;
    }

    var uuid = Date.now() + roomId;
    var sql = "update " + tableName + "set uuid = " + uuid + " WHERE roomId = " + roomId;

    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return true;//ret.rows.affectedRows > 0;
}

/* ---------------------俱乐部 --------------------------end--------- */

/*----------------------实名认证--------------------------------------*/
// exports.get_smrz_info = function (userid) {
//     if (userid == null) {
//         return null;
//     }
//     var sql = 'SELECT smrz FROM t_users WHERE userid = {0}';
//     sql = sql.format(userid);

//     var ret = dbpool.query(sql);
//     if (ret.err || ret.rows.length == 0) {
//         return null;
//     }
//     ret.rows[0].smrz.real_name = crypto.fromBase64(ret.rows[0].smrz.real_name);
//     return ret.rows[0];
// };
exports.update_smrz_info = function (userid, smrz, idcard) {
    if (userid == null || smrz == null) {
        return null;
    }
    var sql = "update t_users set smrz ='" + smrz + "',idcard = '" + idcard + "'where userid= " + userid;
    sql = sql.format(userid);

    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }
    return ret.rows.affectedRows > 0;
};
//检测当前idcard是否已进行过实名认证
exports.check_idcard = function (idcard) {
    if (idcard == null) {
        return null;
    }
    var sql = "SELECT smrz,idcard FROM t_users WHERE idcard = '{0}'";
    sql = sql.format(idcard);

    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }
    return ret.rows[0];
};

/*----------------------实名认证--------------------------------------*/


//===================麻将排行榜=====================Start
//更新排行榜 玩家分数
exports.update_rank_scores = function (userId, Name, score) {//麻将
    if (userId == null || Name == null || score == null) {
        return false;
    }
    //中文转成编码存储 数据库
    Name = crypto.toBase64(Name);
    //游戏每局结束 本周排行更新加上分数 和总分排行更新加上分数
    var sql = 'UPDATE t_dht_norm_rank SET name = "' + Name + '",thisweek_score = thisweek_score + ' + score + ',total_score = total_score + ' + score + ' WHERE userid = ' + userId;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[CHECKBUG]update_rank--更新麻将排行榜失败-->", ret.err);
        return false;
    }
    return true;
};
//查询 有没有这个userid
exports.set_rank_userid = function (userId) {
    if (userId == null) {
        return false;
    }

    var sql = 'SELECT * FROM t_dht_norm_rank WHERE userid = "' + userId + '"';
    // console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----set_rank_userid--userId:[" + userId + "]", ret.err);
        return false;
    }

    if (ret.rows.length === 0) {
        return false;
    }

    return ret.rows[0];
};
//插入 userid 
exports.init_rank_userid = function (userId, name) {
    if (userId == null || name == null) {
        return false;
    }
    //中文转成编码存储 数据库
    name = crypto.toBase64(name);
    var sql = "INSERT INTO t_dht_norm_rank(`userid`,`name`) VALUES('{0}','{1}')";
    sql = sql.format(userId, name);

    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----init_rank_userid--userId:[" + userId + "]", ret.err);
        return false;
    }

    return true;
};
//申请本周榜行榜 前15名列表
exports.get_this_week_rank_list = function () {
    var sql = 'SELECT userid,name,thisweek_score, thisweek_score as ranks_core FROM t_dht_norm_rank order by thisweek_score DESC limit 16';

    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    if (ret.rows.length === 0) {
        return false;
    }

    var reg = /[\u4e00-\u9FA5]+/;
    for (var i = 0; i < ret.rows.length; i++) {
        var data = ret.rows[i];
        if (!reg.test(data.name)) {
            data.name = crypto.fromBase64(data.name);
        }
    }

    return ret.rows;
};

//申请上周榜行榜 前15名列表
exports.get_last_week_rank_list = function () {
    var sql = 'SELECT userid,name,lastweek_score, lastweek_score as ranks_core FROM t_dht_norm_rank order by lastweek_score DESC limit 16';
    //  var sql = 'SELECT COUNT(userid) as rank FROM t_users WHERE total_score > ' + rankscore;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    if (ret.rows.length === 0) {
        return false;
    }

    var reg = /[\u4e00-\u9FA5]+/;
    for (var i = 0; i < ret.rows.length; i++) {
        var data = ret.rows[i];
        if (!reg.test(data.name)) {
            data.name = crypto.fromBase64(data.name);
        }
    }
    return ret.rows;
};

//更新上周排行榜 
exports.update_lastweek_rank_scores = function () {//麻将
    var sql = 'UPDATE t_dht_norm_rank SET lastweek_score = thisweek_score';
    var ret = dbpool.query(sql);
    // console.log(sql);
    if (ret.err) {
        console.error("[DB-BUG]update_rank--更麻将上周排行榜榜失败-->", ret.err);
        return false;
    }
    return true;
};

//清空本周排行榜
exports.clear_thisweek_rank_scores = function () {//麻将
    var sql = 'UPDATE t_dht_norm_rank SET thisweek_score =  ' + 0;
    var ret = dbpool.query(sql);
    // console.log(sql);
    if (ret.err) {
        console.error("[DB-BUG]update_rank--更麻将上周排行榜榜失败-->", ret.err);
        return false;
    }
    return true;
};

//查询自己的本周排名
exports.get_my_rank = function (thisweek_score) {
    var rankscore = thisweek_score;
    var sql = 'SELECT COUNT(userid) as rank FROM t_dht_norm_rank WHERE thisweek_score > ' + rankscore;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG]--get_my_rank--查询排名失败-->", ret.err);
        return 0;
    }

    if (ret.rows.length === 0) {
        return 0;
    }
    return ret.rows[0].rank + 1;
};
//===================麻将排行榜=====================end

//===================礼券相关=====================Start
/**增加玩家礼券 */
exports.add_user_coupon = function (userid, coupon) {
    if (userid == null || coupon == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET coupon = coupon +' + coupon + ' WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG]--add_user_coupon--[userid]:" + userid + '[coupon]:' + coupon, ret.err);
        return false;
    }

    return ret.rows.affectedRows > 0;
};

/**扣除玩家礼券 */
exports.cost_user_coupon = function (userid, coupon) {
    if (userid == null || coupon == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET coupon = coupon -' + coupon + ' WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return true;
};

//更新玩游戏次数
exports.update_gamenum = function (userid, gamenum) {
    if (userid == null || gamenum == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET gamenum = ' + gamenum + ' WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----update_gamenum:[" + userid + "]", ret.err);
        return false;
    }

    return ret.rows.affectedRows > 0;;
};

//更新添加玩游戏次数
exports.add_gamenum = function (userid, gamenum) {
    if (userid == null || gamenum == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET gamenum = gamenum +' + gamenum + ' WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----add_gamenum--userId:[" + userid + "]", ret.err);
        return false;
    }

    return ret.rows.affectedRows > 0;;
};

//创建礼券订单
exports.create_pay_coupon = function (userId, orderId, coupon, gems, itemId) {
    if (userId == null || orderId == null || itemId == null || coupon == null) {
        return false;
    }
    if (!gems) {
        gems = 0;
    }
    var time = parseInt(Date.now() * 0.001);
    var sql = "INSERT INTO t_pay_coupon(userid,order_id, coupon,gems, state, time) VALUES({0}, '{1}', {2}, {3}, {4}, {5})";
    sql = sql.format(userId, orderId, coupon, gems, itemId, time);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----create_pay_coupon--userId:[" + userId + "]", ret.err);
        return false;
    }

    return true;
};

//创建礼券兑换商品订单
exports.create_pay_commodity = function (userId, orderId, coupon, name, phone, itemId) {
    if (userId == null || orderId == null || itemId == null || coupon == null) {
        return false;
    }
    if (!name) {
        name = '';
    }
    if (!phone) {
        phone = '';
    }
    var time = parseInt(Date.now() * 0.001);
    var sql = "INSERT INTO t_pay_commodity(userid,order_id,name ,phone,coupon, state, time) VALUES({0}, '{1}', '{2}', '{3}', {4}, {5}, {6})";
    sql = sql.format(userId, orderId, name, phone, coupon, itemId, time);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----create_pay_commodity--userId:[" + userId + "]", ret.err);
        return false;
    }

    return true;
};

//查询礼券流水记录
exports.coupon_record = function (userId) {
    if (userId == null) {
        return false;
    }

    var sql = 'SELECT * FROM t_pay_coupon WHERE userid = "' + userId + '"';
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----coupon_record--userId:[" + userId + "]", ret.err);
        return false;
    }

    if (ret.rows.length === 0) {
        return false;
    }

    return ret.rows;
};

//查询商品流水记录
exports.commodity_record = function (userId) {
    if (userId == null) {
        return false;
    }

    var sql = 'SELECT * FROM t_pay_commodity WHERE userid = "' + userId + '"';
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----commodity_record--userId:[" + userId + "]", ret.err);
        return false;
    }

    if (ret.rows.length === 0) {
        return false;
    }

    return ret.rows;
};

//查询礼券商品列表
exports.coupon_commodity_list = function () {
    var sql = 'SELECT * FROM t_shop_coupon_commodity';
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----coupon_commodity_lis:-->", ret.err);
        return false;
    }
    if (ret.rows.length === 0) {
        return false;
    }
    return ret.rows;
};


//减少礼券商品列表产品数量
exports.updata_commoditylist_num = function (type) {
    let num = 1;
    var sql = 'UPDATE t_shop_coupon_commodity SET num = num -' + num + ' WHERE type = ' + type;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----updata_commoditylist_num:-->", ret.err);
        return false;
    }

    return true;
};

//查询有多少玩家绑定自己
exports.query_bind_my = function (userId) {
    if (userId == null) {
        return false;
    }

    var sql = 'SELECT userid,name,gamenum FROM t_users WHERE invitor = "' + userId + '"';
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----query_bind_my--userId:[" + userId + "]", ret.err);
        return false;
    }

    if (ret.rows.length === 0) {
        return false;
    }

    for (var i = 0; i < ret.rows.length; i++) {
        var data = ret.rows[i];
        data.name = crypto.fromBase64(data.name);
    }

    return ret.rows;
};


//更新 活动送礼券 状态
exports.coupon_activity_stat = function (userid, stat) {
    if (userid == null || stat == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET firstcoupon = ' + stat + ' WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return true;
};

//绑定邀请人ID
exports.bind_invitor = function (userid, invitor) {
    if (userid == null || invitor == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET invitor = ' + invitor + ' WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};

//查询自己绑定邀请人ID
exports.query_bind_invitor = function (userId) {
    if (userId == null) {
        return false;
    }

    var sql = 'SELECT invitor FROM t_users WHERE userid = "' + userId + '"';
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[DB-BUG] ----query_bind_invitor--userId:[" + userId + "]", ret.err);
        return false;
    }

    if (ret.rows.length === 0) {
        return false;
    }

    return ret.rows[0];
};


//===================礼券相关=====================end

//********************代理服务器调用相关db******************start
//====================代理标志自己的玩家账号==============
exports.agent_bound_userid = function (agentid, userid) {
    if (agentid == null || userid == null) {
        return false;
    }
    var sql = 'UPDATE t_users SET isagent = "' + agentid + '" WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return ret.rows.affectedRows > 0;
};

//获取游戏商品
exports.get_shop_data_tow = function (start, rows, callback) {
    var sql1 = 'SELECT count(*) as cnt FROM t_shop';
    var ret1 = dbpool.query(sql1);
    if (ret1.err) {
        console.error("[CHECKBUG]--get_shop_data_tow-->");
        return null;
    }
    var sql2 = `SELECT * FROM t_shop limit ${start},${rows}`;
    var ret2 = dbpool.query(sql2);
    if (ret2.err) {
        console.error("[CHECKBUG]--get_shop_data_tow-->");
        return null;
    }
    if (ret2.rows.length === 0) {
        return null;
    }

    ret2.rows[0].cnt = ret1.rows[0].cnt
    return ret2.rows;
};

//管理系统的游戏公告接口
exports.get_game_message = function (start, rows) {
    var sql = 'SELECT * FROM t_message limit ' + start + ',' + rows;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[CHECKBUG]--get_game_message-->");
        return false;
    }
    if (ret.rows.length === 0) {
        return null;
    }
    return ret.rows;
};

//添加游戏公告
exports.add_game_message = function (type, msg, version) {

    var sql = "INSERT INTO t_message(`type`,`msg`,`version`) VALUES('{0}','{1}','{2}')";
    sql = sql.format(type, msg, version);
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[CHECKBUG]--add_game_message-->");
        return false;
    }

    return true;
};

//禁封玩家
exports.forbiddenUser = function (userid) {
    if (userid == null) {
        return false
    }
    var sql = "UPDATE t_users SET forbidden = 1 where userid = " + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[CHECKBUG]--forbiddenUser-->");
        return false;
    }

    return true;
};

// 解除玩家禁封
exports.deleteUserF = function (userid) {
    if (userid == null) {
        return false
    }
    var sql = "UPDATE t_users SET forbidden = 0 where userid = " + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        console.error("[CHECKBUG]--deleteUserF-->");
        return false;
    }
    return true;
};

exports.get_pay_list = function (start, rows, user_id, start_time, end_time) {
    var userstr = ''
    var timestr = ''
    if (user_id) {
        userstr = `AND user_id =${user_id} `
    }
    if (start_time && end_time) {
        timestr = `AND time >${start_time / 1000}  and time<${end_time / 1000}`
    }
    var sqlCnt = `select count(*) as cnt ,sum(cost) as sum from t_pay_records where state = 3  ${userstr} ${timestr}`
    var sql = `SELECT * from t_pay_records where state = 3  ${userstr} ${timestr}  ORDER BY t_pay_records.time desc limit ${start},${rows}`;
    var ret = dbpool.query(sql);
    var sqlCnt = dbpool.query(sqlCnt);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }
    ret.rows[0].cnt = sqlCnt.rows[0].cnt
    ret.rows[0].sum = sqlCnt.rows[0].sum
    return ret.rows;
};




exports.get_change_record = function (start, rows, user_id, start_time, end_time) {
    var userstr = ''
    var timestr = ''
    if (user_id) {
        userstr = `AND user_id =${user_id} `
    }
    if (start_time && end_time) {
        timestr = `AND time >${start_time / 1000}  and time<${end_time / 1000}`
    }
    var sqlCnt = `select count(*) as cnt  from t_pay_commodity where state >0  ${userstr} ${timestr}`
    var sql = `SELECT * from t_pay_commodity where state >0  ${userstr} ${timestr}  ORDER BY t_pay_commodity.time desc limit ${start},${rows}`;
    var ret = dbpool.query(sql);
    var sqlCnt = dbpool.query(sqlCnt);
    if (ret.err || ret.rows.length == 0) {
        return null;
    }
    ret.rows[0].cnt = sqlCnt.rows[0].cnt
    return ret.rows;
};
exports.change_record_state = function (id) {

    var sql = `UPDATE t_pay_commodity SET state = 2 where id = ${id}`;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }
    return ret.rows.affectedRows > 0;
};

exports.get_welfare_records = function (start, rows, state, start_time, end_time, user_id) {
    var getRecordState = '';
    var time = '';
    var userid = '';
    if (state && state == 0 || state == 1) {
        getRecordState = `and t_welfare_records.state = ${state}`;
    }
    if (start_time && end_time) {
        time = `and time >= "${start_time}" and time <= "${end_time}"`
    }
    if (user_id) {
        userid = `and user_id=${user_id}`
    }
    var sql1 = `SELECT count(*) as cnt,sum(cost) as sumCost FROM t_welfare_records where cost>=0 ${getRecordState} ${time}`;

    var sql = `SELECT t_users.name as username,t_users.headimg,t_welfare_records.* FROM t_welfare_records,t_users where t_users.userid =t_welfare_records.user_id and cost>=0 ${getRecordState} ${time} ${userid} order by t_welfare_records.time desc limit ${start},${rows}`;
    var ret = dbpool.query(sql);
    var ret1 = dbpool.query(sql1);

    if (ret.err || ret.rows.length == 0) {
        return null
    }

    ret.rows[0].cnt = ret1.rows[0].cnt
    ret.rows[0].sumCost = ret1.rows[0].sumCost
    for (var i = 0; i < ret.rows.length; i++) {
        ret.rows[i].username = crypto.fromBase64(ret.rows[i].username)
    }
    return ret.rows
};


exports.deal_welfare_record = function (id) {

    var sql = `UPDATE t_welfare_records SET state = 1 WHERE id = '${id}'`;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }
    return ret.rows.affectedRows > 0;
};

exports.get_awards_config = function (start, rows, callback) {


    var sql1 = 'SELECT count(*) as cntPage FROM t_lucky_awards_config';
    var sql = `SELECT * FROM t_lucky_awards_config limit ${start},${rows}`;

    var ret = dbpool.query(sql, 1);
    var ret1 = dbpool.query(sql1);
    if (ret.err || ret.rows.length == 0) {
        return null
    }
    ret.rows[0].cntPage = ret1.rows[0].cntPage
    return ret.rows

};


exports.update_awards_config = function (id, type, num, name, prop, cnt) {

    var sql = "UPDATE  t_lucky_awards_config SET `type`={1},`num`={2},`name`='{3}',`prop`={4},`cnt`={5} WHERE `id`={0}";
    sql = sql.format(id, type, num, name, prop, cnt)
    var ret = dbpool.query(sql, 1);
    if (ret.err) {
        return false;
    }
    return ret.rows.affectedRows > 0;
}
//********************代理服务器调用相关db******************end
//大转盘相关db=================start


/**增加玩家抽奖次数 */
exports.add_user_luckynum = function (userid, luckynum) {
    if (userid == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET luckynum = luckynum +' + luckynum + ' WHERE userid = ' + userid;
    // console.log(sql)
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return true;
};

/**扣除玩家抽奖次数 */
exports.sub_user_luckynum = function (userid, luckynum) {
    if (userid == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET luckynum = luckynum -' + luckynum + ' WHERE userid = ' + userid;
    // console.log(sql)
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }

    return true;
};

/**清空所有玩家抽奖次数次数 */
exports.clear_luckynum = function () {
    var sql = 'UPDATE t_users SET luckynum = ' + 0;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }
};


/**添加玩家游戏次数 */
exports.add_user_gemdaysNum = function (userid, gamedaynum) {
    if (userid == null) {
        return false;
    }

    var sql = 'UPDATE t_users SET gamedaynum = gamedaynum +' + gamedaynum + ' WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }
};

/**清空所有玩家次数 */
exports.clear_gemsdayNum = function () {
    var sql = 'UPDATE t_users SET gamedaynum = ' + 0;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }
};

/**更新玩家次数 */
exports.update_gemsdayNum = function (userid) {
    if (userid == null) {
        return 0;
    }
    var sql = 'UPDATE t_users SET gamedaynum = ' + 0 + ' WHERE userid = ' + userid;;
    var ret = dbpool.query(sql);
    if (ret.err) {
        return false;
    }
};

//获取玩家今天的游戏次数
exports.get_gemsdayNum_userid = function (userid) {
    if (userid == null) {
        return 0;
    }

    var sql = 'SELECT gamedaynum FROM t_users WHERE userid = ' + userid;
    var ret = dbpool.query(sql);
    if (ret.err || ret.rows.length == 0) {
        return 0;
    }

    var data = ret.rows[0];
    return data.gamedaynum;
};
//大转盘相关db=================end


//-------------比赛场start------------------------
//创建新的比赛场
exports.add_match_list = function (matchdata) {
    let matchId = matchdata.id,
        type = matchdata.type,
        title = matchdata.title,
        rewards = matchdata.rewards,
        people_limit = matchdata.people_limit,
        consume = matchdata.consume,
        game_type = matchdata.game_type,
        isPlay = matchdata.isPlay,
        isCycle = matchdata.isCycle,
        base_turns = matchdata.base_turns,
        match_type = matchdata.match_type,
        order_weight = matchdata.order_weight,
        match_password = matchdata.match_password,
        game_conf = matchdata.game_conf || '',
        match_icon = matchdata.match_icon;
    return new Promise(function (resolve, reject) {
        var isPlay = 0;
        var sql = "INSERT INTO t_match_list(id,type,title,rewards,people_limit,consume,game_type,isPlay,isCycle,base_turns,match_type,order_weight,create_time,match_password,match_icon,game_conf) \
                    VALUES({0},'{1}','{2}','{3}',{4},'{5}','{6}',{7},{8},{9},{10},{11},{12},{13},'{14}','{15}')";

        let create_time = Date.now();
        let password = match_password || 0;

        var rewardsInfo = JSON.stringify(rewards);
        var consumeInfo = JSON.stringify(consume);
        sql = sql.format(parseInt(matchId), type, title, rewardsInfo, people_limit, consumeInfo, game_type, isPlay, isCycle, base_turns, match_type, order_weight, create_time, password, match_icon, game_conf);
        var ret = dbpool.query(sql);
        if (ret.err) {
            console.error("[CHECKBUG]--add_match_list-->");
            reject(ret.err);
        } else {
            resolve(matchId)
        }
    })
};


//更新比赛场状态
exports.update_isPlay = function (matchId, callback) {
    if (matchId == null) {
        callback(false);
        return;
    }

    var sql = 'UPDATE t_match_list SET isPlay = 1 WHERE id = ' + matchId;
    console.log(sql);
    var ret = dbpool.query(sql);
    if (ret.err) {
        callback(false);
        console.error(ret.err.stack);
        return;
    } else {
        callback(ret.rows.affectedRows > 0);
    }
};

//是否有该比赛场
exports.get_has_match = function (matchId) {
    return new Promise(function (resolve, reject) {
        if (matchId == null) {
            reject()
        }
        var sql = `SELECT * FROM t_match_list WHERE id = ${matchId}`;

        var ret = dbpool.query(sql)
        if (ret.err) {
            reject(ret.err);
        } else {
            if (ret.rows.length == 0) {
                resolve(false)
            } else {
                if (ret.rows[0] == null) {
                    resolve(false)
                } else {
                    resolve(true)
                }
            }
        }
    })
};

// //#region promise写法
exports.match_user_data = function (account) {
    return new Promise(function (resolve, reject) {
        if (account == null) {
            reject()
        }
        var sql = 'SELECT * FROM t_users WHERE account = "' + account + '"';
        var ret = dbpool.query(sql);
        if (ret.err) {
            console.error("[DB-BUG] ---match_user_data--account:[" + account + "]", ret.err);
            reject(null);
        } else {
            if (ret.rows.length == 0) {
                resolve(null)
            } else {
                if (ret.rows[0] == null) {
                    resolve(null)
                } else {
                    var data = ret.rows[0];
                    data.name = crypto.fromBase64(data.name);
                    resolve(data)
                }
            }
        }
    })
};

//获取比赛场列表
exports.get_match_list = function (game_type, type, matchId) {
    return new Promise(function (resolve, reject) {
        if (game_type == null || type == null) {
            reject()
        }
        if (type == 'other' && matchId == null) {
            reject()
        }
        var sql = null
        if (game_type == 'all' && type == 'all') {
            sql = 'SELECT * FROM `t_match_list`';
        } else if (type == 'sys') {//系统赛制 搜索当前包含game_type的所有比赛
            sql = 'SELECT * FROM `t_match_list` WHERE type = "' + type + '" AND game_type like "%' + game_type + '" AND isPlay = "0"';
        } else if (type == 'other') {//商家赛制 根据matchId搜索比赛
            sql = 'SELECT * FROM `t_match_list` WHERE type = "' + type + '" AND id = "' + matchId + '" AND isPlay = "0"';
        }

        var ret = dbpool.query(sql)
        if (ret.err) {
            console.error("[CHECKBUG]--get_match_list-->");
            reject(ret.err);
        } else {
            if (ret.rows.length == 0) {
                resolve([])
            } else {
                if (ret.rows[0] == null) {
                    resolve([])
                } else {
                    resolve(ret.rows)
                }
            }
        }
    })
};

//数据库删除比赛场
exports.delete_match = function (matchId) {
    return new Promise(function (resolve, reject) {
        if (matchId == null) {
            reject()
        }

        var sql = `DELETE FROM t_match_list WHERE id = ${matchId}`;
        var ret = dbpool.query(sql);
        if (ret.err) {
            console.error("[DBBUG]--delete_match-->", ret.err);
            reject(false)
        } else {
            resolve(true);
        }
    })
}



//更新比赛场状态
exports.update_match_isPlay = function (matchId) {
    return new Promise(function (resolve, reject) {
        if (matchId == null) {
            reject()
        }

        var sql = `UPDATE t_match_list SET isPlay = 1 WHERE id = ${matchId}`;

        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err)
        } else {
            console.log('------------', ret.rows.affectedRows);
            resolve(true)
        }
    })
};

//保存比赛场前三名信息
exports.save_ranking_info = function (title, top, userid, rewards, game_type, type, matchId, is_delivery) {
    return new Promise(function (resolve, reject) {
        var sql = "INSERT INTO t_match_record(uuid,title,top,userid,rewards,game_type,type,matchid,is_delivery) \
        VALUES({0},'{1}',{2},{3},'{4}','{5}','{6}',{7},{8})";
        var uuid = parseInt(Date.now() * 0.001) + userid;

        sql = sql.format(parseInt(uuid), title, top, userid, rewards, game_type, type, matchId, is_delivery);
        var ret = dbpool.query(sql);
        if (ret.err) {
            console.error("[CHECKBUG]--save_ranking_info-->");
            reject(ret.err);
        } else {
            resolve(uuid)
        }
    })
};

//客户端获取中奖记录
exports.get_reward_list = function (userId) {
    return new Promise(function (resolve, reject) {
        if (userId == null) {
            reject();
        }
        var sql = `SELECT * FROM t_match_record WHERE userid = ${userId}`;

        var ret = dbpool.query(sql)
        if (ret.err) {
            console.error("[CHECKBUG]--get_reward_list-->");
            reject(ret.err);
        } else {
            if (ret.rows.length == 0) {
                resolve([])
            } else {
                if (ret.rows[0] == null) {
                    resolve([])
                } else {
                    resolve(ret.rows)
                }
            }
        }
    })
}

//管理端获取所有中奖记录
exports.get_match_reward = function () {
    return new Promise(function (resolve, reject) {
        var sql = 'SELECT * FROM `t_match_record` ';
        var ret = dbpool.query(sql)
        if (ret.err) {
            console.error("[CHECKBUG]--get_match_reward-->");
            reject(ret.err);
        } else {
            if (ret.rows.length == 0) {
                resolve([])
            } else {
                if (ret.rows[0] == null) {
                    resolve([])
                } else {
                    resolve(ret.rows)
                }
            }
        }
    })
}

//更新中将记录
exports.update_match_reward = function (uuid) {
    return new Promise(function (resolve, reject) {
        if (uuid == null) {
            reject();
        }

        var sql = `UPDATE t_match_record SET is_delivery = 1 WHERE uuid = ${uuid}`

        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err)
        } else {
            resolve(ret.rows.affectedRows > 0)
        }
    })
}
//更新比赛图片
exports.update_match_icon_path = function (matchId, path) {
    return new Promise(function (resolve, reject) {
        if (matchId == null || path == null) {
            reject();
        }

        var sql = `UPDATE t_match_list SET match_icon = "${path}" WHERE id = ${matchId}`

        var ret = dbpool.query(sql);
        if (ret.err) {
            reject(ret.err)
        } else {
            resolve(ret.rows.affectedRows > 0)
        }
    })
}
//#endregion promise
//-------------比赛场相关end---------------------