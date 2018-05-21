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
    },

    // use this for initialization
    onLoad: function () {
        var payroot = this.node;
        payroot.active = true;
        payroot.y = 100000;

        var payweb = payroot.getChildByName('content');

        var bb = payroot.getChildByName('btn_close');
        gc.button.addBtnClickEvent(bb, this.node, this, "onPayCloseClicked");

        payweb.on('loaded', function () {
            setTimeout(function () {
                if (payroot.needShow == false) {
                    return;
                }
                payroot.y = 0;
                gc.wc.hideWC();
            }, 2000);
        });
    },

    //methodId支付方式，goodsId商品ID
    pay: function (methodId, goodsId) {
        var onGet = function (ret) {
            if (ret.url) {
                var payroot = this.node;
                var payweb = payroot.getChildByName('content');
                payroot.needShow = true;
                var webview = payweb.getComponent(cc.WebView);
                webview.url = ret.url;

                payroot.getChildByName('item').getComponent(cc.Label).string = ret.item;
                payroot.getChildByName('price').getComponent(cc.Label).string = ret.price;
                payroot.orderid = ret.orderid;
                //cc.sys.openURL(ret.url);
            }
            else {
                gc.wc.hideWC();
            }
        }.bind(this);

        gc.wc.showWC('正在请求支付...');
        gc.http.sendRequest("/get_pay_url", { pay_type: methodId, item_id: goodsId, token: gc.http.token }, onGet, null, true);
    },

    onPayCloseClicked: function () {
        gc.audio.playSFX("resources/common/sound", "button.mp3");
        
        var payroot = this.node;
        payroot.y = 10000;
        payroot.needShow = false;

        var onGet = function (ret) {
            gc.wc.hideWC();
            if (ret.errcode == 0) {
                gc.alert.showUI('支付成功');
                //刷新相关数据。
                gc.emit('coins_and_gems_changed');
            }
            else {
                gc.alert.showUI('支付取消');
            }
        }.bind(this);

        gc.wc.showWC('验证支付状态...');
        gc.http.sendRequest("/get_pay_state", { orderid: payroot.orderid }, onGet, null, true);
    },

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});
