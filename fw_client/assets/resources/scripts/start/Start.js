
cc.Class({
    extends: cc.Component,

    properties: {
        _isLoading: true,
        _progress: 0.0,
    },

    // LIFE-CYCLE CALLBACKS:

    onLoad() {
        let self = this;
        this.progressBar = cc.find('ProgressBar', this.node).getComponent(cc.ProgressBar);
        this.progressBar.progress = this._progress;
        // this.progressBar.node.active = false;

        this.loadingProgess = this.node.getChildByName('tip').getComponent(cc.Label);
    },

    start() {
        this.showSplash(function () {
            this.loadRes();
            gc.emit('app_start');
        }.bind(this));
    },

    showSplash: function (callback) {
        var self = this;
        var SHOW_TIME = 1000;
        var FADE_TIME = 500;
        this._splash = cc.find("Canvas/splash");
        this._splash.active = true;
        if (this._splash.getComponent(cc.Sprite).spriteFrame == null) {
            callback();
            return;
        }
        var t = Date.now();
        var fn = function () {
            var dt = Date.now() - t;
            if (dt < SHOW_TIME) {
                setTimeout(fn, 33);
            }
            else {
                var op = (1 - ((dt - SHOW_TIME) / FADE_TIME)) * 255;
                if (op < 0) {
                    self._splash.opacity = 0;
                    callback();
                }
                else {
                    self._splash.opacity = op;
                    setTimeout(fn, 33);
                }
            }
        };
        setTimeout(fn, 33);
    },

    loadRes() {
        let self = this;
        cc.loader.onProgress = function (completedCount, totalCount, item) {
            // console.log("completedCount:" + completedCount + ",totalCount:" + totalCount);
            if (self._isLoading) {
                self.progressBar.node.active = true;
                self._progress = completedCount / totalCount;
                self.progressBar.progress = self._progress;
                self.loadingProgess.string = '资源加载中...' + Math.floor(self._progress * 100) + '%';;
            }
        };

        cc.loader.loadResDir("modules", cc.Texture2D, function (err, assets) {
            console.log('加载资源');
            self.onLoadComplete();
        });

        cc.loader.onProgress = null;
    },

    onLoadComplete() {
        this._isLoading = false;
        cc.loader.onComplete = null;
        gc.utils.loadScene('login', () => {

        });
    },

    update(dt) {
    },
});
