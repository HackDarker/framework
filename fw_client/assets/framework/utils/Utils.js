var staticNodeObj = {};

/**
 * 文本格式化，不改变原字符串 两种调用方式
var template1 = "你是{0}，今年{1}了";
var template2 = "你是{name}，今年{age}了";
var result1 = template1.format("aaa", 22);
var result2 = template2.format({ name: "aaa", age: 22 });
 两个结果都是"你是aaa，今年22了"
 来源：http://www.cnblogs.com/loogn/archive/2011/06/20/2085165.html
 */
String.prototype.format = function (args) {
    var result = this;
    if (arguments.length <= 0) { return result; }
    if (arguments.length == 1 && typeof (args) == "object") {
        for (var key in args) {
            if (args[key] != undefined) {
                var reg = new RegExp("({" + key + "})", "g");
                result = result.replace(reg, args[key]);
            }
        }
    }
    else {
        for (var i = 0; i < arguments.length; i++) {
            if (arguments[i] == undefined) { continue; }
            var reg = new RegExp("({)" + i + "(})", "g");
            result = result.replace(reg, arguments[i]);
        }
    }
    return result;
};

function getStaticNode(nodeName) {
    if (typeof Editor != "undefined") {           //编辑器特殊处理
        return false;
    }

    if (!nodeName) {
        return null;
    }
    var tNode = null;
    var tWidgete = null;
    if (nodeName in staticNodeObj) {
        tNode = staticNodeObj[nodeName];
    }
    else {
        tNode = new cc.Node(nodeName);
        tNode.name = nodeName;
        staticNodeObj[nodeName] = tNode;
    }

    tWidgete = tNode.getComponent(cc.Widget);
    if (!tWidgete) {
        //设定自适应宽高
        tWidgete = tNode.addComponent(cc.Widget);
        tWidgete.isAlignTop = true;
        tWidgete.isAlignBottom = true;
        tWidgete.isAlignLeft = true;
        tWidgete.isAlignRight = true;

        tWidgete.top = 0;
        tWidgete.bottom = 0;
        tWidgete.left = 0;
        tWidgete.right = 0;

        tWidgete.isAlignOnce = true;
    }
    if (!cc.director.getScene()) {
        return null;
    }
    if (!tNode.parent) {
        cc.director.getScene().addChild(tNode);        //添加到场景根节点   
    }
    cc.game.addPersistRootNode(tNode);              //设置为常驻结点
    tWidgete.updateAlignment();
    return tNode;
}

function delStaticNode(nodeName) {
    var tNode = null;
    if (nodeName in staticNodeObj) {
        tNode = staticNodeObj[nodeName];
    }
    if (!tNode) {
        return;
    }
    cc.game.removePersistRootNode(tNode);
    delete staticNodeObj[nodeName];
    tNode.removeFromParent();
}

//预先加载场景--cheng--
function preloadScene(sceneName, cb) {
    cc.director.preloadScene('game_0020001', function (cb) {
        if (cb) {
            cb();
        }
    });
}

function setFitSreenMode() {
    var node = cc.find('Canvas');
    var w = node.width;
    var h = node.height;

    var cvs = node.getComponent(cc.Canvas);
    var dw = cvs.designResolution.width;
    var dh = cvs.designResolution.height;
    //如果更宽 则让高显示满
    if ((w / h) > (dw / dh)) {
        cvs.fitHeight = true;
        cvs.fitWidth = false;
    }
    else {
        //如果更高，则让宽显示满
        cvs.fitHeight = false;
        cvs.fitWidth = true;
    }
}

