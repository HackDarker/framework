if (window.io == null) {
    window.io = require("socket-io");
}

module.exports = NetConnectionClass;
function NetConnectionClass(){
    this.ip = '';
    this.sio = null;
    this.lastRecieveTime = null;
    
    this.lastSendTime = null;
    this.delayMS = null;
    
    this.agents = [];

    this.timerPing = -1;
    this.timerTimeout = -1;

    this.onEventShowBind = this.onEventShow.bind(this);
}

//reserved 如果标记为保留，则不会清除
NetConnectionClass.prototype.addAgent = function(agent,reserved){
    var idx = this.agents.indexOf(agent);
    if(idx != -1){
        return;
    }
    agent.reserved = reserved;
    this.agents.push(agent);
}

NetConnectionClass.prototype.removeAgent = function(agent){
    var idx = this.agents.indexOf(agent);
    if(idx != -1){
        this.agents.splice(idx,1);
    }
}

NetConnectionClass.prototype.clearAgent = function(agent){
    var arr = [];
    for(var i = 0; i < this.agents.length; ++i){
        var agent = this.agents[i];
        if(agent.reserved){
            arr.push(agent);
        }
    }
    this.agents = arr;
}

NetConnectionClass.prototype.onEventShow = function(){
    this.ping();
}

NetConnectionClass.prototype.init = function(){
    this.ip = '';
    this.sio = null;    
}

NetConnectionClass.prototype.dispatchEvent = function(type,data){
    for(var k in this.agents){
        var agent = this.agents[k];
        agent.onMessage(type,data);
    }
}

NetConnectionClass.prototype.gamemsgHandler = function(param) {
    console.log('[Debug] - gamemsghandler called.');
    var isStr = (typeof param === 'string');
    if (isStr === true) {
        param = JSON.parse(param);
    }

    if (param == null || param.msg == null) {
        console.log('[Error] - param [' + param + '] or msg is null.');
        return;
    }

    var gamemsg = gc.crypto.AesDecrypt(param.msg, gc.crypto.GAME_AES_KEY);
    var msgobj = JSON.parse(gamemsg);
    if (msgobj != null) {
        var event = msgobj.event;
        var data = msgobj.data;

        if (event != "disconnect" && typeof(data) == "string") {
            data = JSON.parse(data);
        }
        cc.log(("on net event : [" + event + "]   ["), data, "]");
        this.dispatchEvent(event,data);
    }
}

NetConnectionClass.prototype.connect = function(fnConnect, fnError) {
    var timer = setTimeout(function () {
        console.log('connect timeout');
        close();
    }, 10000);

    this.connectInternal(function (data) {
        clearTimeout(timer);
        fnConnect(data);
    }, function (data) {
        clearTimeout(timer);
        fnError(data);
    });
}

NetConnectionClass.prototype.connectInternal = function(fnConnect, fnError) {
    var opts = {
        'reconnection': false,
        'force new connection': true,
        'transports': ['websocket', 'polling']
    };

    var self = this;

    self.sio = window.io.connect(self.ip, opts);

    self.sio.on('connect', function (data) {
        if (self.sio) {
            self.sio.connected = true;
            fnConnect(data);
            self.startHearbeat();
        }
    });

    self.sio.on('disconnect', function (data) {
        console.log("disconnect");
        if(self.sio){
            self.sio.connected = false;
            self.close();
        }
    });

    self.sio.on('connect_failed', function () {
        console.log('connect_failed');
    });

    //register game event
    self.sio.on('gamemsg', function(data){
        self.gamemsgHandler(data);
    });
}

NetConnectionClass.prototype.startHearbeat = function () {
    clearInterval(this.timerPing);
    clearInterval(this.timerTimeout);
    cc.game.off(cc.game.EVENT_SHOW,this.onEventShowBind);
    
    var self = this;
    this.sio.on('game_pong', function () {
        console.log('game_pong');
        self.lastRecieveTime = Date.now();
        self.delayMS = self.lastRecieveTime - self.lastSendTime;
        console.log(self.delayMS);
    });

    this.lastRecieveTime = Date.now();
    cc.game.on(cc.game.EVENT_SHOW,this.onEventShowBind);

    this.timerPing = setInterval(function () {
        self.ping();
    }, 5000);
    this.timerTimeout = setInterval(function () {
        if (Date.now() - self.lastRecieveTime > 10000) {
            self.close();
        }
    }, 500);
}

NetConnectionClass.prototype.send = function(event, data) {
    if(!this.sio || !this.sio.connected){
        return;
    }

    if (data !== null && (typeof (data) == "object")) {
        data = JSON.stringify(data);
        //console.log(data);              
    }
    cc.log(("send net event : [" + event + "]   ["), data, "]");

    //加密
    var senddata = {
        event: event,
        data: data,
        mid: ++gc.http.mid,
    };
    var sendstr = JSON.stringify(senddata);
    sendstr = gc.crypto.AesEncrypt(sendstr, gc.crypto.GAME_AES_KEY);
    this.sio.emit('gamemsg', { msg: sendstr });
}

NetConnectionClass.prototype.ping = function() {
    if (this.sio) {
        this.lastSendTime = Date.now();
        this.sio.emit('game_ping');
    }
}

NetConnectionClass.prototype.close = function() {
    if(!this.sio){
        return;
    }
    console.log('close');
    
    if (this.sio.connected) {
        this.sio.connected = false;
        this.sio.disconnect();
    }

    this.dispatchEvent('disconnect');

    this.sio = null;
    this.delayMS = null;
    clearInterval(this.timerPing);
    clearInterval(this.timerTimeout);
    cc.game.off(cc.game.EVENT_SHOW,this.onEventShowBind);
}

NetConnectionClass.prototype.test = function(fnResult) {
    var xhr = null;
    var fn = function (ret) {
        fnResult(ret.errcode==0);
        xhr = null;
    };

    xhr = gc.http.sendRequest("/hi", {}, fn,'http://' + this.ip,true);
}

NetConnectionClass.prototype.getSio = function() {
    return this.sio;
}

NetConnectionClass.prototype.getDelayMS = function() {
    return this.delayMS;
}

NetConnectionClass.prototype.getSignalStrength = function() {
    var delayMS = this.delayMS;
    if (!delayMS || delayMS >= 1000) {
        return 3;
    }
    else if (delayMS >= 500) {
        return 2;
    }
    else if (delayMS >= 200) {
        return 1;
    }
    else if (delayMS >= 0) {
        return 0;
    }
}