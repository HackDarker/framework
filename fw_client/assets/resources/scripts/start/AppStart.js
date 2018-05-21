function urlParse() {
    var params = {};
    if (window.location == null) {
        return params;
    }
    var name, value;
    var str = window.location.href; //取得整个地址栏
    var num = str.indexOf("?")
    str = str.substr(num + 1); //取得所有参数   stringvar.substr(start [, length ]

    var arr = str.split("&"); //各个参数放到数组里
    for (var i = 0; i < arr.length; i++) {
        num = arr[i].indexOf("=");
        if (num > 0) {
            name = arr[i].substring(0, num);
            value = arr[i].substr(num + 1);
            params[name] = value;
        }
    }
    return params;
}

cc.Class({
    extends: cc.Component,

    onLoad:function(){
        gc.utils.setFitSreenMode();
        cc.director.setDisplayStats(false)//关闭调试界面
        
        gc.on('app_need_download',function(){
            console.log('need_download');
            //gc.ui.showUI("download_alert");
            gc.alert.showUI("客户端有新版本.\n请下载安装后再进游戏！",function(){
                cc.sys.openURL(gc.SI.appweb);
            });
        });

        gc.on('app_hot_update_ok',function(){
            // gc.switchMaster('preloading');
        });

        //SPLASH结束后，会分发此函数。
        gc.on('app_start',function(){
            //分析启动参数
            cc.args = urlParse();        
            gc.settings = require('AppSettings');

            var uisettings = require('UISettings');
            gc.ui.addUISettings(uisettings);
            
            //整个游戏大局开始
            gc.start();
    
            //30帧，据说可以省电
            cc.game.setFrameRate(30);
        });
    },

    start: function () {
        this.node.addComponent('Start');
    },
});