var nowUI = {};
var hidePtY = 5000;

var BG_MASK_WIDTH = 5000;//背景遮罩宽度
var BG_MASK_HEIGHT = 5000;
var BG_MASK_OPACITY = 5000;

var g_uiInfo = {};
var g_uiSettingsList = [];

function addUISettings(settings) {
    for (var k in settings) {
        var info = settings[k];
        if (g_uiInfo[info.name]) {
            console.log('ui name conflict:', info.name);
            continue;
        }
        g_uiInfo[info.name] = info;
    }
    g_uiSettingsList.push(settings);
}

function removeUISettings(settings) {
    var idx = g_uiSettingsList.indexOf(settings);
    if (idx == -1) {
        return;
    }
    for (var k in settings) {
        var info = settings[k];
        if (g_uiInfo[info.name]) {
            delete g_uiInfo[info.name];
            //卸载相关资源
            //TODO
        }
    }
}


function getUI(uiname) {
    if (!(uiname in nowUI)) {
        return null;
    }

    var uiInfo = nowUI[uiname];
    if (!uiInfo) {
        return null;
    }
    return uiInfo.ui;
}

function getUINameByUI(ui) {
    var uiInfo = null;
    for (var uiname in nowUI) {
        uiInfo = nowUI[uiname];
        if (uiInfo.ui === ui) {
            return uiname;
        }
    }
    return null;
};

function showUI(uiname, struct_Callback, parentNode, dontShowWC) {
    var settingsInfo = g_uiInfo[uiname];
    if (!settingsInfo) {
        return;
    }

    var uiprefab = settingsInfo.prefab;
    var mainScript = settingsInfo.script;

    showUI2(uiname, uiprefab, mainScript, struct_Callback, parentNode, dontShowWC);
}

//  uiname  ui名字
//  uipath  ui路径 resources之后到后缀名之前
//  uiprefab ui的预制体名字
//  mainScript  ui的主脚本名字
//  struct_Callback    ui加载完毕的回调函数 类型为 struct_Callback，元素为struct_Callback的数组  函数回调时最后一个参数为ui
//  parentNode  ui的放置位置 null为当前canvas上面
function showUI2(uiname, uiprefab, mainScript, struct_Callback, parentNode, dontShowWC) {
    if (needShowWC(uiname) && !dontShowWC) {
        gc.wc.showWC('界面加载中...');
    }
    var tUIInfo;

    if (struct_Callback && !(struct_Callback instanceof Array)) {
        struct_Callback = [struct_Callback];
    }
    if (!parentNode) {
        parentNode = cc.find("Canvas");
    }
    if (!("addChild" in parentNode)) {
        try {
            throw new Error('Show UI Param Error ');
        }
        catch (err) {
            console.log(err);
        }
    }

    tUIInfo = nowUI[uiname];
    if (!tUIInfo) {//没有则加载ui组件
        tUIInfo = nowUI[uiname] = {
            uiname: uiname,
            ui: null,
            uiprefab: uiprefab,
            mainScript: mainScript,
            parentNode: parentNode,
            callback: struct_Callback
        };

        cc.log("show ui [ ", uiprefab, " ] component name [ ", mainScript, " ]");
        cc.loader.loadRes(uiprefab, onUILoaded.bind(tUIInfo));
        cc.loader.setAutoRelease(uiprefab, true);
        return;
    }

    if (tUIInfo.ui) {                            //有ui
        if (!cc.isValid(tUIInfo.ui)) {                              //已经被销毁了
            closeUI(uiname);
            showUI2(uiname, uiprefab, mainScript, struct_Callback, parentNode);
            return;
        }
        else if (tUIInfo.mainScript !== mainScript) {               //旧的控制脚本与新的控制脚本不同
            if (tUIInfo.mainScript) {
                tUIInfo.ui.removeComponent(tUIInfo.mainScript);             //移除旧的脚本
            }
            tUIInfo.mainScript = mainScript
            if (tUIInfo.mainScript) {
                tUIInfo.ui.addComponent(tUIInfo.mainScript);                //添加新的脚本
            }
        }
    }

    tUIInfo.parentNode = parentNode;
    if (!tUIInfo.callback) {
        tUIInfo.callback = struct_Callback;
    }
    else {
        tUIInfo.callback = tUIInfo.callback.concat(struct_Callback);
    }

    if (tUIInfo.ui) {
        show(uiname);
    }
}

