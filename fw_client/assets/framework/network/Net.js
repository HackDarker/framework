if (window.io == null) {
    window.io = require("socket-io");
}

exports.ip = '';
var sio = null;
var isPinging = false;
var fnDisconnect = null;
var gameEventHandlers = {};
var socketEventHandlers = {};
var lastRecieveTime = null;

var lastSendTime = null;
var delayMS = null;

init();

function init() {
    exports.ip = '';
    sio = null;
    isPinging = false;
    fnDisconnect = null;
    gameEventHandlers = {};
}

/**
 * 将target对象所有前缀为onnet_的函数作为socket消息处理函数，消息名为函数名去掉onnet_
 * @param {Object} target 
 */
function addTarget(target) {
    if (!target) { return }
    var prefix = 'onnet_';
    target.net_list = target.net_list || [];
    for (var k in target) {
        if (k.search(prefix) == 0) {
            var event = k.substr(prefix.length);
            var fn = target[k];
            var tFunc = fn.bind(target);
            addHandler(event, tFunc);
            target.net_list.push({ event: event, func: tFunc });
        }
    }
}

/**
 * 将target对象所有注册的socket消息处理函数移除
 * @param {Object} target 
 */
function removeTarget(target) {
    if (!target) { return; }
    if (!target.net_list) { return; }
    for (var i = 0; i < target.net_list.length; i++) {
        var tNetInfo = target.net_list[i];
        var handleList = gameEventHandlers[tNetInfo.event] || [];
        var tFuncIdx = handleList.indexOf(tNetInfo.func);
        if (tFuncIdx == -1) { continue; }
        handleList.splice(tFuncIdx, 1);
    }
}

function gamemsgHandler(param) {
    console.log('[Debug] - gamemsghandler called.');
    // try {
    var isStr = (typeof param === 'string');
    if (isStr === true) {
        param = JSON.parse(param);
    }

    if (param == null || param.msg == null) {
        console.log('[Error] - param [' + param + '] or msg is null.');
        return;
    }

    var gamemsg = gc.crypto.AesDecrypt(param.msg, gc.crypto.GAME_AES_KEY);
    var msgobj = JSON.parse(gamemsg);
    if (msgobj != null) {
        var event = msgobj.event;
        var data = msgobj.data;
        var handleList = gameEventHandlers[event];
        if (!handleList || handleList.length === 0) {
            return;
        }

        console.log(event + "(" + typeof (data) + "):" + (data ? data.toString() : "null"));
        if (event != "disconnect" && typeof (data) == "string") {
            data = JSON.parse(data);
        }

        cc.log(("on net event : [" + event + "]   ["), data, "]");

        for (var i = 0; i < handleList.length; i++) {
            var handler = handleList[i];
            if (handler && typeof handler == 'function') {
                handler(data,event);
            }
        }
    }
    // } catch (e) {
    //     console.log('[Error] - handle game msg error:' + e);
    // }
}

/**
 * 注册事件响应
 * @param {String} event - 事件名称
 * @param {Function} fn - 事件响应函数
 * @param {Boolean} exclusive - 该事件是否只能注册一个响应
 */
function addHandler(event, fn, exclusive) {
    if (gameEventHandlers[event] && exclusive === true) {
        console.log("event:" + event + "' handler has been registered.");
        return;
    }

    //socket事件，单独处理
    if (event == 'connect' ||
        event == 'reconnect' || 
        event == 'disconnect' || 
        event == 'connect_failed') {
            var handler = function(data) {
                if (event != "disconnect" && typeof (data) == "string") {
                    data = JSON.parse(data);
                }
                cc.log(("on net event : [" + event + "]   ["), data, "]");

                fn(data);
            };
            addSocketEventHandler(event, handler);
            return;
    }


    var handleList = gameEventHandlers[event];
    handleList = handleList ? handleList : [];
    gameEventHandlers[event] = handleList;
    if (handleList.indexOf(fn) == -1) {
        handleList.push(fn);
    }
    if (sio) {
        console.log("register:function " + event);
        sio.on('gamemsg', gamemsgHandler);
    }
}

/**
 * 注册socket事件响应
 * @param {String} event 
 * @param {Function} fn 
 */
function addSocketEventHandler(event, fn) {
    if (sio) {
        sio.on(event, fn);
    } else {
        var handleList = socketEventHandlers[event];
        handleList = handleList ? handleList : [];
        socketEventHandlers[event] = handleList;

        if (handleList.indexOf(fn) == -1) {
            handleList.push(fn);
        }
    }
}

