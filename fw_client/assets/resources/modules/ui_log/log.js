
cc.Class({
    extends: cc.Component,

    properties: {

    },

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {},

    start() {
        this.logcontent = cc.find('log_list/view/content', this.node);
        this.move = cc.find('move', this.node);
        this.clearbtn = cc.find('clear', this.node);
        this.item = this.logcontent.getChildByName('item');
        gc.on('log', (data) => {
            this.init(data.detail);
        });
        gc.on('clear', () => {
            this.clear();
        });
        this.move.on(cc.Node.EventType.TOUCH_MOVE, this.onTouchMoved.bind(this))
        this.clearbtn.on(cc.Node.EventType.TOUCH_START, this.clear.bind(this))
        this.position = null;
        // cc.eventManager.addListener({
        //     event: cc.EventListener.TOUCH_ONE_BY_ONE,
        //     onTouchBegan: this.onTouchBegan.bind(this),
        //     onTouchMoved: this.onTouchMoved.bind(this),
        //     onTouchEnded: this.onTouchEnded.bind(this),
        // }, this.move);
    },

    init(data) {
        if (!data) { return; }
        for (let index = 0; index < data.length; index++) {
            const log = data[index];
            let node = cc.instantiate(this.item);
            let label = node.getComponent(cc.Label);
            label.string = log;

            node.parent = this.logcontent;
        }
    },

    clear: function (touch, event) {
        this.logcontent.removeAllChildren();
    },

    onTouchBegan: function (touch, event) {
        var touchLoc = touch.getLocation();

        return true;
    },
    onTouchMoved: function (touch, event) {
        var touchLoc = touch.getLocation();
        // gc.emit('log', [`position:${touchLoc.x}:${touchLoc.y}`])
        touchLoc = this.node.parent.convertToNodeSpaceAR(touchLoc);
        this.node.position = cc.v2(touchLoc.x, touchLoc.y + this.logcontent.parent.height / 2 + 20);
        return true;
    },
    onTouchEnded: function (touch, event) {
        var touchLoc = touch.getLocation();
        touchLoc = this.node.parent.convertToNodeSpaceAR(touchLoc);
        return true;
    },

    // update (dt) {},
});
