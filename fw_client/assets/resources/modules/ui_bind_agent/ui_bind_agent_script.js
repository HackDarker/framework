var iptAgent;
cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
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
        var tLayer = cc.find("ui_bind_agent", this.node);

        gc.button.addBtnClickEvent(cc.find("bg_mask", this.node), this.node, this, "onClose");
        gc.button.addBtnClickEvent(cc.find("btn_close", this.node), this.node, this, "onClose");
        gc.button.addBtnClickEvent(cc.find("btn_bind", this.node), this.node, this, "bindAgent");

        iptAgent = cc.find("input_agent", this.node);
    },

    onEnable: function () {
        gc.text.setTxtString(iptAgent, "");
    },

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },

    onClose: function () {
        gc.audio.playSFX("resources/common/sound", "button.mp3");
        
        gc.ui.hideUI(this);
    },

    bindAgent: function () {
        gc.audio.playSFX("resources/common/sound", "button.mp3");
 
        var onBindAgent = function (ret) {
            console.log("代理信息："+JSON.stringify(ret));
            switch (ret.errcode) {
                case 0:
                    gc.alert.showUI("绑定成功！");
                    gc.ui.hideUI(this);
                    gc.user.refUserInfo(ret);
                    // gc.emit("coins_and_gems_changed");
                    break;
                case 1:
                    gc.alert.showUI("绑定代理不存在，\n无法绑定");
                    break;
                case 4010:
                    gc.alert.showUI("已经绑定代理,\n无法再次绑定");
                    break;
                case 4011:
                    gc.alert.showUI("绑定失败");
                    break;
                default:
                    gc.alert.showUI("无法绑定");
                    break;
            }
        }

        var tAgent = gc.text.getTxtString(iptAgent);
        if (isNaN(tAgent)) {
            gc.alert.showUI("推荐码只能是数字");
            gc.ui.hideUI(this);
        }
        else {
            gc.http.sendRequest("/bind_agent", { agent: tAgent }, onBindAgent);
        }
    }
});