function hideUI(uiname) {
    if (!(uiname in nowUI)) {
        return null;
    }

    var uiInfo = nowUI[uiname];
    if (!uiInfo) {
        return null;
    }
    uiInfo.callback = null;
    if (!uiInfo.ui) {
        return null;
    }

    if (!uiInfo.ui.active) {                      //已经隐藏的界面
        return;
    }

    var tWidget = uiInfo.ui.getComponent(cc.Widget);
    if (tWidget) {
        uiInfo.rootWidgetEnabled = tWidget.enabled;
        tWidget.enabled = false;
    }
    uiInfo.ui.active = false;
    uiInfo.oldX = uiInfo.ui.x;
    uiInfo.oldY = uiInfo.ui.y;
    uiInfo.ui.x = 0;
    uiInfo.ui.y = hidePtY;
    cc.log("gc now hide ui ", uiname, " old pos (", uiInfo.oldX, ",", uiInfo.oldY, ") now pos (", uiInfo.ui.x, ",", uiInfo.ui.y, ")");
    // uiInfo.ui.removeFromParent();
    return uiInfo.ui;
}

function hideUI(uiname) {
    if (typeof (uiname) == 'object') {
        uiname = uiname.node.__ui_name;
    }
    if (!(uiname in nowUI)) {
        return null;
    }

    var uiInfo = nowUI[uiname];
    if (!uiInfo) {
        return null;
    }
    uiInfo.callback = null;
    if (!uiInfo.ui) {
        return null;
    }

    if (!uiInfo.ui.active) {                      //已经隐藏的界面
        return;
    }

    var tWidget = uiInfo.ui.getComponent(cc.Widget);
    if (tWidget) {
        uiInfo.rootWidgetEnabled = tWidget.enabled;
        tWidget.enabled = false;
    }
    uiInfo.ui.active = false;
    uiInfo.oldX = uiInfo.ui.x;
    uiInfo.oldY = uiInfo.ui.y;
    uiInfo.ui.x = 0;
    uiInfo.ui.y = hidePtY;
    cc.log("gc now hide ui ", uiname, " old pos (", uiInfo.oldX, ",", uiInfo.oldY, ") now pos (", uiInfo.ui.x, ",", uiInfo.ui.y, ")");
    // uiInfo.ui.removeFromParent();
    return uiInfo.ui;
}

function hideALLUI() {
    for (var uiname in nowUI) {
        hideUI(uiname);
    }
}

function closeUI(uiname) {
    var tUIInfo = nowUI[uiname];
    if (cc.isValid(tUIInfo.ui)) {
        tUIInfo.ui.removeFromParent();
    }

    if ("wc" === uiname) {
        return;
    }
    else {
        delete nowUI[uiname];
    }
}

function closeALLUI() {
    for (var uiname in nowUI) {
        closeUI(uiname);
    }
}

function getUIInfoByPrefabName(prefabName) {
    for (var uiname in nowUI) {
        if (nowUI[uiname].uiprefab === prefabName) {
            return nowUI[uiname];
        }
    }
}

function getUIMainScript(uiname) {
    if (uiname in nowUI) {
        var tUIInfo = nowUI[uiname];
        if (tUIInfo.ui) {
            return tUIInfo.ui.getComponent(tUIInfo.mainScript);
        }
        return tUIInfo.mainScript;
    }
    return null;
}

