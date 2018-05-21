cc.Class({
    extends: cc.Component,
    init: function () {
        var tObj = {};
        if (gc.online) {
            tObj.account = null;
            tObj.userid = null;
            tObj.name = null;
            tObj.lv = 0;
            tObj.exp = 0;
            tObj.coins = 0;
            tObj.gems = 0;
            tObj.sign = 0;
            tObj.ip = "";
            tObj.sex = 0;
        }
        else {
            tObj.account = "111";
            tObj.sign = "111";
            tObj.userid = "23333" + 0;
            tObj.name = "测试0";
            tObj.lv = 1;
            tObj.exp = 1;
            tObj.coins = 20;
            tObj.gems = 30;
            tObj.sex = null;
            tObj.ip = "192.168.0.254";
        }

        this.refUserInfo(tObj);
    },

    onAuth: function (ret) {
        console.log('onAuth', ret);
        var self = gc.user;
        if (ret.errcode == 0) {
            gc.wc.hideWC();
            self.account = ret.account;
            self.sign = ret.sign;
            if (gc.SI) {
                gc.http.url = "http://" + gc.SI.hall;
            }

            gc.http.token = ret.token;
            gc.http.mid = ret.mid;

            self.login();
        } else if (ret.errcode == -10) {
            // 需要创建一个新的账号
            setTimeout(function () {
                gc.wc.hideWC();
                // gc.switchMaster("create_role");
                gc.utils.loadScene('createrole', () => {

                });
            }, 2000);
        } else {
            gc.wc.hideWC();
            console.log(ret.errmsg);
        }
    },

    // 获取玩家货币
    getUserCash: function () {
        if (gc.online) {
            gc.http.sendRequest("/get_user_cash", { account: gc.user.account, sign: gc.user.sign }, this.refUserInfo);
        } else {
            this.refUserInfo({
                coins: 20,
                gems: 30
            });
        }
    },

    refUserInfo: function (ret) {
        var tSelf = gc.user ? gc.user : this;
        tSelf.setObjValueTo(ret, "account", tSelf, "account");
        tSelf.setObjValueTo(ret, "userid", tSelf, "userId");
        tSelf.setObjValueTo(ret, "name", tSelf, "userName");
        tSelf.setObjValueTo(ret, "lv", tSelf, "lv");
        tSelf.setObjValueTo(ret, "exp", tSelf, "exp");
        tSelf.setObjValueTo(ret, "gems", tSelf, "gems");
        tSelf.setObjValueTo(ret, "sex", tSelf, "sex");
        tSelf.setObjValueTo(ret, "ip", tSelf, "ip");

        tSelf.setObjValueTo(ret, "token", gc.http, "token");

        gc.emit("refresh_user_info");
    },
    setObjValueTo: function (obj, name, toObj, toName) {
        if (name in obj) {
            toObj[toName] = obj[name];
        }
    },

    login: function () {
        var self = this;
        if (!gc.online) {
            return;
        }

        console.log(" http url => " + gc.http.url);
        var onLogin = function (ret) {
            if (ret.errcode !== 0) {
                console.log('登录失败-错误码:{0},重新登录!'.format(ret.errcode));
                gc.http.sendRequest("/login", {
                    account: self.account,
                    sign: self.sign
                }, onLogin);
            } else {
                if (!ret.userid) {
                    if (self.account.indexOf('wx_') == 0) {
                        // gc.wc.hideWC();
                        gc.wc.hideWC();
                        cc.sys.localStorage.removeItem("wx_account");
                        gc.http.url = gc.http.master_url;
                        return;
                    }
                    //jump to register user info.
                    gc.utils.loadScene("createrole");
                } else {
                    console.log(ret);
                    self.refUserInfo.call(self, ret);

                    // gc.switchMaster('hall', false, ret);
                    gc.utils.loadScene('hall', () => {

                    });
                }
            }
        };
        gc.wc.showWC("正在登录游戏");
        console.log('正在登录游戏');
        gc.http.sendRequest("/login", { account: this.account, sign: this.sign }, onLogin);
    },

    /**刷新玩家信息 */
    refreshInfo: function () {
        var self = this;
        var onGet = function (ret) {
            if (ret.errcode !== 0) {
                console.log(ret.errmsg);
            }
            else {
                this.refUserInfo(ret);
            }
        };

        var data = {
            account: gc.user.account,
            sign: gc.user.sign,
        };
        gc.http.sendRequest("/get_user_status", data, onGet.bind(this));
    },

    /** 进入房间 */
    enterRoom: function (roomId, callback, gameType, gameMode) {
        var self = this;
        self.lastRoom = roomId;
        var onEnter = function (ret) {
            self = gc.user;
            self.lastRoomId = roomId;
            if (ret.errcode !== 0) {
                if (ret.errcode == -1) {
                    setTimeout(function () {
                        self.enterRoom(roomId, callback, gameType, gameMode);
                    }, 5000);
                    return;
                }

                gc.wc.hideWC();

                switch (ret.errcode) {
                    case 4002:
                        gc.alert.showUI("加入游戏失败，服务器无法响应");
                        break;
                    case 6:
                        if (!gc.anysdk.isHasPermission(gc.enum.E_PERMISSION.GPS)) {
                            gc.alert.showUI("该房间需要gps定位信息\n当前没有开启gps定位功能\n禁止进入房间！", function () {
                                gc.anysdk.showPermissionSetting(gc.enum.E_PERMISSION.GPS);
                            });
                        }
                        else {
                            gc.alert.showUI("进入房间[" + roomId + "]失败！\nGPS数据错误.");
                        }
                        break;
                    case 7:
                        gc.alert.showUI("进入房间[" + roomId + "]失败！\n因为GPS限制.");
                        break;

                    // case 6503://加入比赛失败
                    //     // cc.director.loadScene("lobby_platform");
                    //     cc.director.loadScene("hall_" + gameType);
                    //     gc.alert.showUI("比赛已关闭");
                    //     // gc.emit("back_sub_halls");
                    //     // gc.alert.showUI("数据已清空！", function () {
                    //     //     gc.room.wantQuitRoom();
                    //     //     gc.room.wantMatchExitCly();
                    //     // });
                    //     break;
                }

                if (callback != null) {
                    callback(ret);
                }
            }
            else {
                if (callback != null) {
                    callback(ret);
                }
                console.log('连接服务器', ret.roomid);
                gc.switchMaster(ret.game_type, true);
                gc.gameNetMgr.connectGameServer(ret);
            }
        };

        var data = {
            account: gc.user.account,
            sign: gc.user.sign,
            roomid: roomId,
            gpsdata: gc.utils.getGPSData()
        };
        if (gameMode == "match") {
            // var enroll_data = Client.getEntityCards();
            // if(enroll_data&&enroll_data.mode == 2){
            //     data.enroll_data = JSON.stringify(enroll_data);
            // }
        };
        gc.wc.showWC("正在进入房间 " + roomId);
        console.log("enter_private_room", data);
        gc.http.sendRequest("/enter_private_room", data, onEnter.bind(self));
    },

    /** 退出房间 */
    exitRoom: function () {
        var self = gc.user;

        var exitFunc = function () {
            self.lastRoomId = null;
        }

        var data = {
            account: gc.user.account,
            sign: gc.user.sign,
            room_id: self.lastRoomId,
            game_type: self.oldGameType,
            game_mode: self.oldGameMode,
        };
        gc.http.sendRequest('/exit_room', data, exitFunc);
    },


    /**
     * 查询房间信息
     */
    queryRoomInfo: function (gameType, gameMode, roomId, callback) {
        //查询回调
        var onQuery = function (ret) {
            if (ret.errcode !== 0) {
                console.log('query room info error -> ' + ret.errmsg);
                //出现错误-1，则5s重试
                if (ret.errcode == -1) {
                    setTimeout(function () {
                        gc.http.sendRequest('/query_room_info', reqData, onQuery);
                    }, 5000);
                }
            } else {
                gc.wc.hideWC();
            }

            callback(ret);
        };

        var reqData = {
            account: gc.user.account,
            sign: gc.user.sign,
            room_id: roomId,
            game_type: gameType,
            game_mode: gameMode,
        };

        gc.wc.showWC('正在查询房间' + roomId + '的信息');
        gc.http.sendRequest('/query_room_info', reqData, onQuery);
    }
});
