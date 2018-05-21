
function addSliderEvent(node, target, component, handler) {
    component = gc.utils.getScriptComponentName(component);

    console.log(component + ":" + handler);
    var eventHandler = new cc.Component.EventHandler();
    eventHandler.target = target;
    eventHandler.component = component;
    eventHandler.handler = handler;

    var slideEvents = node.getComponent(cc.Slider).slideEvents;
    slideEvents.push(eventHandler);
}

function getSliderValue(node) {
    if (!node) {
        return 0;
    }

    var tSlider;

    // if (("__classname__" in node) && (node.__classname__ === "cc.Slider")) {
    if (node instanceof cc.Slider) {
        tSlider = node;
    }
    if (!tSlider) {
        tSlider = node.getComponent(cc.Slider);
    }
    if (!tSlider) {
        return 0;
    }
    return tSlider.progress;
}

function setSliderValue(node, value) {
    if (!node) {
        return 0;
    }

    var tSlider;


    // if (("__classname__" in node) && (node.__classname__ === "cc.Slider")) {
    if (node instanceof cc.Slider) {
        tSlider = node;
    }

    if (!tSlider) {
        tSlider = node.getComponent(cc.Slider);
    }

    if (!tSlider) {
        return;
    }

    tSlider.progress = value;
}

//  为slider节点添加事件
//  btn             添加事件的对象
//  target          会从target节点上查找component
//  component
//  handler
exports.addSliderEvent = addSliderEvent;
//  设定slider的当前值
//  node
//  value
exports.setSliderValue = setSliderValue;
//  获取slider的当前值
exports.getSliderValue = getSliderValue;
