var thisNode = null;

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
        thisNode = this.node;

        gc.on("refresh_user_info", this.refUserInfo)

        gc.button.addBtnClickEvent(cc.find("bg_mask", thisNode), thisNode, this, "onClickClose");

        var tChangeUserInfo = cc.find("btn_change_user", thisNode);
        tChangeUserInfo.active = false;
        gc.button.addBtnClickEvent(tChangeUserInfo, thisNode, this, "changeUser");

        this._headLarge = this.node.getChildByName('head_large');
        this._headLarge.active = false;

        gc.button.addBtnClickEvent(this._headLarge, thisNode, this, "onLargeHeadClicked");

        gc.button.addBtnClickEvent(cc.find("img_head", thisNode), thisNode, this, "onImgHeadClicked");
    },

    onEnable: function () {
    },

    onDisable: function () {
    },

    // called every frame, uncomment this function to activate update callback
    update: function (dt) {
        this.refUserInfo();
    },

    onImgHeadClicked:function(){
        this._headLarge.active = true;
        this._headLarge.getChildByName('img_head').getComponent(cc.Sprite).spriteFrame = cc.find("img_head", thisNode).getComponent(cc.Sprite).spriteFrame;
    },

    onLargeHeadClicked:function(){
        this._headLarge.active = false;
    },

    refUserInfo: function () {
        if (this.userID !== gc.user.userId) {
            this.userID = gc.user.userId;
            gc.sprite.setPlayerHeadIcon(cc.find("img_head", thisNode), gc.user.userId);
        }

        gc.text.setTxtString(cc.find("img_bg/rtxt_player_name", thisNode), gc.user.userName);
        gc.text.setTxtString(cc.find("img_bg/txt_player_user_id", thisNode), ("ID:" + gc.user.userId));
        gc.text.setTxtString(cc.find("img_bg/txt_player_ip", thisNode), gc.user.ip ? ("IP:" + gc.user.ip) : "");
    },

    onClickClose: function () {
        gc.ui.hideUI(this);
    },

    changeUser: function () {
        cc.sys.localStorage.removeItem("wx_code");
        gc.utils.restart();
    },
});
