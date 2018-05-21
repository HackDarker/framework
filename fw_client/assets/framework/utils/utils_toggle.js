
function addClickEvent(node, target, component, handler) {
    component = gc.utils.getScriptComponentName(component);

    console.log(component + ":" + handler);
    var eventHandler = new cc.Component.EventHandler();
    eventHandler.target = target;
    eventHandler.component = component;
    eventHandler.handler = handler;

    var tToggle;
    // if (("__classname__" in node) && (node.__classname__ === "cc.Toggle")) {
    if (node instanceof cc.Toggle) {
        tToggle = node;
    }
    if (!tToggle) {
        tToggle = node.getComponent(cc.Toggle);
    }

    var clickEvents = tToggle.clickEvents;
    clickEvents.push(eventHandler);
}

function addToggleClickEvent(btn, target, component, handler) {
    var tToggle;
    // if (("__classname__" in btn) && (btn.__classname__ === "cc.Toggle")) {
    if (btn instanceof cc.Toggle) {
        tToggle = btn;
    }
    if (!tToggle) {
        tToggle = btn.getComponent(cc.Toggle);
    }
    if (tToggle) {
        addClickEvent(btn, target, component, handler);
        return;
    }

    var tToggleGroup
    // if (("__classname__" in btn) && (btn.__classname__ === "cc.ToggleGroup")) {
    if (btn instanceof cc.ToggleGroup) {
        tToggleGroup = btn;
    }
    if (!tToggleGroup) {
        tToggleGroup = btn.getComponent(cc.ToggleGroup);
    }

    if (tToggleGroup) {
        refToggleItemList(btn);
        var tToggleItems = tToggleGroup.ToggleItemList;
        for (var i = 0; i < tToggleItems.length; i++) {
            addClickEvent(tToggleItems[i], target, component, handler);
        }
        return;
    }
}

//刷新 toggleGroup中的ToggleItemList (已有的会保持位置不变,并且删除已经移除掉的)
function refToggleItemList(toggleGroupNode) {
    if (!toggleGroupNode) {
        return [];
    }

    var tToggleGroup = toggleGroupNode.getComponent(cc.ToggleGroup);
    if (!tToggleGroup) {
        return [];
    }

    var tToggleItems = tToggleGroup.ToggleItemList || [];
    var tTempItems = [].concat(tToggleItems);
    var tToggleBtn;
    var i = 0;
    for (i = 0; i < toggleGroupNode.children.length; i++) {
        tToggleBtn = toggleGroupNode.children[i];
        if (!tToggleBtn) {
            continue;
        }
        if (!tToggleBtn.getComponent(cc.Toggle)) {
            continue;
        }

        var tIdx = tToggleItems.indexOf(tToggleBtn);
        if (tIdx === -1) {
            tToggleItems.push(tToggleBtn);
        }
        else {
            tTempItems[tIdx] = null;
        }
    }

    var tLen = 0;
    for (i = 0; i < tTempItems.length; i++) {
        if (tTempItems[i] !== null) {
            tToggleItems[i] = null;
        }
    }
    for (i = 0; i < tToggleItems.length; i++) {
        if (tToggleItems[i] !== null) {
            tToggleItems[tLen] = tToggleItems[i];
            tLen++;
        }
    }
    tToggleItems.length = tLen;

    tToggleGroup.ToggleItemList = tToggleItems;
    return tToggleItems;
}

function getToggleGroupItemList(toggleGroupNode) {
    if (!toggleGroupNode) {
        return null;
    }
    var tToggleGroup = toggleGroupNode.getComponent(cc.ToggleGroup);
    if (!tToggleGroup) {
        return null;
    }
    var tToggleItemList = tToggleGroup.ToggleItemList;
    if (!tToggleItemList) {
        tToggleItemList = refToggleItemList(toggleGroupNode);
    }
    return tToggleItemList;
}

