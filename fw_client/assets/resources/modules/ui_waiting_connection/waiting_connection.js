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
        if (gc == null) {
            return null;
        }
        this.lblContent = this.node.getChildByName('tip').getComponent(cc.Label);
        this.target = this.node.getChildByName('loading_image');
    },

    // called every frame, uncomment this function to activate update callback
    update: function (dt) {
        this.target.rotation = this.target.rotation + dt * 45;
    },

    // show: function (content) {
    //     gc.wc.showWC();
    //     if (this.lblContent) {
    //         if (content == null) {
    //             content = "";
    //         }
    //         this.lblContent.string = content;
    //     }
    // },
    // hide: function () {
    //     gc.uiMgr.hide(this);
    // }
});
