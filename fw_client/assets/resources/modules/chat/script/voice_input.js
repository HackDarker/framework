var thisNode;

var ChatAndVoice = require("chat_and_voice");

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
        _lastTouchTime: null,
        _voice: null,
        _volume: null,
        _voice_failed: null,
        _lastCheckTime: -1,
        _timeBar: null,
        MAX_TIME: 15000,
    },

    // use this for initialization
    onLoad: function () {
        thisNode = this.node;

        this._voice = thisNode;

        this._timeBar = thisNode.getChildByName("time");
        this._timeBar.scaleX = 0.0;

        this._volume = thisNode.getChildByName("volume");
        for (var i = 1; i < this._volume.children.length; ++i) {
            this._volume.children[i].active = false;
        }
    },

    // called every frame, uncomment this function to activate update callback
    update: function (dt) {
        if (this.node.parent && this.node.active) {
            if (Date.now() - this._lastCheckTime > 300) {
                for (var i = 0; i < this._volume.children.length; ++i) {
                    this._volume.children[i].active = false;
                }
                var v = gc.voice.getVoiceLevel(7);
                if (v >= 1 && v <= 7) {
                    this._volume.children[v - 1].active = true;
                }
                this._lastCheckTime = Date.now();
            }
        }

        if (this._lastTouchTime) {
            var time = Date.now() - this._lastTouchTime;
            if (time >= this.MAX_TIME) {
                this.onVoiceOK();
                this._lastTouchTime = null;
            }
            else {
                var percent = time / this.MAX_TIME;
                this._timeBar.scaleX = 1 - percent;
            }
        }
    },

    onVoiceStart: function () {
        gc.audio.mute('record');

        this._lastTouchTime = Date.now();
        var isPermission = gc.voice.prepare("record.amr");
        //gc.emit('voice_start');
        return isPermission;
    },

    voiceOver: function () {
        if (Date.now() - this._lastTouchTime < 1000) {
            this.onVoiceCancel();
            gc.alert.showUI('语音小于1秒，不能发送', function () { this.onVoiceCancel(); }.bind(this));
        }
        else {
            this.onVoiceOK();
        }
    },

    onVoiceCancel: function () {
        gc.voice.cancel();

        gc.audio.unmute('record');

        this._lastTouchTime = null;
        gc.emit("close_voice_input");
    },

    onVoiceOK: function () {
        if (this._lastTouchTime != null) {
            gc.voice.release();
            var time = Date.now() - this._lastTouchTime;
            var msg = gc.voice.getVoiceData("record.amr");
            ChatAndVoice.netSend("voice_msg", { msg: msg, time: time });
        }
        gc.emit("close_voice_input");
        this._lastTouchTime = null;

        setTimeout(function(){
            gc.audio.unmute('record');
        },200);
        //gc.voice.setVolume(1);
    },
});
