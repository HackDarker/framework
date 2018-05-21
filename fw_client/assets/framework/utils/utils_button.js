
function addClickEvent(node, target, component, handler) {
    component = gc.utils.getScriptComponentName(component);

    console.log(component + ":" + handler);
    var eventHandler = new cc.Component.EventHandler();
    eventHandler.target = target;
    eventHandler.component = component;
    eventHandler.handler = handler;

    var tBtn;
    // if (("__classname__" in node) && (node.__classname__ === "cc.Button")) {
    if (!node) {
        try {
            node.getComponent(cc.Button);
        } catch (error) {
            console.error(error);
        }
        return;
    }
    if (node instanceof cc.Button) {
        tBtn = node;
    }
    if (!tBtn) {
        tBtn = node.getComponent(cc.Button);
    }

    var clickEvents = tBtn.clickEvents;
    clickEvents.push(eventHandler);
}

function addBtnClickEvent(btn, target, component, handler) {
    if (typeof (btn) == "string") {
        btn = cc.find(btn)
    }
    if (typeof (target) == "string") {
        target = cc.find(target)
    }
    if (!btn) {
        console.error("error." + btn + " is not exist.");
    }
    if (!target) {
        console.error("error." + target + " is not exist.");
    }

    addClickEvent(btn, target, component,handler);
}

function setBtnInteractable(btn, state) {
    if (!btn) {
        return false;
    }

    var tBtn;
    // if (("__classname__" in node) && (node.__classname__ === "cc.Button")) {
    if (btn instanceof cc.Button) {
        tBtn = btn;
    }
    if (!tBtn) {
        tBtn = btn.getComponent(cc.Button);
    }
    if (!tBtn) {
        return false;
    }
    tBtn.interactable = state;
    return true;
}

function addTouchEnd(node, func) {
    node.on(cc.Node.EventType.TOUCH_END, function (event) {
        event.stopPropagation();
        func(event.currentTarget);
    });
}

//  为button节点添加事件
//  btn             添加事件的对象
//  target          会从target节点上查找component
//  component
//  handler
exports.addClickEvent = addClickEvent;
//  为button节点添加事件
//  btn             添加事件的对象
//  target          会从target节点上查找component
//  component
//  handler
exports.addBtnClickEvent = addBtnClickEvent;
//设定按钮是否可点击
//  btn
//  state
exports.setBtnInteractable = setBtnInteractable;
/** 添加touch end的回调 */
exports.addTouchEnd = addTouchEnd;