var loadingScene = null;
function loadScene(sceneName, cb, no_wc) {
    gc.ui.closeALLUI();
    if (!no_wc) {
        gc.wc.showWC("old_desc");
    }

    if (loadingScene == sceneName) {
        return;
    }

    loadingScene = sceneName;

    var onSceneLoaded = function () {
        gc.wc.hideWC();
        setFitSreenMode();

        console.log(sceneName + ' loaded.');
        loadingScene = null;

        if (cb) {
            cb();
        }

        cc.game.emit('scene_switched');

        addEscEvent(cc.find("Canvas"));

        checkVersion();

        //定期GC
        setTimeout(() => {
            cc.sys.garbageCollect();
        }, 300)
    }
    if (!cc.director.loadScene(sceneName, onSceneLoaded)) {
        gc.wc.hideWC();
        gc.alert.showUI("无法切换场景");
    }

    gc.animation.clear();
    gc.sprite.clear();
}

//  callback    回调函数
//  parms   回调函数参数列表
//  caller  回调函数的this
function struct_Callback(callback, parms, caller) {
    return {
        callback: callback,
        caller: caller,
        parms: parms,
        name: "struct_utils_callback"
    };
}

//执行struct_Callback
function exeCallback(callback, arg) {
    if (!callback) {
        return;
    }
    var tParms = [];
    var parms = [];
    var tLen = arguments.length;
    for (var i = 1; i < tLen; i++) {
        parms.push(arguments[i]);
    }

    if (typeof (callback) === "function") {
        if (arg) {
            callback.apply(arg, parms);
        }
        else {
            callback(parms);
        }
        return;
    }

    if ((callback.name !== "struct_utils_callback")) {
        cc.log(" exeCallback : this callback is't a valid type ");
        return;
    }
    if (callback.parms !== null) {
        tParms = tParms.concat(callback.parms);
    }
    tParms = tParms.concat(parms);
    if (callback.caller) {
        callback.callback.apply(callback.caller, tParms)
    }
    else {
        callback.callback(tParms)
    }
}

// 获取脚本组件的名字
function getScriptComponentName(component) {
    if (typeof (component) !== "string") {
        var tmpScript = component;
        component = tmpScript.name.split("<")[1].split(">")[0];
    }
    return component;
}

function shareGame(title, desc) {
    var tCallBack = function (shareUI) {
        var tShareScript = shareUI.getComponent("share");
        tShareScript.title = title;
        tShareScript.desc = desc;
    };

    gc.ui.showUI("share");
}

function copyCompValue(toNode, fromNode, compType) {
    var toNodeComp;
    var fromNodeComp;
    if (!toNode) {
        return toNodeComp;
    }

    toNodeComp = toNode.getComponent(compType);
    if (fromNode) {
        fromNodeComp = fromNode.getComponent(compType);
        if (fromNodeComp && !fromNodeComp.enabled) {
            fromNodeComp = null;
        }
    }

    if (!fromNodeComp) {
        return toNodeComp;
    }

    if (toNodeComp) {
        toNodeComp.enabled = (fromNodeComp != null);
    }

    if (!toNodeComp) {
        toNodeComp = toNode.addComponent(compType);
    }

    var tVariableList = getComponentVariable(compType);
    for (var i = 0; i < tVariableList.length; i++) {
        var variable = tVariableList[i];
        if (!variable || !(variable in fromNodeComp)) {
            continue;
        }

        toNodeComp[variable] = fromNodeComp[variable];
    }
    return toNodeComp;
}

//地球半径
const EARTH_RADIUS = 6378137.0; //单位M
//PI值
const PI = Math.PI;
function getRad(d) {
    return d * PI / 180.0;
}
/**
 * 根据GPS两点经纬度信息计算距离
 * @param  {Number} latitude1 点1 GPS 经度
 * @param  {Number} longitude1 点1 GPS 纬度
 * @param  {Number} latitude2 点2 GPS 经度
 * @param  {Number} longitude2 点2 GPS 纬度
 * @return {Number}           两点距离
 */
