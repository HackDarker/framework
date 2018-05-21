cc.Class({
    extends: cc.Component,

    properties: {
        nums:{
            default:[],
            type:[cc.Label]
        },
        _inputIndex:0,
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
    },

    // use this for initialization
    onLoad: function () {
        this.nums = [];
        for (var i = 0; i < 6;i++) {
           var temp =  this.node.getChildByName("input_number").getChildByName("N"+i);
           var temps = temp.getComponent(cc.Label);
           temps.string = '';
           this.nums.push(temps);
        }
        var panel = this.node.getChildByName("inputs");
        for (var i = 0; i < panel.children.length; i++){
            gc.button.addBtnClickEvent(panel.children[i], this.node, this, "onClicked");
        }
        gc.button.addBtnClickEvent(cc.find("thirteen_btn_close", this.node), this.node, this, "onCloseClicked");
    },
    
    onEnable:function(){
        this.onResetClicked();
    },
    
    onInputFinished:function(roomId){
        var onEnterRoom = function (ret) {
            gc.wc.hideWC();
            if (ret.errcode == 0) {
                this.node.active = false;
            }
            else {
               var content = "";
                if (ret.errcode == 1){
                    content = "参数错误!";
                }else if (ret.errcode == 2){ 
                    content = "内部网络错误!";
                }else if (ret.errcode == 4000){ 
                    content = "token超时";
                }else if (ret.errcode == 4001){ 
                    content = "已经在房间中";
                }
                else if (ret.errcode == 4002){ 
                    content = "分配游戏服务器失败";
                }else if (ret.errcode == 4003){ 
                    content = "获取房卡信息失败";
                }else if (ret.errcode == 4004){ 
                    content = "获取游戏服务器地址失败";
                }else if (ret.errcode == 4005){ 
                    content = "取消消息失败";
                }else if (ret.errcode == 6000){ 
                    content = "sign验证失败";
                }else if (ret.errcode == 6002) {
                    content = "不支持的游戏类型!";
                }
                 else if (ret.errcode == 6003) {
                    content = "创建房间失败!";
                }
                 else if (ret.errcode == 6004) {
                    content = "房卡不足，加入房间失败!";
                }
                 else if (ret.errcode == 6005) {
                    content = "金币不足";
                } else if (ret.errcode == 6006) {
                    content = "房间[" + roomId + "]已满!";
                }
                 else if (ret.errcode == 6007) {
                    content = '房间[' + roomId + ']不存在，\n请重新输入!';
                } else if (ret.errcode == 6008) {
                    content = '获取房间数据失败!';
                } 
                else if (ret.errcode == 6009) {
                    content = '获取游戏配置文件失败!';
                }
                else if (ret.errcode == 6010) {
                    content = '游戏类型或者模式不匹配!';
                }
                else if (ret.errcode == 6011) {
                    content = "IP地址冲突\n加入房间失败!";
                } else if (ret.errcode == 6012) {
                    content = "因近距离GPS限制\n加入房间失败!";
                } else if (ret.errcode == 6013) {
                    // if (!gc.anysdk.isHasPermission(gc.enum.E_PERMISSION.GPS)) {
                    //     gc.alert.showUI("该房间需要gps定位信息\n当前没有开启gps定位功能\n禁止进入房间！", function () {
                    //         gc.anysdk.showPermissionSetting(gc.enum.E_PERMISSION.GPS);
                    //     });
                    //     return;
                    // }
                    // else {
                         content = "GPS数据错误\n加入房间失败!";
                    //}
                }else {
                    content = ret.errcode;
                }
                gc.alert.showUI(content);
                this.onResetClicked();
            }
        }.bind(this); 

        var gameType = gc.user.oldGameType;
        var gameMode = gc.user.oldGameMode;

        gc.user.queryRoomInfo(gameType, gameMode, roomId, function (ret) {
            if (ret.errcode !== 0) {
                if (ret.errcode == 6007) {
                    gc.wc.hideWC();
                    gc.alert.showUI('房间' + roomId + '不存在');
                }
            } else {
                //判断是否AA，是则弹出提示，否则直接请求进入房间
                if (ret.aa === true) {
                    gc.alert.showUI('房间' + roomId + '是AA制房间\n进入将消耗' + ret.cost + '房卡\n是否确定进入?', function (isOK) {
                        if (isOK) {
                            gc.user.enterRoom(roomId, onEnterRoom, gameType, gameMode);
                        }
                    }).setNO(true);
                } else {
                    gc.user.enterRoom(roomId, onEnterRoom, gameType, gameMode);
                }
            }
        });
    },
    
    onInput:function(num){
        if (this._inputIndex < this.nums.length) {
            this.nums[this._inputIndex].string = num;
            this._inputIndex += 1;
        }
        
        if (this._inputIndex == this.nums.length){
            var roomId = this.parseRoomID();
            console.log("ok:" + roomId);
            this.onInputFinished(roomId);
        } 
    },
    onClicked:function (event) {
        gc.audio.playSFX("resources/common/sound", "button.mp3");

        var name = event.target.name;
        var name = event.target.name;
        var newname = name.substr(9);
        cc.info(newname);
         if (newname>= 0 &&newname< 10 ) {
            this.onInput(newname);  
         }
         else if(newname == "del"){
            if(this._inputIndex > 0){
                this._inputIndex -= 1;
                this.nums[this._inputIndex].string = "";
            }
         }
         else if (newname == "erase") {
            for(var i = 0; i < this.nums.length; ++i){
                this.nums[i].string = "";
            }
            this._inputIndex = 0;
         }
    },
    onN0Clicked:function(event){
        
        
        // if () {

        // }
        // else if(){

        // }
        this.onInput(0);  
    },
    onN1Clicked:function(){
        this.onInput(1);  
    },
    onN2Clicked:function(){
        this.onInput(2);
    },
    onN3Clicked:function(){
        this.onInput(3);
    },
    onN4Clicked:function(){
        this.onInput(4);
    },
    onN5Clicked:function(){
        this.onInput(5);
    },
    onN6Clicked:function(){
        this.onInput(6);
    },
    onN7Clicked:function(){
        this.onInput(7);
    },
    onN8Clicked:function(){
        this.onInput(8);
    },
    onN9Clicked:function(){
        this.onInput(9);
    },
    onResetClicked:function(){
        for(var i = 0; i < this.nums.length; ++i){
            this.nums[i].string = "";
        }
        this._inputIndex = 0;
    },
    onDelClicked:function(){
        if(this._inputIndex > 0){
            this._inputIndex -= 1;
            this.nums[this._inputIndex].string = "";
        }
    },
    onCloseClicked:function(){
        gc.audio.playSFX("resources/common/sound", "button.mp3");
        //this.node.active = false;
        gc.ui.hideUI(this);
    // this.node.parent.removeChild(this.node);
    },
    
    parseRoomID:function(){
        var str = "";
        for(var i = 0; i < this.nums.length; ++i){
            str += this.nums[i].string;
        }
        return str;
    }

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});
