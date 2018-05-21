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
    },

    // use this for initialization
    onLoad: function () {
        thisNode = this.node;

        var tBtnLayer = cc.find("ui/spr_pay_select/lay_pay_select", thisNode);
        gc.button.addBtnClickEvent(cc.find("btn_we_chat", tBtnLayer), this.node, this, "onPayBtnClick");
        gc.button.addBtnClickEvent(cc.find("btn_alipay", tBtnLayer), this.node, this, "onPayBtnClick");
        gc.button.addBtnClickEvent(cc.find("btn_close", thisNode), this.node, this, "onPayBtnClick");
    },

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },

    showData: function (shopItemData) {
        this.shopItemData = shopItemData;
        gc.text.setTxtString(cc.find("ui/spr_item_name/txt_item_name", thisNode), this.getItemData(shopItemData, "name"));
        gc.text.setTxtString(cc.find("ui/spr_item_price/txt_item_price", thisNode), (this.getItemData(shopItemData, "price") + this.getPriceType(shopItemData)));
    },

    onPayBtnClick: function (event) {
        gc.audio.playSFX("resources/common/sound", "button.mp3");
        
        gc.ui.hideUI(this);

        if (event.currentTarget.name === "btn_close") {
            return;
        }

        gc.ui.showUI("payment", function (script) {
            switch (event.currentTarget.name) {
                case "btn_we_chat":
                    script.pay(gc.enum.E_PAY_TYPE.WECHAT, this.shopItemData.item_id);
                    break;
                case "btn_alipay":
                    script.pay(gc.enum.E_PAY_TYPE.ALIPAY, this.shopItemData.item_id);
                    break;
            }
        }.bind(this));
    },

    getItemData: function (shopItemData, valueName) {
        if (!shopItemData) {
            return "";
        }
        return shopItemData[valueName];
    },

    getPriceType: function (shopItemData) {
        if (!shopItemData) { return "" };
        return (shopItemData.price_type === gc.enum.E_PRICE_TYPE.RMB) ? "元" : "";
    },
});