function getFlatternDistance(latitude1, longitude1, latitude2, longitude2) {
    if ((latitude1 === latitude2) && (longitude1 === longitude2)) {
        return 0;
    }
    cc.log("gc pt1 (", latitude1, ",", longitude1, ") pt2 (", latitude2, ",", longitude2, ")");
    var lat1 = latitude1;
    var lng1 = longitude1;
    var lat2 = latitude2;
    var lng2 = longitude2;

    if (lat1 == null || lng1 == null ||
        lat2 == null || lng2 == null) {
        console.log('invalid gps info');
        return Number.NaN;
    }


    var f = getRad((lat1 + lat2) / 2);
    var g = getRad((lat1 - lat2) / 2);
    var l = getRad((lng1 - lng2) / 2);

    var sg = Math.sin(g);
    var sl = Math.sin(l);
    var sf = Math.sin(f);

    var s, c, w, r, d, h1, h2;
    var a = EARTH_RADIUS;
    var fl = 1 / 298.257;

    sg = sg * sg;
    sl = sl * sl;
    sf = sf * sf;

    s = sg * (1 - sl) + (1 - sf) * sl;
    c = (1 - sg) * (1 - sl) + sf * sl;

    w = Math.atan(Math.sqrt(s / c));
    r = Math.sqrt(s * c) / w;
    d = 2 * w * a;
    h1 = (3 * r - 1) / 2 / c;
    h2 = (3 * r + 1) / 2 / s;

    var tValue = d * (1 + fl * (h1 * sf * (1 - sg) - h2 * (1 - sf) * sg));
    cc.log("gc value ", tValue);
    return tValue;
};

function getGPSData() {
    var tGpsData = null;

    if (!gc.anysdk.isHasPermission(gc.enum.E_PERMISSION.GPS)) {
        return null;
    }

    var tGPSEnum = gc.enum.E_GPS_BAIDU_LOCATION_TYPE;
    var tObj = gc.anysdk.getGPSInfo(true);
    if (!tObj) {
        return null;
    }

    switch (tObj.type - 0) {
        case tGPSEnum.GPS:
        case tGPSEnum.NET:
        case tGPSEnum.TEMP:
        case tGPSEnum.OFF_LINE:
            tGpsData = {
                lat: tObj.latitude,
                lng: tObj.longitude,
                addr: tObj.addr
            };
            break;
    }

    console.log(tObj, "type ", tObj.type, " lat ", tObj.latitude, " lng ", tObj.longitude, " alt ", tObj.altitude, " addr ", tObj.addr);

    return tGpsData ? JSON.stringify(tGpsData) : null;
}