function connect(fnConnect, fnError) {
    var timer = setTimeout(function () {
        console.log('connect timeout');
        close();
    }, 10000);

    connectInternal(function (data) {
        clearTimeout(timer);
        fnConnect(data);
    }, function (data) {
        clearTimeout(timer);
        fnError(data);
    });
}

function connectInternal(fnConnect, fnError) {
    var opts = {
        'reconnection': false,
        'force new connection': true,
        'transports': ['websocket', 'polling']
    };

    sio = window.io.connect(exports.ip, opts);
    sio.on('reconnect', function () {
        console.log('reconnection');
    });
    sio.on('connect', function (data) {
        if (sio) {
            sio.connected = true;
            fnConnect(data);
        }
    });

    sio.on('disconnect', function (data) {
        console.log("disconnect");
        sio.connected = false;
        close();
    });

    sio.on('connect_failed', function () {
        console.log('connect_failed');
    });

    //register game event
    sio.on('gamemsg', gamemsgHandler);

    //register socket event
    for (var key in socketEventHandlers) {
        var list = socketEventHandlers[key];
        if(!list) {
            continue;
        }
        
        for (var i = 0; i < list.length; i++) {
            var value = list[i];
            if (value && typeof (value) == "function") {
                if (key == 'disconnect') {
                    fnDisconnect = value;
                }
                else {
                    console.log("register:function " + key);
                    sio.on(key, value);
                }
            }
        }
    }

    startHearbeat();
}

function startHearbeat() {
    sio.on('game_pong', function () {
        console.log('game_pong');
        lastRecieveTime = Date.now();
        delayMS = lastRecieveTime - lastSendTime;
        console.log(delayMS);
    });
    lastRecieveTime = Date.now();
    console.log(1);
    if (!isPinging) {
        isPinging = true;
        cc.game.on(cc.game.EVENT_HIDE, function () {
            ping();
        });
        setInterval(function () {
            if (sio) {
                ping();
            }
        }, 5000);
        setInterval(function () {
            if (sio) {
                if (Date.now() - lastRecieveTime > 10000) {
                    close();
                }
            }
        }, 500);
    }
}

function send(event, data) {
    if (sio && sio.connected) {
        if (data !== null && (typeof (data) == "object")) {
            data = JSON.stringify(data);
            //console.log(data);              
        }
        cc.log(("send net event : [" + event + "]   ["), data, "]");

        //加密
        var senddata = {
            event: event,
            data: data
        };
        var sendstr = JSON.stringify(senddata);
        sendstr = gc.crypto.AesEncrypt(sendstr, gc.crypto.GAME_AES_KEY);
        sio.emit('gamemsg', { msg: sendstr });
    }
}

function ping() {
    if (sio) {
        lastSendTime = Date.now();
        sio.emit('game_ping');
    }
}

function close() {
    console.log('close');
    delayMS = null;
    if (sio && sio.connected) {
        sio.connected = false;
        sio.disconnect();
    }
    sio = null;
    if (fnDisconnect) {
        fnDisconnect();
        fnDisconnect = null;
    }
}

function test(fnResult) {
    var xhr = null;
    var fn = function (ret) {
        fnResult(ret.errcode==0);
        xhr = null;
    };

    xhr = gc.http.sendRequest("/hi", {}, fn,'http://' + exports.ip,true);
}

function getSio() {
    return sio;
}

function getDelayMS() {
    return delayMS;
}

function getSignalStrength() {
    if (!delayMS || delayMS >= 1000) {
        return 0;
    }
    else if (delayMS >= 500) {
        return 1;
    }
    else if (delayMS >= 200) {
        return 2;
    }
    else if (delayMS >= 0) {
        return 3;
    }
}

exports.lastRecieveTime = lastRecieveTime;
exports.addTarget = addTarget;
exports.removeTarget = removeTarget;
exports.addHandler = addHandler;
exports.connect = connect;
exports.startHearbeat = startHearbeat;
exports.send = send;
exports.ping = ping;
exports.close = close;
exports.test = test;
exports.getSio = getSio;

// 延迟时间 单位毫秒
exports.getDelayMS = getDelayMS;
// 网络强度 0最好，3最差
exports.getSignalStrength = getSignalStrength;