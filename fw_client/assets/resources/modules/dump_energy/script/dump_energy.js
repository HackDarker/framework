var thisNode = null;

cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...

        img_xin_hao: { default: [], type: cc.SpriteFrame },
    },

    // use this for initialization
    onLoad: function () {
        thisNode = this.node;
    },

    // called every frame, uncomment this function to activate update callback
    update: function (dt) {
        var tBatteryPercent = gc.anysdk.getBatteryPercent() * 100;
        if (this.oldBatteryPercent !== tBatteryPercent) {
            // this.oldBatteryPercent == tBatteryPercent
            if(tBatteryPercent < 10){
                tBatteryPercent = tBatteryPercent.toFixed(1);
            }
            else{
                tBatteryPercent = Math.floor(tBatteryPercent);
            }
            gc.text.setTxtString(cc.find("img_energy/txt_energy_num", thisNode), (tBatteryPercent + "%"));                  //电池强度
        }

        var tSignalStrength = gc.net.getSignalStrength();
        if (this.oldStrength !== tSignalStrength) {
            // this.oldStrength == tSignalStrength
            gc.sprite.setNodeSprite(cc.find("img_xin_hao", thisNode), this.img_xin_hao[gc.net.getSignalStrength()]);        //信号强度 
        }

        // gc.anysdk.getNetworkType();             //网络类型


        var tNowTime = Date.now() / (1000 * 60);
        tNowTime = ~~tNowTime;
        if (tNowTime !== this.oldTime) {
            this.oldTime = tNowTime;
            var tDate = new Date();
            var tTxtTime = "";

            tTxtTime += ((tDate.getHours() < 10) ? "0" : "") + tDate.getHours();                                           //时
            tTxtTime += ":" + ((tDate.getMinutes() < 10) ? "0" : "") + tDate.getMinutes();                                 //分
            // tTxtTime += ":" + ((tDate.getSeconds() < 10) ? "0" : "") + tDate.getSeconds();                                 //秒

            tTxtTime = " <color=#00ff00>" + tTxtTime + "</c>";                                                              //颜色
            // tTxtTime = (tDate.getHours() >= 12 ? "PM" : "AM") + tTxtTime;                                                   //上午还是下午

            gc.text.setTxtString(cc.find("rtxt_time", thisNode), tTxtTime);
        }
    },
});
