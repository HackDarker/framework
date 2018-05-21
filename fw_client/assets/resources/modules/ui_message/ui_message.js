cc.Class({
    extends: cc.Component,

    properties: {

    },

    // use this for initialization
    onLoad: function () {
        var tmsg = gc.hall.getMsgInfoByType("msg_" + gc.user.oldGameType);
        gc.text.setTxtString(cc.find("scrollview/view/content/message", this.node), tmsg);
        gc.button.addBtnClickEvent(this.node.getChildByName("btn_back"), this.node, this, "onClickedClose");
    },

    onEnable: function () {
        var tmsg = gc.hall.getMsgInfoByType("msg_" + gc.user.oldGameType);
        gc.text.setTxtString(cc.find("scrollview/view/content/message", this.node), tmsg);
    },
    
    onClickedClose: function(){
          gc.ui.hideUI(this);
    },
});