//  child   如果为null 则查找当前选中的，否则查找child
function getToggleGroupIdx(toggleGroupNode, child) {
    var i;
    if (!toggleGroupNode) {
        return -1;
    }

    var tToggleItemList = getToggleGroupItemList(toggleGroupNode);

    if (!tToggleItemList || tToggleItemList.length === 0) {
        return -1;
    }

    if (child) {
        return tToggleItemList.indexOf(child);
    }

    var tLen = tToggleItemList.length;
    var tToggle;
    for (i = 0; i < tLen; i++) {
        if (getIsCheckedToggle(tToggleItemList[i])) {
            return i;
        }
    }
    return -1;
}

function getToggleGroupSelection(toggleGroupNode) {
    var i;
    if (!toggleGroupNode) {
        return null;
    }

    var tToggleItemList = getToggleGroupItemList(toggleGroupNode);

    if (!tToggleItemList || tToggleItemList.length === 0) {
        return null;
    }

    var tLen = tToggleItemList.length;
    var tToggle;
    for (i = 0; i < tLen; i++) {
        if (getIsCheckedToggle(tToggleItemList[i])) {
            return tToggleItemList[i];
        }
    }
    return null;
}

function setToggleGroupSelection(toggleGroupNode, idx) {
    if (!toggleGroupNode || !toggleGroupNode.getComponent(cc.ToggleGroup)) {
        return;
    }

    var tToggleItemList = getToggleGroupItemList(toggleGroupNode);
    if (!tToggleItemList) {
        return;
    }
    var tMax = toggleGroupNode.children.length;
    var tLen = tToggleItemList.length;
    var tChildNode;
    var tToggle;
    for (var i = 0; i < tLen; i++) {
        tChildNode = tToggleItemList[i];
        tToggle = tChildNode.getComponent(cc.Toggle);
        tToggle.isChecked = ((i === idx) || (tChildNode === idx));
        if (tChildNode === idx) {
            tChildNode.setSiblingIndex(tMax);
        }
    }
}

function getIsCheckedToggle(btnNode) {
    if (!btnNode) {
        return;
    }

    var tToggle;
    // if (("__classname__" in btnNode) && (btnNode.__classname__ === "cc.Toggle")) {
    if (btnNode instanceof cc.Toggle) {
        tToggle = btnNode;
    }
    if (!tToggle) {
        tToggle = btnNode.getComponent(cc.Toggle);
    }
    if (!tToggle) {
        return;
    }
    return tToggle.isChecked;
}

function setIsCheckedToggle(btnNode, isSelect) {
    if (!btnNode) {
        return;
    }

    var tToggle;
    // if (("__classname__" in btnNode) && (btnNode.__classname__ === "cc.Toggle")) {
    if (btnNode instanceof cc.Toggle) {
        tToggle = btnNode;
    }
    if (!tToggle) {
        tToggle = btnNode.getComponent(cc.Toggle);
    }
    if (!tToggle) {
        return;
    }
    tToggle.isChecked = isSelect;
}

// 给Toggle或者ToggleGroup每个子Toggle 添加事件
//  btn             添加事件的对象
//  target          会从target节点上查找component
//  component
//  handler
exports.addToggleClickEvent = addToggleClickEvent;
// 获取ToggleGroup节点当前的索引
//  toggleGroupNode
//  child           如果为空返回当前的索引，如果不为空返回child对应的索引
exports.getToggleGroupIdx = getToggleGroupIdx;
// 设定ToggleGroup节点当前选中哪个
//  toggleGroupNode     
//  idx             当前选中哪个，可以是 toggle节点 或 索引
exports.setToggleGroupSelection = setToggleGroupSelection;
// 获取是否选中
//  btnNode
exports.getIsCheckedToggle = getIsCheckedToggle;
// 设定是否选中
//  btnNode
//  isSelect
exports.setIsCheckedToggle = setIsCheckedToggle;