cc.Class({
    extends: cc.Component,

    properties: {
    },

    init:function(){
        //设置100ms update一次
        var self = this;
        setInterval(function () {
            self.update();
        }, 100);
    },

    backToHall:function(){
        if(gc.masterSettings.entry_scene){
            gc.utils.loadScene(gc.masterSettings.entry_scene);
        }
        else{
            gc.switchMaster('lobby_platform');
        }
    },

    start: function () {
        var agent = gc.createNetAgent('gamenetmgr');
        gc.net.addAgent(agent,true);
        var self = this;

        agent.addHandler("disconnect", function (data) {
            if (gc.room.roomId === null) {
                // gc.utils.loadScene("hall_" + gc.user.oldGameType);

                if (gc.room.matchExitCly) {
                    cc.director.loadScene("cfx_test_scenes");
                }
                else {
                    self.backToHall();
                }
            }
            else {
                if (gc.room.isOver === false) {
                    gc.user.oldRoomId = gc.room.roomId;
                    gc.emit("disconnect");
                }
                else {
                    gc.room.roomId = null;
                }
            }
        });

        agent.addHandler("login_result", function (data) {
            console.log(data);
            if (data.errcode === 0) {
                var dat = data.data;
                if(dat){
                    gc.room.onLogin(dat);
                }
                gc.net.reconnectParams = data.reconnect_params;
            }
            else {
                console.log(data.errmsg);
                self.backToHall();
            }
        });

        // var data = { user_id: item.userId, rank: (i + 1), total_players: this.totalRooms * 4 };
        agent.addHandler("login_finished", function (data) {
            console.log("login_finished");
            var scene = gc.masterSettings.game_scene;
            if(scene){
                gc.utils.loadScene(scene, function () {
                    gc.net.ping();
                });
            }
            gc.emit('login_finished');
        });
    },

    connectGameServer: function (data) {
        gc.room.dissoveData = null;
        gc.net.ip = data.ip + ":" + data.port;
        console.log(gc.net.ip);
        var self = this;

        var onConnectOK = function () {
            gc.room.isOver = false;
            console.log("onConnectOK");
            var sd = {
                token: data.token,
                roomid: data.roomid,
                time: data.time,
                sign: data.sign,
            };
            gc.net.send("login", sd);
        };

        var onConnectFailed = function () {
            console.log("failed.");
            gc.wc.hideWC();
        };
        var tips = "正在进入房间";
        if (gc.user.oldGameMode == 'match') {
            tips = "正在进入比赛";
        }
        gc.wc.showWC(tips);
        gc.net.connect(onConnectOK, onConnectFailed);
    },

    reset: function () {
        gc.emit("game_net_re_connect");
    },

    //测试服务器是否可达
    testServerOn: function () {
        console.log('testServerOn');
        gc.net.test(function (ret) {
            console.log('test return - ' + ret);
            if (ret) {
                this.reset();
                this.doReconnect();
            } else {
                setTimeout(this.testServerOn.bind(this), 3000);
            }
        }.bind(this));
    },

    doReconnect:function(){
        var self = this;
        var roomId = gc.user.oldRoomId;
        if (roomId !== null) {
            gc.user.oldRoomId = null;
            var gameType;
            var gameMode = gc.user.oldGameMode;
            var entry_scene = gc.masterSettings.entry_scene;
            var gameType = gc.masterSettings.id;
            gc.user.enterRoom(roomId, function (ret) {
                if (ret.errcode !== 0) {
                    var showstring = ""
                    if(gc.user.oldGameMode && gc.user.oldGameMode == "match"){
                        showstring = "比赛已结束！";
                    }else{
                        showstring = "房间已关闭！"
                    }
                    gc.alert.showUI(showstring).setOK(true, function(){
                        self.backToHall();
                    }, null, this, "确认");
                }
                else{

                }
            }.bind(this), gameType, gameMode);
        }
    },

    //called every frame, uncomment this function to activate update callback
    update: function (dt) {
        var isNetTurnOff = this.lastSio && !gc.net.getSio();
        if(isNetTurnOff && gc.master.isPlaying && gc.master.isPlaying()){
            this.testServerOn();
            gc.wc.showWC("正在重连");
        }
        
        this.lastSio = gc.net.getSio();
    },
});
