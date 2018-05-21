
var gameInfoByGameType = null;
/**
 * 获取游戏信息
 *  @param  {String} game_type       游戏的ID
 *  @return 游戏的信息
 */
function getGameInfoByGameType(game_type) {
    if (!gameInfoByGameType) {
        var tLog = "";
        gameInfoByGameType = {};
        for (var tKey in gc.enum.E_SUB_GAME_LIST) {
            var tSubGameInfo = gc.enum.E_SUB_GAME_LIST[tKey];
            if (!tSubGameInfo || !tSubGameInfo.enable) {
                continue;
            }
            gameInfoByGameType[tSubGameInfo.id] = tSubGameInfo;
            tLog += " id " + tSubGameInfo.id + " game info " + tSubGameInfo + "\n";
        }
        console.log(tLog);
    }
    if (!gameInfoByGameType[game_type]) {
        try {
            tLog.aaaa;
        } catch (error) {
            console.error(" 没有对应的游戏 game type ", game_type);
            console.error(error);
        }
        // console.error(" 没有对应的游戏 game type ", game_type);
    }
    return gameInfoByGameType[game_type] || null;
}

var gameInfoByConfType = null;
/**
 * 获取游戏信息
 *  @param  {String} conf_type       游戏的名字
 *  @return 游戏的信息
 */
function getGameInfoByConfType(conf_type) {
    if(conf_type == 'xmmj'){
        conf_type = 'qzmj';
    }
    if (!gameInfoByConfType) {
        var tLog = "";
        gameInfoByConfType = {};
        for (var tKey in gc.enum.E_SUB_GAME_LIST) {
            var tSubGameInfo = gc.enum.E_SUB_GAME_LIST[tKey];
            if (!tSubGameInfo || !tSubGameInfo.enable) {
                continue;
            }
            gameInfoByConfType[tSubGameInfo.conf_type] = tSubGameInfo;
            tLog += " conf type " + tSubGameInfo.conf_type + " game info " + tSubGameInfo + "\n";
        }
        console.log(tLog);
    }
    if (!gameInfoByConfType[conf_type]) {
        try {
            tLog.aaaa;
        } catch (error) {
            console.error(" 没有对应的游戏 conf type ", conf_type);
            console.error(error);
        }
    }
    return gameInfoByConfType[conf_type] || null;
}


/**
 * 获取游戏信息
 *  @param  {String} game_type       游戏的ID
 *  @return 游戏的信息
 */
exports.getGameInfoByGameType = getGameInfoByGameType;
/**
 * 获取游戏信息
 *  @param  {String} conf_type       游戏的名字
 *  @return 游戏的信息
 */
exports.getGameInfoByConfType = getGameInfoByConfType

/**
 * 获取游戏信息
 *  @param  {String} game_type       游戏的ID
 *  @return 游戏的信息
 */
exports.getGameLogicByGameType = function (game_type) {
    var tGameInfo = getGameInfoByGameType(game_type);
    if (!tGameInfo) { return null; }
    if (tGameInfo.logic) { return tGameInfo.logic; }
    tGameInfo.logic = require(tGameInfo[logic_script_name]);
    return tGameInfo.logic;
}

var gameLogicByConfType = null;
/**
 * 获取游戏信息
 *  @param  {String} conf_type       游戏的名字
 *  @return 游戏的信息
 */
exports.getGameLogicByConfType = function (conf_type) {
    var tGameInfo = getGameInfoByConfType(conf_type);
    if (!tGameInfo) { return null; }
    if (tGameInfo.logic) { return tGameInfo.logic; }
    tGameInfo.logic = require(tGameInfo[logic_script_name]);
    return tGameInfo.logic;
}

/** 
 * 获取游戏的场景
 *  @param  {String} game_type       游戏的id
 *  @return 游戏的场景名字
 */
exports.getGameSceneNameByGameType = function (game_type) {
    var tGameInfo = getGameInfoByGameType(game_type);
    if (!tGameInfo) { return null; }
    return tGameInfo.game_scene;
}

/** 
 * 获取游戏的场景
 *  @param  {String} conf_type       游戏的名字
 *  @return 游戏的场景名字
 */
exports.getGameSceneNameByConfType = function (conf_type) {
    var tGameInfo = getGameInfoByConfType(conf_type);
    if (!tGameInfo) { return null; }
    return tGameInfo.game_scene;
}

/** 
 * 获取大厅的场景
 *  @param  {String} game_type       游戏的ID
 *  @return 大厅的场景名字
 */
exports.getHallNameByGameType = function (game_type) {
    var tGameInfo = getGameInfoByGameType(game_type);
    if (!tGameInfo) { return null; }
    return tGameInfo.hall_scene;
}

/** 
 * 获取大厅的场景
 *  @param  {String} conf_type       游戏的名字
 *  @return 游戏的大厅名字
 */
exports.getGameHallNameByConfType = function (conf_type) {
    var tGameInfo = getGameInfoByConfType(conf_type);
    if (!tGameInfo) { return null; }
    return tGameInfo.hall_scene;
}

/** 
 * 获取游戏的名字
 *  @param  {String} game_type       游戏的id
 *  @return {String} 游戏的id或者叫做gameType、游戏的类型
 */
exports.getGameTypeByGameType = function (game_type) {
    var tGameInfo = getGameInfoByGameType(game_type);
    if (!tGameInfo) { return null; }
    return tGameInfo.conf_type;
}

/** 
 * 获取游戏的id
 *  @param  {String} conf_type       游戏的名字
 *  @return {String} 游戏的id或者叫做gameType、游戏的类型
 */
exports.getGameTypeByConfType = function (conf_type) {
    var tGameInfo = getGameInfoByConfType(conf_type);
    if (!tGameInfo) { return null; }
    return tGameInfo.id;
}

/**
 *  获取子游戏资源路径
 *  @param  {String} game_type       游戏的ID
 *  @return {String} 子游戏的资源路径
 */
exports.getSubGameResourcePathByGameType = function (game_type, sub_path) {
    sub_path = sub_path || "resources";
    var tGameFloderName = gc.masterSettings.folder;
    return "resources/" + tGameFloderName + "/" + sub_path + "/";
}

/**
 *  获取子游戏资源路径
 *  @param  {String} conf_type       游戏的名字
 *  @return {String} 子游戏的资源路径
 */
exports.getSubGameResourcePathByConfType = function (conf_type) {
    sub_path = sub_path || "resources";
    var tGameFloderName = gc.masterSettings.folder;
    return tGameFloderName + "/" + sub_path + "/";
}


/** 临时放这里**/
/** 临时放这里**/
/** 临时放这里**/
/** 临时放这里**/
/** 临时放这里**/
/** 临时放这里**/
exports.addGameAdapter= function (adapter){
    gc.curGameAda = adapter;
}