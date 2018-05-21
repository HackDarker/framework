cc.Class({
    extends: cc.Component,
    properties: {
    },
    onLoad: function () {
        this.setupSpriteFrame();
    },

    setUserID: function (userid) {
        if (!userid) {
            return;
        }

        var self = this;
        var tCallFunc = function (code, info) {
            console.log(info.url);
            if (info && info.url) {    
                gc.sprite.loadImage(info.url, function (spriteFrame) {
                    self._spriteFrame = spriteFrame;
                    self.setupSpriteFrame();
                });
            }
        };

        gc.player.callPlayerInfo(userid, tCallFunc);
    },

    setupSpriteFrame: function () {
        if (this._spriteFrame) {
            var spr = this.getComponent(cc.Sprite);
            if (spr) {
                spr.spriteFrame = this._spriteFrame;
            }
        }
    }
});
