
cc.Class({
    extends: cc.Component,

    properties: {
        canvas: cc.Node,
        target: cc.Node,
        touchTarget: null,//双击缩放
    },

    onLoad: function () {
        var self = this, parent = this.node;
        self.canvas.on(cc.Node.EventType.TOUCH_START, function (event) {
            var touches = event.getTouches();
            if (touches.length = 1) {
                if (self.touchTarget) {//双击缩放
                    self.target.scale = self.target.scale == 1 ? 1.5 : 1
                    self.touchTarget = false;
                } else {
                    self.touchTarget = true;
                    let timer = setTimeout(() => {
                        self.touchTarget = false;
                        clearTimeout(timer);
                    }, 300);
                }
            }
        }, self.node);
        self.canvas.on(cc.Node.EventType.TOUCH_MOVE, function (event) {
            var touches = event.getTouches();
            if (touches.length >= 2 && this.canScale) {//多点缩放
                var touch1 = touches[0], touch2 = touches[1];
                var delta1 = touch1.getDelta(), delta2 = touch2.getDelta();
                var touchPoint1 = parent.convertToNodeSpaceAR(touch1.getLocation());
                var touchPoint2 = parent.convertToNodeSpaceAR(touch2.getLocation());
                //缩放
                var distance = cc.pSub(touchPoint1, touchPoint2);
                var delta = cc.pSub(delta1, delta2);
                var scale = 1;
                if (Math.abs(distance.x) > Math.abs(distance.y)) {
                    scale = (distance.x + delta.x) / distance.x * self.target.scale;
                }
                else {
                    scale = (distance.y + delta.y) / distance.y * self.target.scale;
                }
                self.target.scale = scale < 0.1 ? 0.1 : scale;
            }
            else if (touches.length == 1) {//移动
                var touch1 = touches[0];
                self.target.position = cc.v2(self.target.position.x + touch1.getDelta().x, self.target.position.y + touch1.getDelta().y)
            }
            this.canScale = true;//控制双指第一次触碰时不执行缩放
        }, self.node);
        self.canvas.on(cc.Node.EventType.TOUCH_END, function (event) {
            this.canScale = false;
        }, self.node);
    }
});
