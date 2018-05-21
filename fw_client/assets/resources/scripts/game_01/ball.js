let utils = require('game_utils');
cc.Class({
    extends: cc.Component,

    properties: {
        _instanceid: -1,//实例化小球时的序号id
        _index: -1,//在数组中的位置  0为第一个
        // _front: -1,//在数组中的前一个位置  都为-1说明时刚生成 还未加入数组
        // _next: -1,//在数组中的后一个位置
        _ballname: '',//显示的名字
        _number: 0,//显示的数字
        speed: 3
    },

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {},

    start() {
        this._isMoving = false;
        this._offset = 0
    },

    init(data) {
        this._ballname = data.name;
        this._number = data.number;
        this.node.color = cc.hexToColor(data.color);
        // console.log('_instanceid', this._instanceid);

        this.refresh();
    },

    refresh() {
        this.node.getChildByName('name').getComponent(cc.Label).string = this._ballname;
        this.node.getChildByName('number').getComponent(cc.Label).string = this._number;
        this.node.getChildByName('instanceid').getComponent(cc.Label).string = this._instanceid;
    },
    /**
     * 小球从当前点移动到目标点 运动轨迹为圆上弧形
     * @param {*} radius 
     * @param {*} position 
     */
    move(radius, position) {
        this._isMoving = true;
        this._radius = radius;
        // this._deltaAngle = utils.getdeltaAngleBetweenPoints(this._radius, this.node.position, position);
        this._startAngle = utils.getAngleWithTouchPoint(this.node.position);
        this._endAngle = utils.getAngleWithTouchPoint(position);
        // console.log(`开始位置:${this.node.position}   目标位置:${position}`)
        console.log(`------------------------------------------------`)
        this._startAngle = Math.floor(this._startAngle);
        this._endAngle = Math.floor(this._endAngle);
        console.log(`小球：${this._ballname} id:${this._instanceid} 准备移动`);
        console.log(`开始角度:${this._startAngle}   目标角度:${this._endAngle}`)

        this._PI = 0
        if (this._startAngle < this._endAngle) {
            if (Math.abs(this._endAngle - this._startAngle) > 180) {
                this._offset = -1
                this._PI = 360
            } else {
                this._offset = 1
            }
        } else if (this._startAngle > this._endAngle) {
            if (Math.abs(this._endAngle - this._startAngle) > 180) {
                this._offset = 1
                this._PI = 360
            } else {
                this._offset = -1
            }
        } else {
            // console.log('角度相同不位移');
        }
        this.area = [];
        this.area[0] = Math.floor(this._endAngle) + this._offset * this._PI - this.speed
        this.area[1] = Math.floor(this._endAngle) + this._offset * this._PI + this.speed
        this._offset *= this.speed
        console.log(`区间：${this.area} `);
        console.log(`当前位置：${this.node.position} `);
        console.log(`位移方向：${this._offset} 外加角度: ${this._PI}`);

    },

    update(dt) {
        if (!this._isMoving) { return }
        console.log(`小球：${this._ballname} id: ${this._instanceid} 当前角度: ${this._startAngle}`)
        if (this.area[0] <= Math.floor(this._startAngle) && this.area[1] >= Math.floor(this._startAngle)) {
            console.log(`小球：${this._ballname} id: ${this._instanceid} 已到达位置: ${this.node.position}`)
            this._isMoving = false
        }
        this._startAngle += this._offset;
        let pos = utils.getPointWithAngle(this._startAngle, this._radius)
        // console.log(`小球：${this._ballname} id: ${this._instanceid} 当前位置：${pos} 当前角度：${this._startAngle}`);
        this.node.position = pos

    },
});
