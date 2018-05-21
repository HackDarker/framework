String.prototype.format = function (args) {
    if (arguments.length > 0) {
        var result = this;
        if (arguments.length == 1 && typeof (args) == "object") {
            for (var key in args) {
                var reg = new RegExp("({" + key + "})", "g");
                result = result.replace(reg, args[key]);
            }
        }
        else {
            for (var i = 0; i < arguments.length; i++) {
                if (arguments[i] == undefined) {
                    return "";
                }
                else {
                    var reg = new RegExp("({[" + i + "]})", "g");
                    result = result.replace(reg, arguments[i]);
                }
            }
        }
        return result;
    }
    else {
        return this;
    }
};

var clyTime = {};
exports.clyTime = clyTime;

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
    },

    // use this for initialization
    onLoad: function () {
        gc.audio.playBGM("resources/common/sound/", "bgMain.mp3");

        /*
                if (!cc.sys.isNative || cc.sys.os == cc.sys.OS_WINDOWS || cc.sys.os == cc.sys.OS_OSX) {
                    cc.find("Canvas/btn_yk").active = true;
                }
                if(cc.sys.os == cc.sys.OS_ANDROID || cc.sys.os == cc.sys.OS_IOS){
                    cc.find("Canvas/btn_yk").active = false;
                }
        */
    },

    start: function () {

    },
    //登陆接口
    onAuth: function (data) {
        gc.user.onAuth(data);
    },
    //微信登陆
    wechatAuth: function (wxCode, update) {
        var fn = function (ret) {
            if (ret.errcode != 0) {
                cc.sys.localStorage.removeItem("wx_code");
                setTimeout(function () {
                    gc.wc.hideWC();
                    gc.alert.showUI("微信验证失败，请重新登陆");
                }, 2000);
            } else {
                cc.sys.localStorage.setItem("wx_code", wxCode);
                gc.wc.hideWC();
                this.onAuth(ret);
            }
        }
        gc.wc.showWC("正在验证微信");
        gc.http.sendRequest("/wechat_auth", { code: wxCode, os: cc.sys.os, update: update }, fn.bind(this));
    },
    //游客登陆
    guestAuth: function () {
        var self = this;
        var account = cc.args["account"];
        console.log('guestAuth account', account);
        if (account == null) {
            account = cc.sys.localStorage.getItem("account");
        }
        console.log('guestAuth account2', account);

        if (account == null) {
            account = Date.now();
            cc.sys.localStorage.setItem("account", account);
            self.gotoCreateRole();
        } else {
            if (gc.online) {
                gc.http.sendRequest("/guest", { account: account }, this.onAuth);
            } else {
                gc.alert.showUI('离线模式');                      //离线测试

                gc.utils.loadScene('hall', () => {

                });
                this.onAuth({
                    errcode: 0,
                    token: "",
                });
            }
            // gc.wc.showWC("正在登录游戏");
            console.log('guestAuth 正在登录游戏', account);
        }
    },

    onBtnQuickStartClicked: function () {
        this.guestAuth();
    },
    onBtnStart2Clicked: function () {
        gc.utils.loadScene('game_01')
    },

    onBtnWeichatClicked: function () {
        this.wechatAuth();
    },


    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});
