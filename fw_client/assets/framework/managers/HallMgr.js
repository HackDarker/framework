cc.Class({
    extends: cc.Component,
    init: function () {
        cc.game.on(cc.game.EVENT_SHOW, gc.utils.checkVersion);
    },

    /**
     *  获取消息版本
     * @param {String} msgType      消息名字
     *  */
    getMsgVerByType: function (msgType) {
        gc.hall.msgVerDict = gc.hall.msgVerDict || {};
        return gc.hall.msgVerDict[msgType];
    },

    /**
     *  获取消息内容
     * @param {String} msgType      消息名字
     *  */
    getMsgInfoByType: function (msgType) {
        gc.hall.msgInfoDict = gc.hall.msgInfoDict || {};
        return gc.hall.msgInfoDict[msgType] || gc.enum.E_DEFAULT_SERVER_MESSAGE[msgType];
    },

    /**
     * 刷新服务器配置的消息
     * @param {String} msgType      消息名字
     */
    get_service_message: function (msgType) {
        var version = gc.hall.getMsgVerByType(msgType);
        gc.hall.msgVerDict = gc.hall.msgVerDict || {};
        gc.hall.msgInfoDict = gc.hall.msgInfoDict || {};

        if (gc.hall.msgVerDict && gc.hall.msgVerDict == version) {                            //获取的是当前版本的
            gc.emit("on_message_result", { type: msgType, isOK: true });
            return;
        }

        var onGetMessage = function (ret) {
            if (ret.errcode !== 0) {
                console.log(ret.errmsg);
            }
            else {
                if (ret.type == gc.enum.E_MESSAGE_TYPE["fkgm"]) {
                    ret.msg = ret.msg.replace("<newline>", "\n");
                }

                gc.hall.msgVerDict[ret.type] = ret.version;
                gc.hall.msgInfoDict[ret.type] = ret.msg;
            }
            gc.emit("on_message_result", { type: ret.type, isOK: (ret.errcode === 0) });
        };

        var data = {
            account: gc.user.account,
            sign: gc.user.sign,
            type: msgType,
            version: gc.hall.msgVerDict[msgType],
        };

        gc.http.sendRequest("/get_message", data, onGetMessage.bind(this));
    },

    /** 刷新所有消息 */
    refServiceMessage: function () {
        gc.enum.E_MESSAGE_TYPE
        var tRefSubGameMsg = function (game_name) {
            gc.hall.setDefaultMessage("msg_" + game_name, "当前公告" + game_name);                                                                 //游戏功公告
            gc.hall.get_service_message(gc.enum.E_MESSAGE_TYPE["msg_" + game_name]);

            gc.hall.setDefaultMessage("share_" + game_name, "本地玩法，熟人手机约局，不服来战");                                                   //分享内容
            gc.hall.get_service_message(gc.enum.E_MESSAGE_TYPE["share_" + game_name]);

            gc.hall.setDefaultMessage("invitation_" + game_name, "{room_id},{game_times}局,{player_num}人,{game_play}欢迎来玩!");                //邀请内容
            gc.hall.get_service_message(gc.enum.E_MESSAGE_TYPE["invitation_" + game_name]);
        }

        gc.hall.setDefaultMessage("notice", "数据请求中...");                                                                                   //跑马灯系统公告
        gc.hall.get_service_message("notice");

        gc.hall.setDefaultMessage("fkgm", "功能暂未开通");                                                                                       //未开启功能提示内容
        gc.hall.get_service_message("fkgm");

        gc.hall.setDefaultMessage("announcement", null);                                                                                       //健康游戏公告
        gc.hall.get_service_message("announcement");

        tRefSubGameMsg("main");
        var subGameArray = gc.enum.E_SUB_GAME_LIST;
        for (var i = 0; i < subGameArray.length; ++i) {
            var subGame = subGameArray[i];
            if (!subGame.enable) { continue; }

            tRefSubGameMsg(subGame.conf_type);
        }
    },

    /**
     * 设定信息的默认值
     * @param {String} message_type         消息类型
     * @param {String} message              消息默认值
     */
    setDefaultMessage: function (message_type, message) {
        gc.enum.E_MESSAGE_TYPE[message_type] = message_type;
        gc.enum.E_DEFAULT_SERVER_MESSAGE[message_type] = message;
    },
});
