
cc.Class({
    extends: cc.Component,

    properties: {
        director: cc.Node,
        arrow: cc.Node,
        follower: cc.Node,
        followSpeed: 200
    },

    onLoad: function () {
        var self = this;
        self.moveToPos = cc.p(0, 0);
        self.delta = cc.p(0, 0);
        self.isMoving = false;
        self.points = [];

        self.ctx = new _ccsg.GraphicsNode();
        self.director._sgNode.addChild(self.ctx);

        var directorPosInWorld = self.director.parent.convertToWorldSpaceAR(self.director.position);
        self.director.on(cc.Node.EventType.TOUCH_START, function (event) {
            var touches = event.getTouches();
            var touchLoc = touches[0].getLocation();
            console.log('-------------------start------------------');
            self.ctx.clear();

            self.ctx = new _ccsg.GraphicsNode();
            self.director._sgNode.addChild(self.ctx);
            console.log('self.director.position', self.director.position);
            self.ctx.moveTo(self.director.position);
            self.ctx.lineTo(cc.pSub(touchLoc, directorPosInWorld));
            self.ctx.lineWidth = 2;
            self.ctx.strokeColor = cc.hexToColor('#FF0000');
            self.ctx.stroke();

            self.points[0] = cc.pSub(touchLoc, directorPosInWorld)

            // self.isMoving = true;
            // self.moveToPos = self.follower.parent.convertToNodeSpaceAR(touchLoc);
            // self.touchLocationDisplay.textKey = i18n.t("cases/03_gameplay/01_player_control/On/OnTouchCtrl.js.1") + Math.floor(touchLoc.x) + ', ' + Math.floor(touchLoc.y) + ')';
        }, self.node);
        self.director.on(cc.Node.EventType.TOUCH_MOVE, function (event) {
            self.isMoving = true;
            console.log('-----------TOUCH_MOVE-------');
            var touches = event.getTouches();
            var touchLoc = touches[0].getLocation();

            // self.moveToPos = cc.pAdd(self.follower.position, event.getDelta())
            self.moveToPos = self.follower.parent.convertToNodeSpaceAR(touchLoc);

            // self.director.rotation = event.get
            // self.touchLocationDisplay.textKey = i18n.t("cases/03_gameplay/01_player_control/On/OnTouchCtrl.js.1") + Math.floor(touchLoc.x) + ', ' + Math.floor(touchLoc.y) + ')';
            self.ctx.clear();
            self.ctx = new _ccsg.GraphicsNode();
            self.director._sgNode.addChild(self.ctx);
            self.ctx.moveTo(self.director.position);
            self.ctx.lineTo(cc.pSub(touchLoc, directorPosInWorld));
            self.ctx.lineWidth = 2;
            self.ctx.strokeColor = cc.hexToColor('#FF0000');
            self.ctx.stroke();


            self.points[1] = cc.pSub(touchLoc, directorPosInWorld)
            let point0_m = Math.sqrt(Math.pow(self.points[0].x, 2) + Math.pow(self.points[0].y, 2))
            let point1_m = Math.sqrt(Math.pow(self.points[1].x, 2) + Math.pow(self.points[1].y, 2))
            let axb = self.points[0].x * self.points[1].x + self.points[0].y * self.points[1].y
            console.log('self.points[0]', self.points[0]);
            console.log('self.points[1]', self.points[1]);
            console.log('point0_m', point0_m);
            console.log('point1_m', point1_m);
            console.log('乘', point0_m * point1_m);
            console.log('axb', axb);
            console.log('商', axb / (point0_m * point1_m));
            let temp = axb / (point0_m * point1_m);
            let result = self.getxiangxian(self.points[1]) * Math.acos(temp > 1 ? 1 : temp);

            console.log('弧度：', result);
            console.log('角度：', result * 180 / Math.PI);

            self.arrow.rotation = 360 + result * 180 / Math.PI
            self.follower.rotation = 360 + result * 180 / Math.PI

            self.delta = event.getDelta();
            console.log('self.delta',self.delta);

        }, self.node);
        self.director.on(cc.Node.EventType.TOUCH_END, function (event) {
            self.isMoving = false; // when touch ended, stop moving
        }, self.node);
        self.director.on(cc.Node.EventType.TOUCH_CANCEL, function (event) {
            self.isMoving = false; // when touch ended, stop moving
        }, self.node);
    },

    getxiangxian: function (position) {
        if (position.x > 0 && position.y > 0) {
            return -1//1象限
        }
        else if (position.x < 0 && position.y > 0) {
            return -1//2象限
        }
        else if (position.x < 0 && position.y < 0) {
            return 1//3象限
        }
        else if (position.x > 0 && position.y < 0) {
            return 1//4象限
        }
    },

    // called every frame
    update: function (dt) {
        if (!this.isMoving) return;
        var oldPos = this.follower.position;
        // get move direction
        var direction = cc.pNormalize(cc.pSub(cc.pAdd(oldPos, this.delta), oldPos));//this.director.position
        console.log('---------------------------');
        console.log('this.moveToPos', this.moveToPos);
        console.log('this.director.position', this.director.position);
        console.log('direction', direction);
        // multiply direction with distance to get new position
        var newPos = cc.pAdd(oldPos, cc.pMult(direction, this.followSpeed * dt));
        console.log('newPos', newPos);
        // set new position
        this.follower.setPosition(newPos);
    }
});
