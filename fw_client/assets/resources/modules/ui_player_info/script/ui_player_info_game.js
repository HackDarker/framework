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
    },

    onImgHeadClicked:function(){
        this._headLarge.active = true;
        this._headLarge.getChildByName('img_head').getComponent(cc.Sprite).spriteFrame = cc.find("img_head", thisNode).getComponent(cc.Sprite).spriteFrame;
    },

    onLargeHeadClicked:function(){
        this._headLarge.active = false;
    },

    refUserInfo: function (info) {
        gc.sprite.setPlayerHeadIcon(cc.find("img_head", thisNode), this._userId);
        gc.text.setTxtString(cc.find("img_bg/rtxt_player_name", thisNode), info.name);
        gc.text.setTxtString(cc.find("img_bg/txt_player_user_id", thisNode), ("ID:" + this._userId));

        var ip = gc.room.getIPByUserID(this._userId);
        gc.text.setTxtString(cc.find("img_bg/txt_player_ip", thisNode), ip);
    },

    onClickClose: function () {
        thisNode.active = false;
        //  gc.ui.hideUI("user_info");
    },

    //设定玩家信息
    setUserID: function (userId) {
        if(this._userId == userId){
            return;
        }
        this._userId = userId;
        var self = this;
        gc.player.callPlayerInfo(userId,function(userId,info){
            self.refUserInfo(info);
        });
    },
});
