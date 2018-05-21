cc.Class({
    extends: cc.Component,

    properties: {
        viewGroupNode:cc.Node,
        pressTexture: {
        default: [],
        type: [cc.SpriteFrame],
        },
        
    },

    // use this for initialization
    onLoad: function () {
        gc.toggle.addToggleClickEvent(this.node, this.node, this, "onClick");
        this.layer = cc.find("popupWindow/list/layer", this.node);
        gc.button.addBtnClickEvent(this.layer, this.node, this, "onClose");
        this.layer.getComponent(cc.Widget).target = cc.find("Canvas");
        this.popupWindow = cc.find("popupWindow",this.node);
        this.list = cc.find("popupWindow/list",this.node);
        this.nodes = this.viewGroupNode;
        for (var p in this.nodes.children) {
            var Node = this.nodes.children[p];
            gc.toggle.addToggleClickEvent(Node, this.node, this, "toggleClick");
        }
    },
    
    onClick: function (){
        this.scheduleOnce(function(){
            this.list.active = gc.toggle.getIsCheckedToggle(this.node);
        },1/60);
    },
    
    onClose: function () {
        this.node.getComponent(cc.Toggle).isChecked = false;
        this.list.active = false;
    },
    
    toggleClick: function (){
        this.scheduleOnce(function(){
            var k = 0;
            var group = gc.toggle.getToggleGroupIdx(this.nodes);
            if(group!= -1){
                k = group;
            }
            else {
                for (var p in this.nodes.children) {
                    var Node = this.nodes.children[p];
                    if(!gc.toggle.getIsCheckedToggle(Node)){
                        k = 1;
                    }
                }
            }
            this.popupWindow.getComponent(cc.Sprite).spriteFrame = this.pressTexture[k];
        },1/60);
    },
});