function onUILoaded(err, prefab) {
    if (!prefab) {
        cc.log(err);
        return;
    }
    /*
        var tUIInfo = getUIInfoByPrefabName(prefab.name);
        if (!tUIInfo) {
            cc.log("on ui loaded error ,what's prefab ?" + prefab.name);
            return;
        }
    */
    var tUIInfo = this;
    var newNode = cc.instantiate(prefab);//通过预制件实例化一个ui节点
    tUIInfo.ui = newNode;
    newNode.__ui_name = tUIInfo.uiname;

    // var bgMsk = newNode.getChildByName('bg_mask');
    // if(!bgMsk){
    //     bgMsk = newNode.getChildByName('layer_mask');
    // }
    // if(bgMsk){
    //     bgMsk.width = 1920;
    //     bgMsk.height = 960;
    //     bgMsk.opacity = 180;
    // }

    var mainScript = tUIInfo.mainScript;
    var uiComp = newNode.getComponent(mainScript);
    if (!uiComp) {
        uiComp = newNode.addComponent(mainScript);
    }
    newNode.__main_comp = uiComp;
    show(tUIInfo.uiname);
}

exports.isShow = function isShow(uiname) {
    var tUIInfo = nowUI[uiname];
    if (!tUIInfo) {
        cc.log("show ui error ,what's prefab ?" + uiname);
        return;
    }
    var tNode = tUIInfo.ui;
    // tNode.removeFromParent();
    if (!tUIInfo.parentNode) {
        tUIInfo.parentNode = cc.find("Canvas");
    }

    if (tNode.y != hidePtY) {
        return true;
    }
    return false;
}

function show(uiname) {
    if (needShowWC(uiname)) {
        gc.wc.hideWC();
    }

    var tUIInfo = nowUI[uiname];
    if (!tUIInfo) {
        cc.log("show ui error ,what's prefab ?" + uiname);
        return;
    }
    var tNode = tUIInfo.ui;
    // tNode.removeFromParent();
    if (!tUIInfo.parentNode) {
        tUIInfo.parentNode = cc.find("Canvas");
    }
    if ((!tNode.parent || !cc.isValid(tNode.parent)) && tUIInfo.parentNode) {
        tUIInfo.parentNode.addChild(tNode);
    }
    tNode.active = true;

    if ("rootWidgetEnabled" in tUIInfo) {
        var tWidget = tNode.getComponent(cc.Widget);
    }
    if (tWidget) {
        tWidget.enabled = tUIInfo.rootWidgetEnabled;
        tWidget.updateAlignment();
    }
    if ("oldX" in tUIInfo) {
        tNode.x = tUIInfo.oldX;
    }
    if ("oldY" in tUIInfo) {
        tNode.y = tUIInfo.oldY;
    }
    cc.log("gc now show ui ", uiname, " old pos (", tUIInfo.oldX, ",", tUIInfo.oldY, ") now pos (", tNode.x, ",", tNode.y, ")");

    var tCallbackList = tUIInfo.callback;
    tUIInfo.callback = null;
    if (!tCallbackList) {
        return;
    }

    if (!(tCallbackList instanceof Array)) {
        gc.utils.exeCallback(tCallbackList, tNode.__main_comp);
        return;
    }
    while (tCallbackList.length > 0) {
        gc.utils.exeCallback(tCallbackList.pop(), tNode.__main_comp);
    }
}

function needShowWC(uiname) {
    if (cc.sys.isNative || uiname == 'wc') {
        return false;
    }
    return true;
}

//  获取UI名字
//  ui      ui实例
exports.getUINameByUI = getUINameByUI;
//  获取UI
//  uiname  ui名字
exports.getUI = getUI;
//  加载并显示UI
//  uiname  ui名字
//  uiprefab ui的预制体名字
//  mainScript  ui的主脚本名字
//  struct_Callback    ui加载完毕的回调函数 类型为 struct_Callback，元素为struct_Callback的数组  函数回调时最后一个参数为ui
//  parentNode  ui的放置位置 null为当前canvas上面
exports.showUI = showUI;
exports.showUI2 = showUI2;
//  隐藏UI        （active = false）
//  uiname  ui名字
exports.hideUI = hideUI;
//  关闭ui
//  uiname  ui名字
exports.closeUI = closeUI;
//  隐藏所有UI        （active = false）
exports.hideALLUI = hideALLUI;
//  关闭所有UI
exports.closeALLUI = closeALLUI;
//  获取ui对应的主脚本
exports.getUIMainScript = getUIMainScript;

exports.addUISettings = addUISettings;