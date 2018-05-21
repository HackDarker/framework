
var e_chat = require("e_chat");
function getQuickChatinfo() {
    return e_chat.E_QUICK_CHAT_INFO;
}

cc.Class({
    extends: cc.Component,

    properties: {
        voice_list: [],                             //当前等待播放的语音列表
    },

    // use this for initialization
    onLoad: function () {
        this.setChildrenScript();
        this.initEvents();

        gc.button.addBtnClickEvent(cc.find("layer_operation", this.node), this.node, this, "closeSelfInput");
        gc.button.addBtnClickEvent(cc.find("btn_chat", this.node), this.node, this, "sendShowChatInput");
        //gc.button.addBtnClickEvent(cc.find("btn_chat_history", this.node), this.node, this, "showChatHistory");

        this.btnVoice = cc.find("btn_voice", this.node);
        this.btnVoice.on(cc.Node.EventType.TOUCH_START, function (event) {
            gc.emit("voice_start", event);
        });
        this.btnVoice.on(cc.Node.EventType.TOUCH_MOVE, function (event) {
            gc.emit("voice_move", event);
        });
        this.btnVoice.on(cc.Node.EventType.TOUCH_END, function (event) {
            gc.emit("voice_end", event);
        });
        this.btnVoice.on(cc.Node.EventType.TOUCH_CANCEL, function (event) {
            gc.emit("voice_cancel", event);
        });

        this.update_func = [
            this.chatShowScript.checkTextMessageTime.bind(this.chatShowScript),
            this.chatShowScript.checkEmojiMessageTime.bind(this.chatShowScript),
            this.chatShowScript.checkVoiceTime.bind(this.chatShowScript)
        ];
    },

    sendShowChatInput: function () {
        gc.emit("chat_show");
    },

    setChildrenScript: function () {
        var tNode = null;
        tNode = cc.find("chat", this.node);
        this.chatShowScript = tNode.getComponent("chat") || tNode.addComponent("chat");

        tNode = cc.find("layer_operation/voice_input", this.node);
        this.voiceInputScript = tNode.getComponent("voice_input") || tNode.addComponent("voice_input");
    },

    initEvents: function () {
        gc.on("close_voice_input", this.closeSelfInput.bind(this));

        gc.on("voice_start", this.showVoiceInput.bind(this));
        gc.on("voice_move", this.onTouchMove.bind(this));
        gc.on("voice_end", this.onVoiceOver.bind(this));
        gc.on("voice_cancel", this.onVoiceCancel.bind(this));

        gc.on("chat_show", this.showChatInput.bind(this));

        gc.on('chat_quick_message', this.onQuickMessage.bind(this));
        gc.on('chat_text_message', this.onTextMessage.bind(this));
        gc.on('chat_voice_message', this.onVoiceMessage.bind(this));
        gc.on('chat_emoji', this.onEmojiMessage.bind(this));

        gc.on('set_chat_seat_active', this.setNodeActive.bind(this));       //参数为 激活的节点idx列表 [0,1,4]
    },

    onDestroy: function () {
        this.chatShowScript.stopVoice();
    },

    // called every frame, uncomment this function to activate update callback
    update: function (dt) {
        this.update_func[0]();
        this.update_func[1]();
        this.update_func[2](this.voice_list);
    },

    // 设定聊天节点是否激活
    //  event.detail  激活的节点idx列表 [0,1,4]
    setNodeActive: function (event) {
        this.chatShowScript.setNodeActive(event.detail);
    },

    closeSelfInput: function () {
        var tLsyer = cc.find("layer_operation", this.node);
        var tChildren = tLsyer.children;
        var tChild = null;
        for (var i = 0; i < tChildren.length; i++) {
            tChild = tChildren[i];
            if (!tChild) {
                continue;
            }
            if (tChild.name === "bg") {
                continue;
            }
            tChild.active = false;
        }

        tLsyer.active = false;
    },

    showChatInput: function () {
        gc.audio.playSFX("resources/common/sound", "button.mp3");
        gc.ui.showUI("chat",function(script){
            script.showChatInput();
        });
    },

    showChatHistory: function () {
        gc.audio.playSFX("resources/common/sound", "button.mp3");
        gc.ui.showUI("chat",function(script){
            script.showChatInput();
            script.showChatHistory();
        });
    },

    showVoiceInput: function (event) {
        event = event.detail;
        if (!gc.anysdk.isHasPermission(gc.enum.E_PERMISSION.RECORD)) {
            gc.alert.showUI("当前缺少录音权限，无法录音").setOK(
                true,
                function () {
                    gc.anysdk.showPermissionSetting(gc.enum.E_PERMISSION.RECORD)
                },
                null,
                null,
                "设置"
            ).setNO(true);
            return;
        }

        cc.find("layer_operation", this.node).active = true;
        cc.find("layer_operation/voice_input", this.node).active = true;

        //cc.log("cc.Node.EventType.TOUCH_START");
        console.log('start voice');
        this.voiceInputScript.onVoiceStart.call(this.voiceInputScript);
    },

    onTouchMove: function (event) {
        var oldEvent = event;
        event = event.detail;
        var tBtnVoice = event.currentTarget;
        var tLoc = tBtnVoice.convertToNodeSpaceAR(event.getLocation());
        if (
            tLoc.x < tBtnVoice.width * (tBtnVoice.anchorX - 1)
            || (tLoc.x > tBtnVoice.width * tBtnVoice.anchorX)
            || tLoc.y < tBtnVoice.width * (tBtnVoice.anchorY - 1)
            || (tLoc.y > tBtnVoice.width * tBtnVoice.anchorY)
        ) {
            this.onVoiceCancel(oldEvent);
        }
        // console.log("cc.Node.EventType.TOUCH_MOVE");
    },

    onVoiceCancel: function (event) {
        event = event.detail;
        //cc.log("cc.Node.EventType.TOUCH_CANCEL");
        this.voiceInputScript.onVoiceCancel.call(this.voiceInputScript);
    },

    onVoiceOver: function (event) {
        event = event.detail;
        //cc.log("cc.Node.EventType.TOUCH_END");
        this.voiceInputScript.voiceOver.call(this.voiceInputScript);
    },

    onTextMessage: function (data) {
        if (!data) {
            return;
        }
        var tData = data.detail;
        if (!tData) {
            return;
        }

        this.saveChatHistoryData(e_chat.E_HISTORY_TYPE.TEXT, tData)//文字
        this.chatShowScript.onTextMessage.call(this.chatShowScript, getSenderLocalIndex(tData.sender), tData.content);
    },

    onQuickMessage: function (data) {
        if (!data) {
            return;
        }
        var tData = data.detail;
        if (!tData) {
            return;
        }
        this.saveChatHistoryData(e_chat.E_HISTORY_TYPE.QUICK, tData)//快速
        var tQuickChatInfo = getQuickChatinfo()[tData.content];
        if (tQuickChatInfo) {
            this.chatShowScript.playFileVoice.bind(this.chatShowScript)("resources/modules/chat/sounds/", tQuickChatInfo.sound, tData.sender);
            this.chatShowScript.onTextMessage.call(this.chatShowScript, getSenderLocalIndex(tData.sender), tQuickChatInfo.content);
        }
        else {
            cc.log("quick message index error " + tData.content);
        }
    },

    onEmojiMessage: function (data) {
        if (!data) {
            return;
        }
        var tData = data.detail;
        if (!tData) {
            return;
        }
        this.saveChatHistoryData(e_chat.E_HISTORY_TYPE.EMOJI, tData)//表情
        this.chatShowScript.onEmojiMessage.call(this.chatShowScript, getSenderLocalIndex(tData.sender), tData.content);
    },

    onVoiceMessage: function (data) {
        if (!data) {
            return;
        }
        var tData = data.detail;
        if (!tData) {
            return;
        }
        tData.sender = tData.sender;

        this.saveChatHistoryData(e_chat.E_HISTORY_TYPE.VOICE, tData);//语音
        this.voice_list.push(tData);
        // playVoice(msgInfo.msg);
    },

    saveChatHistoryData: function (type, detail) {
        if (
            type == e_chat.E_HISTORY_TYPE.QUICK                     //快速聊天不需要记录
            || type == e_chat.E_HISTORY_TYPE.EMOJI                  //玩家表情不需要记录
        ) {
            return;
        }
        var data = {
            type: type,
            detail: detail,
        }
        gc.chatHistoryData = gc.chatHistoryData || [];
        gc.chatHistoryData.push(data);//聊天记录
    },
});


