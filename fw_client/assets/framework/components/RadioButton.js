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
        target: cc.Node,
        sprite: cc.SpriteFrame,
        checkedSprite: cc.SpriteFrame,
        checked: false,
    },

    // use this for initialization
    onLoad: function () {
        if (gc == null) {
            return;
        }
        if (gc.radiogroupmgr == null) {
            var RadioGroupMgr = require("RadioGroupMgr");
            gc.radiogroupmgr = new RadioGroupMgr();
            gc.radiogroupmgr.init();
        }

        if (this.group == null) {
            this.group = this.node.parent.__instanceId;
        }

        console.log(typeof (gc.radiogroupmgr.add));
        gc.radiogroupmgr.add(this);

        this.refresh();
    },

    refresh: function () {
        var targetSprite = this.target.getComponent(cc.Sprite);
        if (this.checked) {
            targetSprite.spriteFrame = this.checkedSprite;
        }
        else {
            targetSprite.spriteFrame = this.sprite;
        }
    },

    check: function (value) {
        this.checked = value;
        this.refresh();
    },

    onClicked: function () {
        gc.audio.playSFX("resources/common/sound", "button.mp3");
        gc.radiogroupmgr.check(this);
    },

    setAsChecked: function (value) {
        this.onClicked();
        this.refresh();
    },
    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },

    onDestroy: function () {
        if (gc && gc.radiogroupmgr) {
            gc.radiogroupmgr.del(this);
        }
    }
});
