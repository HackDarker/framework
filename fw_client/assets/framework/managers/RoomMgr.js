cc.Class({
    extends: cc.Component,

    getNowNumOfGames: function () {
        if (gc.online) {
            return this.numOfGames;
        }
        else {
            return 3;
        }
    },

    getRoomID: function () {
        if (gc.online) {
            return this.roomId;
        }
        else {
            return "100100";
        }
    },

    getConf: function () {
        var tConf = null;
        if (gc.online) {
            return this.conf;
        }
        else {
            if (!this.testConf) {
                this.testConf = {
                    maxChair: this.maxChair ? this.maxChair : 2,
                    numOfGames: 10,
                    type: "thirteen",
                    isAA: false,
                    hasSpecial: true,
                    daQiangAdd1: true,
                    isZhuangJia: false,
                    duoYiSe: true,
                    ziDongBaiPai: false,
                    qiangZhiBiPai: false,
                };
            }
            tConf = this.testConf;
        }

        return tConf;
    },

    /**
     * 根据游戏类型 获取花费
     * @param  {Number} maxChair    最大人数
     * @param  {Number} turns       最大局数
     * @param  {Number} isAA        是否AA制
     * @param  {Number} gameType    游戏类型 （游戏编号）
     * @param  {Number} gameMode    游戏模式 （金币、钻石等）
     * @return {Number}             具体花费
     */
    calcCost: function (maxChair, turns, isAA, gameType, gameMode) {
        var config = this.costConfs;
        if(!config||config==undefined)
        {
            return 0;
        }
        for (var i = 0; i < config.length; i++) {
            var tConfig = config[i];
            if (!tConfig) {
                continue;
            }
            if ((tConfig.game_mode === gameMode) && (tConfig.game_type === gameType)) {
                config = tConfig.cost_conf;
                break;
            }
        }

        if (!config) {
            return 0;
        }

        var t = config[maxChair];
        if (!t) {
            return 0;
        }

        var total = t[turns];
        if (total > 0) {
            if (isAA) {
                return total / maxChair;
            }
            return total;
        }

        return 0;
    },

    // 设定每个座位的信息
    setSeatInfo: function (seatIdx, data) {
        var seat = {
            userId: data.userid,
            ip: data.ip,
            score: data.score,
            name: data.name,
            online: data.online,
            ready: data.ready,
            seatIndex: data.seatindex
        };
        this.getSeats()[seatIdx] = seat;
        return seat;
    },

    getSeats: function () {
        var tSeats
        if (gc.online) {
            tSeats = this.seats;
        }
        else {
            if (!this.testSeat) {
                var tMaxChairNum = this.getMaxPlayerNum();
                tSeats = [];
                for (var i = 0; i < tMaxChairNum; i++) {
                    tSeats.push({
                        ip: "192.168.0." + i,
                        name: "测试" + i,
                        online: true,
                        ready: false,
                        tuo_guan: false,
                        score: 0,
                        userId: "23333" + i,
                        seatIndex: i
                    });
                }
                this.testSeat = tSeats;
            }
            tSeats = this.testSeat;
        }

        for (var i = 0; i < tSeats.length; i++) {
            if (tSeats[i].userId == gc.user.userId) {
                this.seatIndex = i;
            }
        }

        if (this.seatIndex === -1) {
            this.seatIndex = 0;
        }

        return tSeats;
    },

    init: function () {
        this.reset();
        var agent = gc.createNetAgent('roommgr');
        gc.net.addAgent(agent,true);
        agent.addTarget(this);

        cc.game.on("scene_switched",function(){
            gc.on("room_dissolve_notice", this.showDissolveNotice.bind(this));

            gc.on('disconnect',function(){
                gc.room.dissoveData = null;
            });

            if (gc.room.dissoveData) {
                this.showDissolveNotice();
            }
        }.bind(this));
    },

    showDissolveNotice:function(){
        gc.ui.showUI("ui_dissolve_notice");
    },

    reset: function () {
        this.roomId = null;
        this.maxNumOfGames = 0;
        this.numOfGames = 0;
        this.seatIndex = -1;
        this.seats = null;
        this.testSeat = null;
        this.isOver = false;
        this.conf = null;
        this.dissoveData = null;
    },

    onLogin: function (data) {
        this.roomId = data.roomid;
        this.gameType = data.gametype;
        this.gameMode = data.gamemode;
        this.mj_yuyan =false;
        this.mj_holds_history=false;//麻将战绩手牌 开关
        console.log("roomid and game type mode", data);
        this.conf = data.conf;
        if (gc.curGameAda) {
            gc.curGameAda.initGame(this.conf);
        }
        this.maxNumOfGames = data.conf.maxGames;
        this.numOfGames = data.numofgames;
        this.seats = [];
        for (var i = 0; i < data.seats.length; ++i) {
            this.setSeatInfo(i, data.seats[i]);
            if (gc.user.userId == data.seats[i].userid) {
                this.seatIndex = i;
            }
        }
        this.isOver = false;
    },

    //自己是否为房主
    isOwner: function () {
        this.getSeats();
        return gc.user.userId == this.conf.creator;
    },

    //通过角色ID获取房间座位号码
    getSeatIndexByID: function (userId) {
        for (var i = 0; i < this.getSeats().length; ++i) {
            var s = this.getSeats()[i];
            if (s.userId == userId) {
                return i;
            }
        }
        return -1;
    },

    //通过角色ID获取座位信息
    getSeatByID: function (userId) {
        var tIdx = this.getSeatIndexByID(userId);
        var seat = this.getSeats()[tIdx];
        return seat;
    },

    // 通过服务器座位号索引获取seatInfo
    getSeatByIdx: function (idx) {
        return this.getSeats()[idx];
    },

    //通过服务器座位号索引获取本地座位号索引
    getLocalIndex: function (index) {
        this.getSeats();
        var tMaxChair = this.getMaxPlayerNum();

        var tLocalIndexList = this.getLocalIndexList();
        if (!tLocalIndexList) {
            var ret = (index - this.seatIndex + tMaxChair) % tMaxChair;
            return ret;
        }
        else {
            var tSelfIdx = -1;
            var tTargetIdx = -1;
            for (var i = 0; i < tLocalIndexList.length; i++) {
                if (tLocalIndexList[i] === this.seatIndex) {
                    tSelfIdx = i;
                }
                if (tLocalIndexList[i] === index) {
                    tTargetIdx = i;
                }
            }
            if (tSelfIdx === -1 || tTargetIdx === -1) {
                return -1;
            }
            else {
                return (tSelfIdx > tTargetIdx) ? (tMaxChair - (tSelfIdx - tTargetIdx)) : (tTargetIdx - tSelfIdx);
            }
        }
    },

    // 通过本地座位号索引获取seatInfo
    getSeatInfoByLocalIndex: function (localIdx) {
        var tMaxChair = this.getMaxPlayerNum();
        var tIdx = (localIdx + this.seatIndex) % tMaxChair;
        var tLocalIndexList = this.getLocalIndexList();
        var tSeatList;

        if (!tLocalIndexList) {
            tSeatList = this.getSeats();
            return tSeatList[tIdx];
        }
        else {
            for (var i = 0; i < tLocalIndexList.length; i++) {
                if (tIdx === tLocalIndexList[i]) {
                    break;
                }
            }

            if (i === tLocalIndexList.length) {
                return null;
            }
            else {
                tSeatList = this.getSeats();
                return tSeatList[tLocalIndexList[i]];
            }
        }

    },

    /** 是否人数不限 */
    setIsUnlimitedMaxChair: function (isUnlimited) {
        this.unlimitedMaxChair = isUnlimited;
    },

    /** 一圈座位的转法 [0,5,4,1,3,2] */
    setLocalIndexList: function (list) {
        this.localIndexList = list;
    },

    /** 一圈座位的转法 */
    getLocalIndexList: function () {
        return this.localIndexList;
    },

    // 获取最大玩家数量
    getMaxPlayerNum: function () {
        if(gc.room.conf.type == "niuniu_1"){
            return 8;
        }
        if (this.unlimitedMaxChair) {
            var tMaxChair = this.getSeats().length;
            for (tMaxChair; tMaxChair > 0; tMaxChair--) {
                if (this.getSeats()[tMaxChair - 1].userId) {
                    break;
                }
            }
            return tMaxChair;
        }

        if ("numPeople" in this.getConf()) {
            return this.getConf().numPeople;
        }
        return this.getConf().maxChair;
    },

    //获取自己的座位信息
    getSelfData: function () {
        return this.getSeats()[this.seatIndex];
    },

    //通过房间座位号码获取玩家名字
    getName: function (index) {
        return this.getSeats()[index].name;
    },

    //通过userID获取玩家名字
    getNameByUserID: function (userID) {
        var tRoomMgr = gc.room;
        var tSeatInfo = tRoomMgr.getSeatByID(userID);
        return tSeatInfo.name;
    },

    //通过userID获取玩家IP
    getIPByUserID: function (userID) {
        var ip;
        var tSeatInfo;
        var tRoomMgr = gc.room;
        if (userID === gc.user.userId) {
            ip = gc.user.ip;
        }
        else if (tSeatInfo = tRoomMgr.getSeatByID(userID)) {
            ip = tSeatInfo.ip;
        }

        if (!ip) {
            return "掉线";
        }

        if (ip.indexOf("::ffff:") != -1) {
            ip = ip.substr(7);
        }

        return ip;
    },

    clearReady: function () {
        for (var i = 0; i < this.getSeats().length; ++i) {
            this.getSeats()[i].ready = false;
        }
    },

    //data  数据结构 {account: ,sign: ,conf:JSON.stringify(房间配置)}
    createRoom: function (data, callback, gameType, gameMode) {
        if (!gameType || !gameMode) {
            console.log("param error!");
        }


        var tRoomCreateData = JSON.parse(data.conf);
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            // data.gpsdata = gc.utils.getGPSData();
            // if (tRoomCreateData.gpsstrict && !data.gpsdata) {
            //     if (!gc.anysdk.isHasPermission(gc.enum.E_PERMISSION.GPS)) {
            //         gc.alert.showUI("该房间需要gps定位信息\n当前没有开启gps定位功能\n禁止进入房间！", function () {
            //             gc.anysdk.showPermissionSetting(gc.enum.E_PERMISSION.GPS);
            //         });
            //     }
            //     else {
            //         gc.alert.showUI("该房间需要gps定位信息\n当前无法获取gps定位信息\n禁止进入房间！");
            //     }
            //     return;
            // }
        }

        data.gametype = gameType;
        data.gamemode = gameMode;
        gc.user.setNowGameMode(gameType, gameMode);
        if (gc.online) {
            gc.http.sendRequest("/create_private_room", data, callback);
        }
        else {
            this.testConf = JSON.parse(data.conf);
            gc.emit("enter_hall_game");
        }
    },

    //准备
    ownReady: function () {
        if (gc.online) {
            gc.net.send('ready');
        }
        else {                  //非联网状态直接设定所有人为准备状态
            var tSeats = this.getSeats();
            for (var i = 0; i < tSeats.length; i++) {
                tSeats[i].ready = true;
            }

            gc.emit("room_user_state_changed");
        }
    },

    sendRoomDispress: function () {
        if (gc.online) {
            gc.net.send("dispress");
        }
    },

    sendRoomExit: function () {
        if (gc.online) {
            gc.net.send("exit");
        }
    },

    sendRoomDissolveRequest: function () {
        if (gc.online) {
            gc.net.send("dissolve_request");
        }
    },

    wantQuitRoom: function () {
        var tRoomMgr = gc.room;
        if (!gc.online) {
            tRoomMgr.reset();
            gc.emit("back_sub_halls");
            return;
        }

        if (tRoomMgr.numOfGames != 0) {
            tRoomMgr.sendRoomDissolveRequest();
            return;
        }

        var isCreator = tRoomMgr.isOwner();
        if (isCreator) {
            tRoomMgr.sendRoomDispress();
        }
        else {
            tRoomMgr.sendRoomExit();
        }
    },

    //同意解散房间
    sendRoomDissolveAgree: function () {
        if (!gc.online) {
            gc.emit("back_sub_halls");
        }
        else {
            gc.net.send("dissolve_agree");
        }
    },

    // 拒绝解散房间
    sendRoomDissolveReject: function () {
        if (!gc.online) {
        }
        else {
            gc.net.send("dissolve_reject");
        }
    },

    //===========网络消息相关处理函数================
    onnet_dissolve_notice_push: function (data) {
        this.dissoveData = data;
        gc.emit("room_dissolve_notice", data);
    },

    onnet_dissolve_cancel_push: function (data) {
        this.dissoveData = null;
        gc.emit("room_dissolve_cancel", data);
    },

    onnet_exit_result: function (data) {
        this.isOver = true;
        this.reset();
    },

    onnet_dispress_push: function (data) {
        this.reset();
        this.isOver = true;
    },

    onnet_exit_notify_push: function (data) {
        var userId = data;
        var s = this.getSeatByID(userId);
        if (s != null) {
            s.userId = 0;
            s.name = "";
            gc.emit("room_user_state_changed", s);
        }
    },

    onnet_new_user_comes_push: function (data) {
        //GameLogic.updateData("new_user_comes_push", data);
        // console.log(data);
        var seatIndex = data.seatindex;
        var curSeat = this.getSeats()[seatIndex];
        if (curSeat.userId > 0) {
            curSeat.online = true;
        }
        else {
            data.online = true;
            curSeat = this.setSeatInfo(seatIndex, data);
        }
        console.log(curSeat.ip);
        gc.emit('room_new_user', curSeat);
    },

    //Gps获取位置事件监听 
    onnet_location_push: function (data) {
        if (data) {
            gc.emit("check_location", data);
        }
    },

    onnet_user_state_push: function (data) {
        //console.log(data);
        var userId = data.userid;
        var seat = this.getSeatByID(userId);
        seat.online = data.online;
        gc.emit('room_user_state_changed', seat);
    },

    onnet_room_user_ready_push: function (data) {
        //console.log(data);
        var userId = data.userid;
        var seat = this.getSeatByID(userId);
        seat.ready = data.ready;
        gc.emit('room_user_ready', seat);
        gc.emit("room_user_state_changed", seat);
    },

    onnet_game_num_push: function (data) {
        this.numOfGames = data;
        gc.emit('room_game_num', data);
    },

    onnet_room_close_push: function (data) {
        this.isOver = true;
        gc.room.dissoveData = data;
        gc.emit('room_close', data);
    },

    onnet_room_seats_changed_push: function (data) {
        var seats = this.getSeats();
        this.seats = [];
        for (var i = 0; i < data.length; ++i) {
            var userId = data[i];
            for (var k in seats) {
                var s = seats[k];
                if (s.userId == userId) {
                    this.seats[i] = s;
                    s.seatIndex = i;
                    break;
                }
            }
            if (userId == gc.user.userId) {
                this.seatIndex = i;
            }
        }
        gc.emit('room_user_state_changed', null);
    }
});
