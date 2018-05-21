/**
 * Auther：Rango
 * Date:2018.4.22
 * Description：游戏全局控制器  是一个全局对象 所有的工具类和模块都是其子集
 */

window.gc = {
    online: false,                   //是否联网
    logList: [],                    //日志
};

gc.addMoudle = addMoudle;
gc.addLib = addLib;
gc.emit = emit;
gc.off = off;
gc.on = on;
gc.netSend = netSend;

gc.start = start;
/**
 * 切换场景 并对相关模块和数据进行初始化
 * @param {*} masterId 
 * @param {*} dontLoadScene 
 * @param {*} params 
 */
gc.switchMaster = function (masterId, dontLoadScene, params) {
    console.log('准备切换场景：', masterId)
    return gc.masterMgr.enter(masterId, dontLoadScene, params);
}

var NetAgent = require('NetAgent');
gc.createNetAgent = function (name) {
    return new NetAgent(name);
}

initUtils();
initOfflineMoudle();

function initCrypto() {
    gc.crypto = {};
    //AES crypt part
    gc.crypto.HTTP_AES_KEY = gc.settings.crypto.HTTP_AES_KEY;
    gc.crypto.GAME_AES_KEY = gc.settings.crypto.GAME_AES_KEY;
    gc.crypto.AesEncrypt = function (text, key) {
        if (gc.aes == null || key == null) {
            console.log('[Warning] - aes module[' + gc.aes + ' or key[' + key + '] is null.');
            return text;
        }

        return gc.aes.encrypt(text, key, 128);
    };

    gc.crypto.AesDecrypt = function (text, key) {
        if (gc.aes == null || key == null) {
            console.log('[Warning] - aes module[' + gc.aes + ' or key[' + key + '] is null.');
            return text;
        }

        return gc.aes.decrypt(text, key, 128);
    };
}

// className 需要有init函数
function addMoudle(varName, className) {
    console.log(varName);
    var cls = require(className);
    var mgr = new cls();
    mgr.init();
    gc[varName] = mgr;
}

function addLib(varName, className) {
    if (!gc[varName]) {
        gc[varName] = require(className);
    }
}

function emit(event, data) {
    var cvs = cc.find('Canvas');
    if (cvs) {
        cvs.emit(event, data);
    }
}

function off(event, func) {
    var cvs = cc.find('Canvas');
    if (cvs) {
        if (func) {
            cvs.off(event, func);
        }
        else {
            cvs.off(event);
        }
    }
}

function on(event, func, a, b, c) {
    if (!func) {
        try {
            throw new Error(event + "事件回调不能为空");
        } catch (error) {
            console.log(error);
        }
    }
    var cvs = cc.find('Canvas');
    if (cvs) {
        cvs.on(event, func, a, b, c);
    }
}

function netSend(event, data) {
    if (gc.online) {
        gc.net.send(event, data);
        return true;
    }
    return false;
}

//  工具
function initUtils() {//注意 后面模块如果用到前面的接口 则顺序不能变
    addLib('enum', 'enum');
    addLib('http', 'HTTP');
    addLib('animation', 'utils_animation');
    addLib('utils', 'Utils');
    addLib('ui', 'UIMgr');
    addLib('sprite', 'utils_sprite');
    addLib('button', 'utils_button');
    addLib('toggle', 'utils_toggle');
    addLib('slider', 'utils_slider');
    addLib('text', 'utils_text');
    addLib('aes', 'aes');
    addLib('sub_game', 'utils_sub_game');
}

//  网络无关模块
function initOfflineMoudle() {
    addMoudle('net', 'NetConnection');
    addMoudle('anysdk', 'AnysdkMgr');
    // 发音系统
    addMoudle('voice', 'VoiceMgr');
    addMoudle('audio', 'AudioMgr');

    addMoudle('wc', 'WaitConnectionMgr');
    addMoudle('alert', 'AlertMgr');

    addMoudle('user', 'UserMgr');
    addMoudle('player', 'PlayerMgr');

    addMoudle('hall', 'HallMgr');
    addMoudle('masterMgr', 'MasterMgr');
    addMoudle('hotUpdateMgr', 'HotUpdateMgr');
}

// 网络有关模块
function initOnlineMoudle() {
    //addMoudle('replayMgr', 'ReplayMgr');
    addMoudle('gameNetMgr', 'GameNetMgr');
    addMoudle('chatMgr', 'ChatMgr');
    addMoudle('room', 'RoomMgr');

    // for (var k in gc) {
    //     var mgr = gc[k];
    //     if ("onlineStart" in mgr) {
    //         mgr.onlineStart();
    //     }
    // }
}

function urlParse() {
    var params = {};
    if (window.location == null) {
        return params;
    }
    var name, value;
    var str = window.location.href; //取得整个地址栏
    var num = str.indexOf("?")
    str = str.substr(num + 1); //取得所有参数   stringvar.substr(start [, length ]

    var arr = str.split("&"); //各个参数放到数组里
    for (var i = 0; i < arr.length; i++) {
        num = arr[i].indexOf("=");
        if (num > 0) {
            name = arr[i].substring(0, num);
            value = arr[i].substr(num + 1);
            params[name] = value;
        }
    }
    return params;
}

//飞起来吧 (网络有关系的)
function start() {
    gc.online = false;

    //分析启动参数
    cc.args = urlParse();

    //基础模块
    // initOnlineUtils();

    //=======游戏逻辑模块=====
    // initOnlineMoudle();

    initCrypto();//暂时不用

    for (var k in gc) {
        var mgr = gc[k];
        if (mgr && mgr.start) {
            mgr.start();
        }
    }

    window.onresize = function () {
        if (gc.utils.getLoadingScene()) {
            return;
        }
        gc.utils.loadScene(cc.director.getScene().name, null, true);
    }
}