function netSend(name, info) {
    cc.log("send info to net :{ name : " + name + " , info : " + info);
    if (!gc.online) {
        switch (name) {
            case "quick_chat":
                gc.emit("chat_quick_message", { sender: gc.user.userId, content: info });
                break;
            case "emoji":
                gc.emit("chat_emoji", { sender: gc.user.userId, content: info });
                break;
            case "chat":
                gc.emit("chat_text_message", { sender: gc.user.userId, content: info });
                break;
            case "voice_msg":
                gc.emit("chat_voice_message", { sender: gc.user.userId, content: JSON.stringify(info) });
                break;
        }
    } else {
        gc.netSend(name, info);
    }
}

function getSenderLocalIndex(senderID) {
    //麻将
    if(gc.user.oldGameType == '0020001'){
        var seatIndex = gc.room.getSeatIndexByID(senderID);
        return global.gc.master.logic.getLocalIndex(seatIndex);
    }
    //斗地主
    else if(gc.user.oldGameType == '0010001'){
        var seatIndex = gc.room.getSeatIndexByID(senderID);
        return gc.master.ddzMgr.getLocalIndex(seatIndex);
    }
    //其它
    var seatIndex;
    var localIndex;
    if (gc.online) {
        seatIndex = gc.room.getSeatIndexByID(senderID);
        localIndex = gc.room.getLocalIndex(seatIndex);
    }
    else {
        localIndex = 0;
    }
    return localIndex;
}

function showAlert(content, callBack, caller) {
    if (gc.ui) {
        var tGameInfo = gc.sub_game.getGameInfoByGameType(gc.user.oldGameType);
        gc.alert["showUI" + tGameInfo.alert_type](content, gc.utils.struct_Callback(callBack, null, caller));

        // // 仅在十三水和斗地主项目中做此判断
        // if (gc.room.getConf().type == "thirteen") {
        //     gc.alert.showUI(content, gc.utils.struct_Callback(callBack, null, caller));
        // }
        // else {
        //     gc.alert.showUI2(content, gc.utils.struct_Callback(callBack, null, caller));
        // }

        cc.log(content);
        gc.utils.exeCallback(callBack, caller);
    }
}

exports.netSend = netSend;
exports.getQuickChatinfo = getQuickChatinfo;
exports.getSenderLocalIndex = getSenderLocalIndex;
exports.showAlert = showAlert;