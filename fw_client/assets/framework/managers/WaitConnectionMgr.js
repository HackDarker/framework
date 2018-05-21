module.exports = ModuleClass;
function ModuleClass(){
    this.tempText = "";
    this.isNeedShow = false;
}

// use this for initialization
ModuleClass.prototype.init = function () {
}

ModuleClass.prototype.showWC = function (text, parent) {
    console.log(text);
    this.tempText = text;
    this.isNeedShow = true;
    parent = parent || gc.utils.getStaticNode("StaticNode");
    gc.ui.showUI("wc",[gc.utils.struct_Callback(this.onWCShow, null, this)], parent);
}

ModuleClass.prototype.onWCShow = function (script) {
    if (!this.isNeedShow) {
        this.hideWC();
        return;
    }

    if (this.tempText === "old_desc") {
        return;
    }

    gc.text.setTxtString(cc.find("tip", script.node), this.tempText);
},

ModuleClass.prototype.hideWC = function () {
    this.isNeedShow = false;
    if (gc.ui) {
        gc.ui.hideUI("wc");
    }
    this.tempText = "";
}