var componentVariableDict = null;
function getComponentVariable(compName) {
    if (!componentVariableDict) {
        componentVariableDict = {};
        componentVariableDict[cc.Sprite] = ["spriteFrame", "type", "fillType", "fillCenter", "fillStart", "fillRange", "trim", "srcBlendFactor", "dstBlendFactor", "sizeMode"];
        componentVariableDict[cc.Widget] = ["target", "isAlignTop", "isAlignVerticalCenter", "isAlignBottom", "isAlignLeft", "isAlignHorizontalCenter", "isAlignRight", "top", "bottom", "left", "right", "horizontalCenter", "verticalCenter", "isAbsoluteHorizontalCenter", "isAbsoluteVerticalCenter", "isAbsoluteTop", "isAbsoluteBottom", "isAbsoluteLeft", "isAbsoluteRight", "isAlignOnce"];
        componentVariableDict[cc.Layout] = ["type", "resizeMode", "cellSize", "startAxis", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom", "spacingX", "spacingY", "verticalDirection", "horizontalDirection", "padding"];
    }
    return componentVariableDict[compName];
}

function shrinkName(name, maxChars, suffix) {
    if (!suffix) {
        suffix = '...';
    }
    if (!maxChars) {
        maxChars = 10;
    }

    var numChar = 0;
    for (var i = 0; i < name.length; ++i) {
        if (name.charCodeAt(i) >= 128) {
            numChar += 2;
        }
        else {
            numChar += 1;
        }
        if (numChar > maxChars) {
            break;
        }
    }
    if (i == name.length) {
        return name;
    }

    return name.substring(0, i) + suffix;
}

/** 按了返回按钮 (一次只支持一个回调函数) */
function onReturnKeyPress(callback) {
    this.onBackKey = callback;
}
exports.addEscEvent = addEscEvent;
function addEscEvent(node) {
    cc.log("gc add esc event ");
    var listener = {
        event: cc.EventListener.KEYBOARD,

        onKeyPressed: function (keyCode, event) {
        }.bind(gc.utils),

        onKeyReleased: function (keyCode, event) {
            cc.log("gc andior on key ", keyCode);
            switch (keyCode) {
                case cc.KEY.back:
                case cc.KEY.escape:
                    if (!this.onBackKey) { return; }
                    this.onBackKey();
                case 27://键盘ESC
                    if (!this.onBackKey) { return; }
                    this.onBackKey();
                    break;
            }
        }.bind(gc.utils)
    };

    cc.eventManager.addListener(listener, node);
    // cc.EventTarget.addListener(listener, node);
};

/**
 * 通过xhr强制加载文件
 * @param {String} url      路径
 * @param {String} type     类型
 * @param {Function} cb     回调
 */
function loadRemoteRes(url, type, cb) {
    var xhr = cc.loader.getXMLHttpRequest();
    xhr.open("GET", url, true);
    if (type == null) {
        type = 'text';
    }
    xhr.responseType = type;
    xhr.onload = function (e) {
        if (xhr.readyState == 4 && (xhr.status >= 200 && xhr.status <= 207)) {
            //console.log('status:' + xhr.statusText);
            //console.log('type:' + xhr.responseType);
            if (type == 'arraybuffer') {
                var arrayBuffer = xhr.response;
                if (arrayBuffer) {
                    var result = new Uint8Array(arrayBuffer);
                    cb(null, result);
                }
                else {
                    cb('arraybuffer is null', null);
                }
            }
            else {
                cb(null, xhr.responseText);
            }
        }
    }

    xhr.onerror = function (e) {
        cb(e, null);
    }

    xhr.onprogress = function (e) {
        console.log(e.loaded + " of " + e.total + " bytes");
    }

    xhr.send();
}

var checkVersionCallIdx = -1;
/** 检查游戏版本是否有更新 */
function checkVersion() {
    if (checkVersionCallIdx != -1) {
        clearTimeout(checkVersionCallIdx);
        checkVersionCallIdx = -1;
    }
    checkVersionCallIdx = setTimeout(checkCVVersion, 5 * 1000);
};
/** 检查游戏版本是否有强制更新 */
function checkCVVersion() {
    checkVersionCallIdx = -1;
    if (!cc.hotUpdatePath || !cc.sys.isNative) { return; }
    if (!gc.SI || !gc.SI.version) { return; }

    var onServerVersionInfoResult = function (ret) {
        if (!ret || ret.errcode !== 0 || !ret.version) {
            console.log(" 版本信息获取错误 ", ret.errcode);
        } else {
            if (ret.version != cc.CORE_VERSION) {
                gc.alert.showUI("客户端有强制更新啦！\n请重新下载客户端", function () { cc.sys.openURL(gc.SI.appweb); });
            }
            else {
                checkHotUpdataVersion(ret);
            }
        }
    };

    gc.http.sendRequest("/get_serverinfo", { cv: cc.CORE_VERSION, platform: cc.sys.os }, onServerVersionInfoResult, null, true);
};
/** 检查游戏版本是否有热更新 */
function checkHotUpdataVersion(ret) {
    var client_version = ret.version;       //强制更新版本号
    var update_url = ret.update_url;        //热更新地址
    var hall_url = ret.hall;                //大厅服务器地址
    var app_web_url = ret.appweb;           //app下载地址
    var server_hot_version = "";

    var clientVersionTooOld = function () {
        gc.alert.showUI(("版本过旧\n请下载并安装新版本"), function () {
            clientVersionTooOld();
            cc.sys.openURL(gc.SI.appweb);
        });
    }

    if (!gc.SI) { return; }
    if (client_version != gc.SI.version) {                                                                      //客户端版本号相同 代表是当前是最新的客户端版本号
        clientVersionTooOld();
    }

    var onVersionLoaded = function (old_server_hot_version, hot_version) {
        if (old_server_hot_version != hot_version) {                                                            //当前获取的服务器热更新版本与启动游戏时的热更新版本相同 代表 当前是最新的热更新版本或者正在热更新
            gc.alert.showUI(("客户端有版本更新啦！\n客户端版本号:" + (old_server_hot_version + "\n服务器版本号:" + hot_version)), function () {
                gc.http.url = gc.http.master_url;
                gc.utils.restart();
            });
        }

    };

    function onServerResult(err, data) {
        if (!data) { return; }
        var localInfo = JSON.parse(data);
        server_hot_version = localInfo.version;                 //服务器热更新版本号
        onVersionLoaded(gc.SI.server_hot_version, server_hot_version);
    }

    var url = "";
    url = update_url + "/version.manifest";
    gc.utils.loadRemoteRes(url, 'text', onServerResult.bind(this));
};

/**
 * 随机数串生成器
 */
exports.randomNum = function (length) {
    var num = "";
    for (var i = 0; i < length; ++i) {
        num += Math.floor(Math.random() * 10);
    }
    return num;
};

/*在某个节点上播放特效*/
exports.playEfx = gc.animation.playEfx;

exports.setFitSreenMode = setFitSreenMode;
exports.loadScene = loadScene;
exports.getStaticNode = getStaticNode;

/**
 * 创建一个回调函数
 * @param  {Function} callback    回调函数
 * @param  {Array} parms    回调函数参数列表
 * @param  {Object} caller    回调函数的this
 */
exports.struct_Callback = struct_Callback;
/**执行struct_Callback  (多参数必须填写调用者，否则函数的this为null)
*  @param  {Object} callback    gc.utils.struct_Callback 或 function
*  @param  {Object} arg         callback为bk.utils.struct_Callback —— 函数的附加参数 ，参数长度不定
*                               callback为function —— 调用者 + 函数的附加参数 ，参数长度不定
**/
exports.exeCallback = exeCallback;

/** 获取脚本组件的名字 */
exports.getScriptComponentName = getScriptComponentName;

/** 分享游戏 */
exports.shareGame = shareGame;

/** 复制 fromNode 节点的 compType 组件的属性到 toNode 节点的 compType 组件中
*  @param  {Object} toNode
*  @param  {Object} fromNode
*  @param  {Object} compType
**/
exports.copyCompValue = copyCompValue;

/**
 * 获取GPS的经纬度
 * @return {Number,Number}           经度,纬度
 */
exports.getGPSData = getGPSData;
/**
 * 根据GPS两点经纬度信息计算距离
 * @param  {Number} latitude1 点1 GPS 经度
 * @param  {Number} longitude1 点1 GPS 纬度
 * @param  {Number} latitude2 点2 GPS 经度
 * @param  {Number} longitude2 点2 GPS 纬度
 * @return {Number}           两点距离
 */
exports.getFlatternDistance = getFlatternDistance;

/**
 * 截断过长的名字，并返回对应的字符串
 * 
 * 
 * @param  {string} name 原始字符串
 * @param  {Number} maxChars 最大字符（汉字算两个字符） 默认是 10（即5个汉字）
 * @param  {string} suffix 后缀，  默认是  '...'  

 * @return {string} 处理后的名字。
 */
exports.shrinkName = shrinkName;

/**
 * 返回按钮点下的回调
 *  @param {Function} callback 回调函数
 */
exports.onReturnKeyPress = onReturnKeyPress;
/**
 * 通过xhr强制加载文件
 * @param {String} url      路径
 * @param {String} type     类型
 * @param {Function} cb     回调
 */
exports.loadRemoteRes = loadRemoteRes;

/** 检查游戏版本是否有更新 */
exports.checkVersion = checkVersion;

exports.preloadScene = preloadScene;

exports.getLoadingScene = function () {
    return loadingScene;
}

exports.restart = function () {
    gc.audio.stopAll();
    cc.game.restart();
}