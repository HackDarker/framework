module.exports = ModuleClass;
function ModuleClass(){};

var callback = null;
function getCallback() {
    if (!callback) {
        callback = {};
    }
    return callback;
}

function clearCallback() {
    callback = {};
}

function setCallback(name, func, parms, caller) {
    var tCallback = getCallback();
    if (func && (typeof (func) === "function")) {
        parms = parms || [];
        tCallback[name] = gc.utils.struct_Callback(func, parms, caller);
    }
    else {
        tCallback[name] = func;
    }
}


ModuleClass.prototype.init = function () {    
}

//  callback 回调信息 如果为function则作为确定点击后的回调函数 否则为 struct_Callback 类型
ModuleClass.prototype.showUI = function (text, callback, parent, parms, caller) {
    clearCallback();
    gc.alert.setTitle(text);
    gc.alert.setOK("yesCall", callback, parms, caller);

    parent = parent || gc.utils.getStaticNode("StaticNode");
    gc.ui.showUI("alert", [gc.alert.onUIShow], parent);
    return gc.alert;
}

/**
 * 设定确定按钮
 * @param  {Boolean} isShow     是否显示
 * @param  {Function} callback  回调函数
 * @param  {Object} parms       回调函数参数
 * @param  {CC.Node} caller     回调函数者
 * @param  {String} label       文字
 * @return {AlertMgr}           这个js文件
 */
ModuleClass.prototype.setOK = function (isShow, callback, parms, caller, label) {
    setCallback("yesCall", callback, parms, caller);
    setCallback("needYes", isShow);
    setCallback("yesTxt", (!label ? "确定" : label));
    gc.alert.refUIInfo();
    return gc.alert;
}

/**
 * 设定取消按钮
 * @param  {Boolean} isShow     是否显示
 * @param  {Function} callback  回调函数
 * @param  {Object} parms       回调函数参数
 * @param  {CC.Node} caller     回调函数者
 * @param  {String} label       文字
 * @return {AlertMgr}           这个js文件
 */
ModuleClass.prototype.setNO = function (isShow, callback, parms, caller, label) {
    setCallback("cancelCall", callback, parms, caller);
    setCallback("needCancel", isShow);
    setCallback("cancelTxt", (!label ? "取消" : label));
    gc.alert.refUIInfo();
    return gc.alert;
}

/**
 * 设定关闭按钮
 * @param  {Boolean} isShow     是否显示
 * @param  {Function} callback  回调函数
 * @param  {Object} parms       回调函数参数
 * @param  {CC.Node} caller     回调函数者
 * @return {AlertMgr}           这个js文件
 */
ModuleClass.prototype.setClose = function (isShow, callback, parms, caller) {
    setCallback("closeCall", callback, parms, caller);
    setCallback("needClose", isShow);
    gc.alert.refUIInfo();
    return gc.alert;
}

ModuleClass.prototype.setTitle = function (title) {
    setCallback("title", title);
    gc.alert.refUIInfo();
    return gc.alert;
}

ModuleClass.prototype.onUIShow = function (ui) {
    if (!ui) {
        return;
    }

    gc.alert.refUIInfo();
}

ModuleClass.prototype.refUIInfo = function () {
    var ui = gc.ui.getUI("alert");
    if (!ui) {
        return;
    }

    var tAlertScript = ui.getComponent("ui_alert");
    if (!tAlertScript) {
        cc.log(" alert no component");
    }

    var callback = getCallback();
    if (!callback) {
        return;
    }

    var tBtnLayer = cc.find("spr_btn_list", ui);
    if ("needYes" in callback) {
        if (tAlertScript) {
            tAlertScript.yesCall = callback.yesCall;
        }
        cc.find("btn_ok", tBtnLayer).active = callback.needYes;
        gc.text.setTxtString(cc.find("btn_ok/txt_label", tBtnLayer), callback["yesTxt"]);
    }
    else {
        cc.find("btn_ok", tBtnLayer).active = false;
    }

    if ("needCancel" in callback) {
        if (tAlertScript) {
            tAlertScript.cancelCall = callback.cancelCall;
        }
        cc.find("btn_cancle", tBtnLayer).active = callback.needCancel;
        gc.text.setTxtString(cc.find("btn_cancle/txt_label", tBtnLayer), callback["cancelTxt"]);
    }
    else {
        cc.find("btn_cancle", tBtnLayer).active = false;
    }

    if ("needClose" in callback) {
        if (tAlertScript) {
            tAlertScript.closeCall = callback.closeCall;
        }
        cc.find("btn_close", ui).active = callback.needClose;
    }
    else {
        cc.find("btn_close", ui).active = false;
    }

    if ("title" in callback) {
        gc.text.setTxtString(cc.find("text_alert_desc", ui), callback["title"]);
    }
    else {
        gc.text.setTxtString(cc.find("text_alert_desc", ui), "");
    }

    var tLayout = tBtnLayer.getComponent(cc.Layout);
    if (tLayout) {
        tLayout._doLayoutDirty();
    }
}

// 显示系统消息
//  notice  信息内容
ModuleClass.prototype.showSysNotice = function (notice, showTime, parent) {

}

// 显示跑马灯消息
//  notice 信息内容
ModuleClass.prototype.showNotice = function (notice, showTime, parent) {

}

ModuleClass.prototype.hide = function () {
    gc.ui.hideUI("alert");
}