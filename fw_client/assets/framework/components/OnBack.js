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
        var btn = this.node.getChildByName("btn_back");
        if(btn){
            gc.button.addBtnClickEvent(btn, this.node,this, "onBtnClicked");
        }

        var btn = this.node.getChildByName("btn_close");
        if(btn){
            gc.button.addBtnClickEvent(btn, this.node,this, "onBtnClicked");
        }
    },

    onBtnClicked: function (event) {
        gc.ui.hideUI(this);
        this.node.active = false;
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});
