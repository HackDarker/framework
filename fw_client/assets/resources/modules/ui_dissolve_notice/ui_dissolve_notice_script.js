var thisNode = null;
function SeatViewClass(node){
    this._root = node;
    this._icon = node.getChildByName('icon');
    this._state = node.getChildByName('state').getComponent(cc.Label);
    this._id = node.getChildByName('id').getComponent(cc.Label);
    this._name = node.getChildByName('name').getComponent(cc.Label);
}

SeatViewClass.prototype.setInfo = function(userId){
    if(this._userId == userId){
        return;
    }
    this._userId = userId;
    gc.player.callPlayerInfo(userId,function(userid,info){
        this._name.string = gc.utils.shrinkName(info.name,8,'...');
        this._id.string = this._userId;
        gc.sprite.setPlayerHeadIcon(this._icon,this._userId);
    }.bind(this));
}

SeatViewClass.prototype.setState = function(agree){
    if(agree){
        this._state.string = '已同意';
    }
    else{
        this._state.string = '待确认';
    }
}

cc.Class({
    extends: cc.Component,

    properties: {
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
        thisNode = this.node;

        this._endTime = -1;

        cc.find("tip", thisNode).active = false;

        gc.button.addBtnClickEvent(cc.find("layer_btn_list/btn_agree", thisNode), thisNode, this, "onBtnClicked");
        gc.button.addBtnClickEvent(cc.find("layer_btn_list/btn_reject", thisNode), thisNode, this, "onBtnClicked");

        gc.on("room_dissolve_cancel", this.hideNotice.bind(this));
        gc.on('scene_switched', this.hideNotice.bind(this));
        gc.on('room_close', this.hideNotice.bind(this));

        this.seats = [];
        var seatsRoot = this.node.getChildByName('seats');
        for(var i = 0; i < 11; ++i){
            seatsRoot.addChild(cc.instantiate(seatsRoot.children[0]));
        }
        for(var i = 0; i < seatsRoot.children.length; ++i){
            var t = seatsRoot.children[i];
            this.seats[i] = new SeatViewClass(t);
        }
    },

    onEnable: function () {
        this.refNotice();
        gc.on("room_dissolve_notice", this.refNotice.bind(this));
    },

    onDisable: function () {
        gc.off("room_dissolve_notice", this.refNotice.bind(this));
    },

    onBtnClicked: function (event) {
        gc.audio.playSFX("resources/common/sound", "button.mp3");
        
        this.closeAll();
        var btnName = event.target.name;
        switch (btnName) {
            case "btn_agree":
                gc.room.sendRoomDissolveAgree();
                break;
            case "btn_reject":
                gc.room.sendRoomDissolveReject();
                break;
        }
    },

    closeAll: function () {
        this.hideNotice();
    },

    refNotice: function () {
        this.showDissolveNotice();
    },

    hideNotice: function () {
        gc.ui.hideUI(this);
    },

    showDissolveNotice: function () {
        if (!thisNode) {
            return;
        }

        var data = gc.room.dissoveData;
        if (!data) {
            return;
        }

        for(var i = 0; i < this.seats.length; ++i){
            this.seats[i]._root.active = false;
        }

        this._endTime = Date.now() / 1000 + data.time;
        var agrees = "";
        var disagrees = "";
        for (var i = 0; i < data.states.length; ++i) {
            var b = data.states[i];
            if (!gc.room.seats[i]) {
                break;
            }
            if(gc.room.seats[i].userId){
                this.seats[i]._root.active = true;
                this.seats[i].setInfo(gc.room.seats[i].userId);
                this.seats[i].setState(b);
            }
        }
        var hasAgree = data.states[gc.room.seatIndex];
        cc.find("layer_btn_list/btn_agree", thisNode).active = !hasAgree;
        cc.find("layer_btn_list/btn_reject", thisNode).active = !hasAgree;
        cc.find("tip", thisNode).active = hasAgree;
    },

    // called every frame, uncomment this function to activate update callback
    update: function (dt) {
        if (this._endTime > 0) {
            var lastTime = this._endTime - Date.now() / 1000;
            if (lastTime < 0) {
                lastTime = 0;
                this._endTime = -1;
            }

            var m = Math.floor(lastTime / 60);
            var s = Math.ceil(lastTime - m * 60);

            var str = "";
            if (m > 0) {
                str += m + "分";
            }

            gc.text.setTxtString(cc.find("info", thisNode), (str + s + "秒后房间将自动解散"));
        }

        if (!gc.room.dissoveData) {
            this.hideNotice();
        }
    },
});
