

function setTxtString(txtNode, string) {
    if (!txtNode) {
        return;
    }
    if (string === 0 || string === "0") {
        string = string;
    }
    else {
        string = string || "";
    }
    string = string + "";
    var tTxt;

    // if (("__classname__" in txtNode) && (txtNode.__classname__ === "cc.Label")) {
    if (txtNode instanceof cc.Label) {
        tTxt = txtNode;
    }
    // if (("__classname__" in txtNode) && (txtNode.__classname__ === "cc.RichText")) {
    if (txtNode instanceof cc.RichText) {
        tTxt = txtNode;
    }
    // if (("__classname__" in txtNode) && (txtNode.__classname__ === "cc.EditBox")) {
    if (txtNode instanceof cc.EditBox) {
        tTxt = txtNode;
    }

    if (!tTxt) {
        tTxt = txtNode.getComponent(cc.Label);
    }
    if (!tTxt) {
        tTxt = txtNode.getComponent(cc.RichText);
    }
    if (!tTxt) {
        tTxt = txtNode.getComponent(cc.EditBox);
    }

    if (!tTxt) {
        return;
    }
    tTxt.string = string;
}

function getTxtString(txtNode) {
    if (!txtNode) {
        return;
    }
    var tTxt;

    // if (("__classname__" in txtNode) && (txtNode.__classname__ === "cc.Label")) {
    if (txtNode instanceof cc.Label) {
        tTxt = txtNode;
    }
    // if (("__classname__" in txtNode) && (txtNode.__classname__ === "cc.RichText")) {
    if (txtNode instanceof cc.RichText) {
        tTxt = txtNode;
    }
    // if (("__classname__" in txtNode) && (txtNode.__classname__ === "cc.EditBox")) {
    if (txtNode instanceof cc.EditBox) {
        tTxt = txtNode;
    }

    if (!tTxt) {
        tTxt = txtNode.getComponent(cc.Label);
    }
    if (!tTxt) {
        tTxt = txtNode.getComponent(cc.RichText);
    }
    if (!tTxt) {
        tTxt = txtNode.getComponent(cc.EditBox);
    }
    if (!tTxt) {
        return null;
    }
    return tTxt.string;
}

// 设定文本内容
//  txtNode
//  string
exports.setTxtString = setTxtString;
// 获取文本内容
//  txtNode
exports.getTxtString = getTxtString;