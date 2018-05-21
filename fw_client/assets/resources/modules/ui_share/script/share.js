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

        gc.button.addBtnClickEvent(cc.find("btn_haoyou", thisNode), this.node, this, 'onBtnClicked');
        gc.button.addBtnClickEvent(cc.find("btn_pyq", thisNode), this.node, this, 'onBtnClicked');
        gc.button.addBtnClickEvent(cc.find("btn_close", thisNode), this.node, this, 'onBtnClicked');
        gc.button.addBtnClickEvent(cc.find("layer_mask", thisNode), this.node, this, 'onBtnClicked');
    },

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },

    onBtnClicked: function (event) {
        gc.audio.playSFX("resources/common/sound", "button.mp3");
        
        this.desc = this.desc || "";
        this.title = this.title || "";
        switch (event.target.name) {
            case "btn_haoyou":
                this.onShareToHaoYou();
                break;
            case "btn_pyq":
                this.onShareToPengYouQuan();
                break;
            case "btn_close":
            case "layer_mask":
                gc.ui.hideUI(this);
                break;
        }
    },

    onShareToHaoYou: function () {
        gc.anysdk.share(this.title, this.desc, 0);
    },

    // onShareToPengYouQuan: function () {
    //     if (this.desc.indexOf(this.title) === 0) {
    //         gc.anysdk.share(this.desc, "", 1);
    //     }
    //     else {
    //         gc.anysdk.share((this.title + this.desc), "", 1);
    //     }
    // },
    onShareToPengYouQuan: function () {
        var shared = gc.user.share;
        if (shared) {
            if (this.desc.indexOf(this.title) === 0) {
                gc.anysdk.share(this.desc, "", 1);
            }
            else {
                gc.anysdk.share((this.title + this.desc), "", 1);
            }
        } else {
            this.ShareToPengYouQuanFirst();
        }
        this.node.active = false;
    },

    //第一次分享加钻
    ShareToPengYouQuanFirst: function () {
        var onShared = function (errCode) {
                gc.user.sharefn(function (ret) {
                    if(ret.errcode === 0){
                        gc.user.share = true;
                        gc.user.gems += ret.gems//gc.user.shareconfig.share_bonus_gems;
                        gc.alert.showUI('分享成功，钻石+' + ret.gems);            
                    }
                }.bind(this));
        }
        if (this.desc.indexOf(this.title) === 0) {
            gc.anysdk.share(this.desc, "", 1, onShared);
        }
        else {
            gc.anysdk.share((this.title + this.desc), "", 1, onShared);
        }
    },

});
