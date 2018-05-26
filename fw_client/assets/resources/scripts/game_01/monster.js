let utils = require('game_utils');
let game_setting = require('game_settings')
let ENUM_MONSTER_TYPE = game_setting.ENUM_MONSTER_TYPE
cc.Class({
    extends: cc.Component,

    properties: {
        _monsterId: -1,//实例化小球时的序号id
        _index: -1,//在数组中的位置  0为第一个
        // _front: -1,//在数组中的前一个位置  都为-1说明时刚生成 还未加入数组
        // _next: -1,//在数组中的后一个位置
        _monsterName: '',//显示的名字
        _number: 0,//显示的数字
        speed: 1,
        _type: null,
    },

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {},

    start() {
        this._isMoving = false;
        this._offset = 0//位移
    },

    init(data) {
        this._monsterName = data.name;
        this._number = data.number;
        this.node.color = cc.hexToColor(data.color);
        this._type = data.type;
        this._skill = data.skill;
        console.log('data.name:' + data.name + ':' + this._monsterId, data);

        this.refresh();
    },

    reset() {
        console.log(`原对象${this._monsterName} ${this._monsterId} 还原成功`);
        console.log(`_skill${this._skill} _type${this._type} 还原成功`);
        this._monsterName = '';
        this._number = 0;
        this.node.color = cc.hexToColor('#FFFFFF');
        this._type = null;
        this._skill = null;
    },

    refresh() {
        if (this._type == ENUM_MONSTER_TYPE.norm) {
            this.node.getChildByName('name').getComponent(cc.Label).string = this._monsterName;
            this.node.getChildByName('number').getComponent(cc.Label).string = this._number;
            this.node.getChildByName('name').active = true;
            this.node.getChildByName('number').active = true;
        } else {
            this.node.getChildByName('name').active = false;
            this.node.getChildByName('number').active = false;
        }
        this.node.getChildByName('id').getComponent(cc.Label).string = this._monsterId;
    },
    /**
     * 小球从当前点移动到目标点 运动轨迹为圆上弧形
     * @param {*} radius 
     * @param {*} position 
     */
    move(radius, position, callback) {
        this._isMoving = true;
        this._radius = radius;
        // this._deltaAngle = utils.getdeltaAngleBetweenPoints(this._radius, this.node.position, position);
        this._startAngle = utils.getAngleWithTouchPoint(this.node.position);
        this._endAngle = utils.getAngleWithTouchPoint(position);
        // console.log(`开始位置:${this.node.position}   目标位置:${position}`)
        console.log(`--------------------小球：${this._monsterName} id:${this._monsterId} 准备移动----------------------------`)
        // this._startAngle = Math.floor(this._startAngle);
        // this._endAngle = Math.floor(this._endAngle);
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
        this.area[0] = Math.floor(this._endAngle + this._offset * this._PI) - 0.5
        this.area[1] = Math.floor(this._endAngle + this._offset * this._PI) + 0.5
        //Math.floor(this._endAngle)
        // Math.floor(this._endAngle)
        this._offset *= this.speed
        // console.log(`区间：${this.area} `);
        // console.log(`当前位置：${this.node.position} `);
        // console.log(`位移方向：${this._offset} 外加角度: ${this._PI}`);

        let timer = setInterval(() => {
            if (!this._isMoving) { return }
            if (this.area[0] <= Math.floor(this._startAngle) && this.area[1] >= Math.floor(this._startAngle)) {
                // console.log(`小球：${this._monsterName} id: ${this._monsterId} 已到达位置: ${this.node.position} 当前角：${this._startAngle} 区间：${this.area}`)
                this._isMoving = false
                clearInterval(timer)
                this._startAngle = this._endAngle;
                if (callback) {
                    callback()
                }
            }
            let pos = utils.getPointWithAngle(this._startAngle, this._radius)
            // console.log(`小球：${this._monsterName} id: ${this._monsterId} 当前位置：${pos} 当前角度：${this._startAngle}`);
            this.node.position = pos
            this._startAngle += this._offset;
        }, 5)


    },

    update(dt) {
        // if (!this._isMoving) { return }
        // // console.log(`小球：${this._monsterName} id: ${this._monsterId} 当前角度: ${this._startAngle}`)
        // if (this.area[0] <= Math.floor(this._startAngle) && this.area[1] >= Math.floor(this._startAngle)) {
        //     console.log(`小球：${this._monsterName} id: ${this._monsterId} 已到达位置: ${this.node.position}`)
        //     this._isMoving = false
        // }
        // this._startAngle += this._offset;
        // let pos = utils.getPointWithAngle(this._startAngle, this._radius)
        // // console.log(`小球：${this._monsterName} id: ${this._monsterId} 当前位置：${pos} 当前角度：${this._startAngle}`);
        // this.node.position = pos
    },
});
