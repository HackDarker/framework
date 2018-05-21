/** 当前激活的座位 */
var _activeList = null;

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

    onLoad: function () {
        this.initView();
        this.initVoiceStuffs();

        gc.on("replay_voice", function (event) {
            this.replayHistoryVoice(event.detail);
        }.bind(this));
    },

    onEnable: function () {
        this.refNodeActive();
    },

    onDisable: function () {
        _activeList = null;
    },

    initView: function () {
        var tActiveList = [];
        this._seats = [];
        for (var k in this.node.children) {
            var seatNode = this.node.children[k];
            // seatNode.active = true;
            var seatCtx = {
                node: seatNode,
                voice: seatNode.getChildByName('voice'),
                text: seatNode.getChildByName('text'),
                emoji: seatNode.getChildByName('emoji'),
            }
            this._seats.push(seatCtx);
            if (seatCtx.voice) {
                seatCtx.voice.active = false;
            }
            if (seatCtx.text) {
                seatCtx.text.active = false;
            }
            if (seatCtx.emoji) {
                seatCtx.emoji.active = false;
            }

            tActiveList.push(k);
        }

        if (!_activeList) {
            _activeList = tActiveList;
        }
    },

    initVoiceStuffs: function () {
        this._voiceMsgQueue = [];

    },

    /** 接收到文本消息 */
    onTextMessage: function (localIndex, content) {
        var seat = this.getSeat(localIndex);//this._seats[localIndex];
        seat.text.active = true;
        gc.text.setTxtString(seat.text.getChildByName('content'), content);
        seat.textShowTime = Date.now() + 3000;
    },

    /** 检查文字的显示时间 chat_and_voice中的update会不停调用 */
    checkTextMessageTime: function () {
        for (var k in this._seats) {
            var seat = this._seats[k];
            if (seat.textShowTime != null) {
                if (seat.textShowTime < Date.now()) {
                    seat.textShowTime = null;
                    seat.text.active = false;
                }
            }
        }
    },

    /** 接收到播放动画的消息 */
    onEmojiMessage: function (localIndex, content) {
        var seat = this.getSeat(localIndex);//this._seats[localIndex];
        seat.emoji.active = true;
        gc.utils.playEfx(seat.emoji, content, "modules/chat/anims/");
        seat.emojiShowTime = Date.now() + 3000;
    },

    /** 检查动画的播放时间 chat_and_voice中的update会不停调用 */
    checkEmojiMessageTime: function () {
        for (var k in this._seats) {
            var seat = this._seats[k];
            if (seat.emojiShowTime != null) {
                if (seat.emojiShowTime < Date.now()) {
                    seat.emojiShowTime = null;
                    seat.emoji.active = false;
                }
            }
        }
    },

    /** 显示发音图标 */
    showVoice: function (localIndex) {
        if (!this._seats) { return; }

        for (var i = 0; i < this._seats.length; i++) {
            this._seats[i].voice.active = false;
        }

        this._playingSeat = localIndex;
        var seat = this.getSeat(localIndex);//this._seats[localIndex]
        seat.voice.active = true;
        // this._lastPlayTime = Date.now() + msgInfo.time;
    },

    /** 播放声音文件 */
    playFileVoice: function (path, url, userID) {
        //if (gc.audio.getBgmMuteByFlag("ddzchat") || (gc.audio.getSfxMuteByFlag("ddzchat"))) { return; }                 //当前有其他音效正在播放
        gc.audio.playSFX(path, url, userID);
    },

    /** 重放语音记录 */
    replayHistoryVoice: function (data) {
        if (
            !this.isHistoryVoicePlaying                                 //不是播放历史语音
            && (
                gc.audio.getBgmMuteByFlag("ddzchat")
                || (gc.audio.getSfxMuteByFlag("ddzchat"))
            )                                                           //当前有其他音效正在播放
        ) {
            return;
        }
        this.isHistoryVoicePlaying = true;
        this.playVoice(data);
    },

    /** 播放音效 */
    playVoice: function (data) {
        var msgfile = "voicemsg.amr";
        data = JSON.parse(data);
        console.log(data.msg.length);

        gc.voice.writeVoice(msgfile, data.msg);
        gc.audio.mute('voice');

        gc.voice.play(msgfile);
        this._lastPlayTime = Date.now() + data.time;
    },

    /** 声音文件播放完毕 */
    onPlayerOver: function (event) {
        this.isHistoryVoicePlaying = false;
        //if (gc.audio.getBgmMuteByFlag("ddzchat") || (gc.audio.getSfxMuteByFlag("ddzchat"))) {
            gc.audio.unmute('voice');

            console.log("onPlayCallback:" + this._playingSeat);
            var localIndex = this._playingSeat;
            // this._playingSeat = null;
            this.getSeat(localIndex).voice.active = false;
            this._playingSeat = null;
            this._lastPlayTime = null;
        //}
    },

    /** 检查播放的时间，并判断是否需要播放下一个音效 chat_and_voice 中 update会不停调用 */
    checkVoiceTime: function (voiceList) {
        if (this._lastPlayTime != null) {
            if (Date.now() > this._lastPlayTime + 200) {
                this.onPlayerOver();
                this._lastPlayTime = null;
                cc.log("player voice over");
            }
        }
        else if (voiceList) {
            var data = voiceList.shift();
            if (!data) { return; }
            // console.log(" 剩余音效数量 ", voiceList.length);
            var tChairIdx = gc.room.getSeatIndexByID(data.sender);
            var tLocalIdx = gc.room.getLocalIndex(tChairIdx);
            this.showVoice(tLocalIdx);
            this.playVoice(data.content);
        }
    },

    update: function () {
    },

    // 设定聊天节点是否激活
    //  activeList  激活的节点idx列表 [0,1,4]
    setNodeActive: function (activeList) {
        _activeList = activeList;
        this.refNodeActive();
    },

    refNodeActive: function () {
        var tActiveList = _activeList ? _activeList : [];
        var i = 0;
        var tSeatList = this._seats ? this._seats : [];

        for (i = 0; i < tActiveList.length; i++) {
            tActiveList[i] = tActiveList[i] - 0;
        }

        for (i = 0; i < tSeatList.length; i++) {
            var seat = tSeatList[i];
            if (!seat || !seat.node) {
                continue;
            }
            seat.node.active = (tActiveList.indexOf(i) !== -1);
        }
    },

    getSeat: function (localIndex) {
        var i = 0;
        while (this._seats.length > (localIndex + i)) {
            var seat = this._seats[localIndex + i];
            if (seat && seat.node && seat.node.active) {
                return this._seats[localIndex + i];
            }
            i++;
        }
        return null;
        // if (this._seats[localIndex].node.active) {
        //     return this._seats[localIndex];
        // }
    },

    stopVoice: function () {
        gc.voice.stop();
        gc.audio.unmute('voice');
    },
});
