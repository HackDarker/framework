
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
        gc.button.addBtnClickEvent(cc.find("spr_btn_list/btn_ok", this.node), this.node, this, "onBtnClicked");
        gc.button.addBtnClickEvent(cc.find("spr_btn_list/btn_cancle", this.node), this.node, this, "onBtnClicked");
        gc.button.addBtnClickEvent(cc.find("btn_close", this.node), this.node, this, "onBtnClicked");
    },

    onDisable: function () {
    },

    onBtnClicked: function (event) {
        gc.audio.playSFX("resources/common/sound", "button.mp3");
        
        gc.ui.hideUI("alert");
        switch (event.currentTarget.name) {
            case "btn_ok":
                gc.utils.exeCallback(this.yesCall, "btn_ok");
                break;
            case "btn_no":
                gc.utils.exeCallback(this.cancelCall, "btn_cancle");
                break;
            case "btn_close":
                gc.utils.exeCallback(this.closeCall, "btn_close");
                break;
        }
    },

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});
