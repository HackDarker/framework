
var thisNode;
var ChatAndVoice = require("chat_and_voice");
var e_chat = require("e_chat");
function getQuickChatinfo() {
    return e_chat.E_QUICK_CHAT_INFO;
}
cc.Class({
    extends: cc.Component,

    properties: {

    },

    // use this for initialization
    onLoad: function () {
        thisNode = this.node;

        gc.button.addBtnClickEvent(cc.find("btnSend", thisNode), thisNode, this, "onBtnSendChatClicked");
        gc.toggle.addToggleClickEvent(cc.find("toggle_input", thisNode), thisNode, this, "changeView");

        this.chatHistoryContent = cc.find("chat_history_panel/scrollView/view/content", this.node);
        this.chatHistoryItem = cc.instantiate(this.chatHistoryContent.children[0]);
        this.chatHistoryContent.removeChild(this.chatHistoryContent.children[0]);

        this.initChatList();
        this.initEmojiList();
    },

    showChatInput: function () {
        this.refInputView(cc.find("toggle_input/btnQuick", this.node));
    },

    showChatHistory: function () {
        this.refInputView(cc.find("toggle_input/btnHistory", this.node));
        this.initChatHistoryList();
    },

    initChatHistoryList: function () {
        var chatHistoryData = gc.chatHistoryData || [];

        this.chatHistoryContent.removeAllChildren();
        for (var i = 0; i < chatHistoryData.length; i++) {

            var data = chatHistoryData[i];
            var newnode = cc.instantiate(this.chatHistoryItem);
            this.chatHistoryContent.addChild(newnode);
            var head = newnode.getChildByName("head");
            var text = newnode.getChildByName("text");
            var audio = newnode.getChildByName("audio");
            var emoji = newnode.getChildByName("emoji");
            text.active = false;
            audio.active = false;
            emoji.active = false;

            gc.button.addBtnClickEvent(head, this.node, this, "onClickHead");

            var temptx = gc.sprite.getDefaultHeadIcon();
            gc.sprite.setPlayerHeadIcon(head, data.detail.sender, temptx);
            if (data.type == e_chat.E_HISTORY_TYPE.TEXT) {                          //文字
                text.active = true;
                text.getComponent(cc.Label).string = data.detail.content;
            }
            else if (data.type == e_chat.E_HISTORY_TYPE.EMOJI) {                    //表情
                emoji.active = true;
                gc.utils.playEfx(emoji, data.detail.content, "modules/chat/anims/");
            }
            else if (data.type == e_chat.E_HISTORY_TYPE.VOICE) {                    //语音
                audio.active = true;
                audio.idv = i;
                gc.button.addBtnClickEvent(audio, this.node, this, "onVoiceClicked");
            }
            else if (data.type == e_chat.E_HISTORY_TYPE.QUICK) {                    //快速
                var tQuickChatInfo = getQuickChatinfo()[data.detail.content];
                if (tQuickChatInfo) {

                    text.active = true;
                    text.getComponent(cc.Label).string = tQuickChatInfo.content;
                }
            }
        }
        cc.find("chat_history_panel/scrollView", this.node).getComponent(cc.ScrollView).scrollToBottom(0.1);
    },

    onClickHead: function (event) {
        var tNode = event.currentTarget;
        var tParentNode = tNode.parent;
        var chatHistoryData = gc.chatHistoryData || [];
        var tuserID = chatHistoryData[this.chatHistoryContent.children.indexOf(tParentNode)].detail.sender;
        if (tuserID < 1) {
            return;
        }
        gc.ui.showUI("player_info_game",function(script){
            script.setUserID(tuserID);
        });
    },

    onPlayerInfoShow: function (userId, infoNode) {
        var tScript = gc.ui.getUIMainScript("player_info");
        tScript.setPlayerID(userId);
    },

    onEnable: function () {
        this.refInputView(cc.find("toggle_input/btnQuick", thisNode));
    },

    onDestroy: function () {

    },

    onVoiceClicked: function (event) {
        var chatHistoryData = gc.chatHistoryData || [];
        var id = event.target.idv;
        gc.utils.playEfx(event.target, 'paly_void', 'modules/chat/anims/');
        var msgInfo = chatHistoryData[id];
        var tDetail = msgInfo.detail;
        if (!msgInfo) { return; }
        switch (msgInfo.type) {
            case e_chat.E_HISTORY_TYPE.VOICE:
                gc.emit("replay_voice", tDetail.content);
                break;
            case e_chat.E_HISTORY_TYPE.QUICK:
                break;
        }
        // if (false) {
        //     msgInfo = chatHistoryData[id].data.content;
        // }
        // else {
        //     msgInfo = JSON.parse(chatHistoryData[id].data.content);
        // }
        // playVoice(msgInfo.msg);
    },

    getUsableQuickChatItem: function (index) {
        var tQuickChatListNode = cc.find("quickchatlist/view/content", thisNode);
        if (index >= tQuickChatListNode.children.length) {
            var original = tQuickChatListNode.children[0];
            var node = cc.instantiate(original);
            node.parent = tQuickChatListNode;
        }
        return tQuickChatListNode.children[index];
    },

    initChatList: function () {
        var quickChatInfo = getQuickChatinfo();
        for (var k in quickChatInfo) {
            var info = quickChatInfo[k];
            var node = this.getUsableQuickChatItem(info.index);
            gc.text.setTxtString(node.getChildByName('label'), info.content);
            node.quickIndex = info.index;
        }

        var tChatListLayer = cc.find("quickchatlist/view/content", thisNode);

        for (var k in tChatListLayer.children) {
            var node = tChatListLayer.children[k];
            gc.button.addBtnClickEvent(node, this.node, this, 'onQuickChatItemClicked');
        }
    },

    initEmojiList: function () {
        var list = cc.find("emojis/list", thisNode);
        for (var k in list.children) {
            var node = list.children[k];
            gc.button.addBtnClickEvent(node, this.node, this, 'onEmojiItemClicked');
        }
    },

    onQuickChatItemClicked: function (event) {
        gc.emit("close_voice_input");
        ChatAndVoice.netSend("quick_chat", event.target.quickIndex);
    },

    onEmojiItemClicked: function (event) {
        gc.emit("close_voice_input");
        ChatAndVoice.netSend("emoji", event.target.name);
    },

    onBtnSendChatClicked: function () {
        gc.emit("close_voice_input");

        var tNeedSendString = gc.text.getTxtString(cc.find("iptChat", thisNode));
        if (tNeedSendString == "") {
            return;
        }
        ChatAndVoice.netSend("chat", tNeedSendString);
        gc.text.setTxtString(cc.find("iptChat", thisNode));
    },

    changeView: function (event) {
        this.refInputView(event.currentTarget);
    },

    refInputView: function (node) {
        var tToggleGroupNode = cc.find("toggle_input", thisNode);
        var tNowIdx = gc.toggle.getToggleGroupIdx(tToggleGroupNode, node);
        gc.toggle.setToggleGroupSelection(tToggleGroupNode, node);
        switch (tNowIdx) {
            case 0:
                cc.find("quickchatlist", thisNode).active = true;
                cc.find("emojis", thisNode).active = false;
                cc.find("chat_history_panel", thisNode).active = false;
                break;
            case 1:
                cc.find("quickchatlist", thisNode).active = false;
                cc.find("emojis", thisNode).active = true;
                cc.find("chat_history_panel", thisNode).active = false;
                break;
            case 2:
                cc.find("quickchatlist", thisNode).active = false;
                cc.find("emojis", thisNode).active = false;
                cc.find("chat_history_panel", thisNode).active = true;
                this.initChatHistoryList();
                break;
        }
    },
});