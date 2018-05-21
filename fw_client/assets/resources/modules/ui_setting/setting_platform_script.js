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
       
        gc.button.addBtnClickEvent(cc.find("layer_node/btn_close", this.node), this.node, this, "onClose");
        var btnSwitchAccount = cc.find("layer_node/btn_switch_account", this.node);
        gc.button.addBtnClickEvent(btnSwitchAccount, this.node, this, "onSwitchAccount");
        gc.slider.addSliderEvent(cc.find("layer_node/spr_sound/slider_sound", this.node), this.node, this, "sfxVolumeChange");
        gc.slider.addSliderEvent(cc.find("layer_node/spr_music/slider_sound", this.node), this.node, this, "bgmVolumeChange");

        // gc.toggle.addToggleClickEvent(cc.find("layer_node/spr_sound/sel_switch", this.node), this.node, this, "checkSfxVolume");
        // gc.toggle.addToggleClickEvent(cc.find("layer_node/spr_music/sel_switch", this.node), this.node, this, "checkBgmVolume");
        cc.info("onLoad Over");
    },

    // called every frame, uncomment this function to activate update callback
    update: function (dt) {
      //  gc.toggle.setIsCheckedToggle(cc.find("layer_node/spr_sound/sel_switch", this.node), (gc.audio.sfxVolume !== 0));
        gc.slider.setSliderValue(cc.find("layer_node/spr_sound/slider_sound", this.node), gc.audio.sfxVolume);

       // gc.toggle.setIsCheckedToggle(cc.find("layer_node/spr_music/sel_switch", this.node), (gc.audio.bgmVolume !== 0));
       gc.slider.setSliderValue(cc.find("layer_node/spr_music/slider_sound", this.node), gc.audio.bgmVolume);
    },

    onClose: function (event) {
        gc.audio.playSFX("resources/common/sound", "button.mp3");
        //this.node.active = false;
        gc.ui.hideUI(this);
    },

    onSwitchAccount:function(event){
        cc.sys.localStorage.removeItem("wx_code");
        //cc.game.end();
        gc.utils.restart();
    },

    sfxVolumeChange: function (event) {
        gc.audio.setSFXVolume(gc.slider.getSliderValue(event), true);
    },

    bgmVolumeChange: function (event) {
        gc.audio.setBGMVolume(gc.slider.getSliderValue(event), true);
    },

    checkSfxVolume: function (event) {
        if (gc.toggle.getIsCheckedToggle(event.currentTarget)) {
            gc.audio.oldSfxVolume = gc.audio.sfxVolume
            gc.audio.setSFXVolume(0, true);
        }
        else {
            gc.audio.setSFXVolume(gc.audio.oldSfxVolume, true);
        }
    },

    checkBgmVolume: function (event) {
        if (gc.toggle.getIsCheckedToggle(event.currentTarget)) {
            gc.audio.oldBgmVolume = gc.audio.bgmVolume
            gc.audio.setBGMVolume(0, true);
        }
        else {
            gc.audio.setBGMVolume(gc.audio.oldBgmVolume, true);
        }
    },
});