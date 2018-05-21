module.exports = ModuleClass;
function ModuleClass(){}

// use this for initialization
ModuleClass.prototype.init = function () {
}

ModuleClass.prototype.start = function () {
    var agent = gc.createNetAgent('chatmgr');
    gc.net.addAgent(agent,true);
    agent.addTarget(this);
}

ModuleClass.prototype.onnet_chat_push = function (data) {
    gc.emit("chat_text_message", data);
}

ModuleClass.prototype.onnet_quick_chat_push = function (data) {
    gc.emit("chat_quick_message", data);
}

ModuleClass.prototype.onnet_emoji_push = function (data) {
    gc.emit("chat_emoji", data);
}

ModuleClass.prototype.onnet_voice_msg_push = function (data) {
    gc.emit("chat_voice_message", data);
}