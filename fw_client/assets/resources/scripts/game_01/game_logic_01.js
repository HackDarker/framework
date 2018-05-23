
let game_setting = require('game_settings')
let MONSTER_TEMPLATE = game_setting.MONSTER_TEMPLATE
let ENUM_MONSTER_TYPE = game_setting.ENUM_MONSTER_TYPE
let MASTER_SCALE = 0.5;
let utils = require('game_utils');
cc.Class({
    extends: cc.Component,

    properties: {
        center: cc.Node,
        ballprefab: cc.Prefab,
        ballRoot: cc.Node,
        Graphics: cc.Node,
        _canCreateBall: false,//生成小球控制器
        _radius: 300,
        initNumber: 15,
        _initBalls: 6
    },

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {},

    start() {
        this.drawCircle();
        this._ballpool = new cc.NodePool('ball');
        this.initTouchHandler();
        this.gameBegin();
    },
    //游戏开始 初始化游戏
    gameBegin: function () {
        this.ballRoot.removeAllChildren();
        this.center.removeAllChildren();
        this._gameOver = false;
        this._count = 0;
        this.balllist = new Array(this.initNumber);
        this.tempball = null;
        this.canTouch = true;
        for (let index = 0; index < this._initBalls; index++) {
            let newball = this.generateBall();
            if (newball._type != ENUM_MONSTER_TYPE.norm) {
                this.removeMonster(newball)
                continue
            }
            newball.node.parent = this.ballRoot;
            this.balllist[index] = newball
        }
        this.initBallPosition(true, 50);
    },
    /**
     * 游戏开局 将新生成的小球放到圆上
     * @param {*} tag 
     * @param {*} offsetangle 初始角度位移
     */
    initBallPosition(tag, offsetangle) {
        let count = utils.getNotNullOfArray(this.balllist);
        let points = utils.getPointsWithNumber(count.length, this._radius, offsetangle);
        // console.log('balllist内小球个数：', count);
        // console.log('points对应小球位置：', points);
        for (let index = 0; index < count.length; index++) {
            const element = count[index];
            if (element) {
                element.node.position = points[index].pos
            }
        }
        this._canCreateBall = true;
    },
    /**
     * 新添加小球后刷新所有小球位置
     * @param {*} tag 
     * @param {*} targetindex 
     */
    refreshBallPosition(targetindex, TouchAngle) {
        let count = utils.getNotNullOfArray(this.balllist);
        let points = utils.getPointsBaseTouchAngle(this.balllist, targetindex, TouchAngle, this._radius, this._gameOver);
        // let points = utils.getPointsBaseTouchPoint(this.balllist, targetindex, this._radius);
        console.log('balllist内小球个数：', count);
        console.log('points对应小球位置：', points);
        for (let index = 0; index < count.length; index++) {
            const element = count[index];
            if (element && element._index != targetindex || this._gameOver) {//游戏结束前 target 单独运动 结束时一起调用move方法  因为此时的target为原来的节点 没有被替换掉
                element.move(this._radius, points[index].pos)
            }
        }
        // this._canCreateBall = true;
    },
    /**
     * 检查是否有可以合并的小球
     */
    checkAndMerge: function (targetIndex) {
        let monsters = this.balllist;

        let getFrontMonster = function (monsters, targetIndex) {
            const monster = monsters[targetIndex - 1];
            if (monster) {
                return monster
            }
            for (let index = monsters.length - 1; index > 0; index--) {
                if (monster[index]) {
                    return monster;
                } else {
                    continue
                }
            }
        }
        let getNextMonster = function (monsters, targetIndex) {
            const monster = monsters[targetIndex + 1];
            if (monster) {
                return monster
            } else {
                return monsters[0]
            }
        }

        let targetMonster = monsters[targetIndex];
        if (targetMonster._type == ENUM_MONSTER_TYPE.merge) {
            let front = getFrontMonster(monsters, targetIndex);
            let next = getNextMonster(monsters, targetIndex);
            if (front._type == next._type && front._instanceid != next._instanceid && front._ballname == next._ballname) {
                // this.Merge();

                front.move(this._radius, targetMonster.node.position)
                next.move(this._radius, targetMonster.node.position)
            }
        }
    },
    drawCircle: function (params) {
        this.ctx = this.getComponent(cc.Graphics);

        this.ctx.circle(this.node.x, this.node.y, 300);
        this.ctx.lineWidth = 5;
        this.ctx.strokeColor = cc.hexToColor('#FFD600');
        this.ctx.stroke();

        let number = 8
        let points = utils.getPointsWithNumber(number, this._radius)
        for (let index = 0; index < number; index++) {
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(points[index].pos);

            let label = new cc.Node();
            label = label.addComponent(cc.Label)
            label.string = `x:${points[index].pos.x.toFixed(2)}\ny:${points[index].pos.y.toFixed(2)}\nangle:${points[index].angle}`;
            label.fontSize = 20
            label.node.color = cc.hexToColor('#FF00JJ');
            label.node.position = points[index].pos;
            label.node.parent = this.Graphics
        }
        this.ctx.strokeColor = cc.hexToColor('#00E9FD');
        this.ctx.stroke();
    },

    initTouchHandler: function () {
        var self = this;
        this.Graphics.on(cc.Node.EventType.TOUCH_START, function (event) {
            var touches = event.getTouches();
            var touchLoc = touches[0].getLocation();
            var localLoc = self.Graphics.parent.convertToNodeSpaceAR(touchLoc);

            console.log('所点击位置的角度：', utils.getAngleWithTouchPoint(localLoc));
            let position = utils.getPositionWithTouchPoint(localLoc, self._radius);
            localLoc = self.getCenterPoint(position);
            self.drawLine(localLoc);


        }, this.Graphics);
        this.Graphics.on(cc.Node.EventType.TOUCH_MOVE, function (event) {
            var touches = event.getTouches();
            var touchLoc = touches[0].getLocation();
            var localLoc = self.Graphics.parent.convertToNodeSpaceAR(touchLoc);
            let position = utils.getPositionWithTouchPoint(localLoc, self._radius);
            localLoc = self.getCenterPoint(position);
            self.drawLine(localLoc);

        }, this.Graphics);
        this.Graphics.on(cc.Node.EventType.TOUCH_END, function (event) {
            if (!self.canTouch) {
                console.log('等待上一次操作完成，在此之前无法点击！');
                return
            }
            var touches = event.getTouches();
            var touchLoc = touches[0].getLocation();
            var localLoc = self.Graphics.parent.convertToNodeSpaceAR(touchLoc);
            self.drawLine();
            let position = utils.getPositionWithTouchPoint(localLoc, self._radius);
            position = self.getCenterPoint(position);
            console.log('触摸点转换后圆上坐标：', position)
            self.tempball.node.parent = self.ballRoot;//将小球挂载到球列表
            // console.log('原始数组', self.balllist)
            let insertIndex = self.getInsertIndex(position);
            console.log('小球插入位置', insertIndex)
            if (!self._gameOver) {
                self.insertBall(insertIndex, self.tempball);
            }
            // console.log('添加新球后数组', self.balllist)
            let ballCount = utils.getNotNullOfArray(self.balllist).length

            self.canTouch = false;
            self.tempball.node.runAction(
                cc.sequence(
                    cc.moveTo(0.3, position),
                    cc.callFunc(() => {
                        self.tempball = null;
                        if (!self._gameOver) {
                            self._canCreateBall = true;
                        }
                        if (self._gameOver) {
                            self._canCreateBall = false;
                            gc.alert.showUI('游戏结束，进入下一局', () => {
                                self.gameBegin();
                            });
                            return;
                        }

                        self.checkAndMerge(insertIndex);
                    })
                )
            );
            let touchAngle = utils.getAngleWithTouchPoint(position)
            self.refreshBallPosition(insertIndex, touchAngle);

        }, this.Graphics);
        // this.Graphics.on(cc.Node.EventType.TOUCH_CANCEL, function (event) {
        //     var touches = event.getTouches();
        //     var touchLoc = touches[0].getLocation();
        //     var localLoc = self.Graphics.parent.convertToNodeSpaceAR(touchLoc);
        //     self.drawLine();

        //     let position = utils.getPositionWithTouchPoint(localLoc,self._radius);

        //     self.tempball.node.parent = self.ballRoot;//将小球挂载到球列表
        //     self.insertBall();

        //     self.tempball.node.runAction(cc.sequence(
        //         cc.moveTo(2, position),
        //         cc.callFunc()
        //     ));
        // }, this.Graphics);
    },
    /**
     * 根据触摸点获取所在扇形的中点
     */
    getCenterPoint: function (position) {
        let insertIndex = this.getInsertIndex(position);
        let array = utils.getNotNullOfArray(this.balllist)
        let length = array.length
        let pointA = array[insertIndex] ? array[insertIndex].node.position : array[0].node.position
        let pointB = array[(length + insertIndex - 1) % length].node.position
        // console.log(`pointA:${pointA} pointB:${pointB}`)
        let localLoc = utils.getCenterPoint(pointA, pointB, this._radius)
        // console.log('中点坐标：', localLoc);
        return localLoc;
    },


    getInsertIndex: function (position) {
        let touchAngle = utils.getAngleWithTouchPoint(position);
        let insertIdx = -1;

        // console.log(`------------------点击点角度：${touchAngle}`);

        let tempAngle = 10000;
        let tempObj = {};//离得最近的小球的索引
        var idx = 0;
        this.balllist.forEach(element => {
            let angle = utils.getAngleWithTouchPoint(element.node.position);
            if (angle) {
                let delta = Math.abs(angle - touchAngle);
                // console.log('第几个：', idx);
                // console.log('距离角度delta:', delta);
                if (tempAngle > delta) {
                    // console.log('存储最小角:', tempAngle);
                    tempAngle = delta;
                    tempObj = {
                        angle: angle,
                        index: idx,
                    }
                    // console.log('tempObj:' + idx, tempObj);
                }
            } else {
                console.log('为空idx:' + idx, angle);
            }
            idx++;
        });
        // console.log('离得最近的小球：', tempObj)
        if (touchAngle >= tempObj.angle) {
            insertIdx = tempObj.index + 1;
        } else {
            insertIdx = tempObj.index
        }
        // console.log(`------------------点击点角度：${touchAngle}`);
        if (utils.getNotNullOfArray(this.balllist).length == this.balllist.length) {
            console.log('游戏结束');
            this._gameOver = true;
        }
        console.log('插入点：', insertIdx);
        return insertIdx;
    },


    drawLine: function (localLoc) {
        if (this.ctx2) {
            this.ctx2.clear();
            if (!localLoc) { return }
        }
        this.ctx2 = new _ccsg.GraphicsNode();
        this.Graphics._sgNode.addChild(this.ctx2);
        this.ctx2.moveTo(cc.v2(0, 0));
        this.ctx2.lineTo(localLoc);
        this.ctx2.lineWidth = 2;
        this.ctx2.strokeColor = cc.hexToColor('#FF0000');
        this.ctx2.stroke();
    },

    //新生成的小球暂存在临时数组
    generateBall: function () {
        let ball = this._ballpool.get();
        if (!ball) {
            ball = cc.instantiate(this.ballprefab);
            ball.addComponent('ball')
        }
        this._count++
        ball.position = cc.p({ x: 0, y: 0 });
        ball.scale = MASTER_SCALE

        let ballscript = ball.getComponent('ball')

        ballscript._instanceid = this._count;

        let index = Math.floor(Math.random() * MONSTER_TEMPLATE.length)
        let ballObj = MONSTER_TEMPLATE[index]
        ballscript.init(ballObj);
        console.log('生成新小球_instanceid：' + this._count, ballObj.name + ':' + ballObj.number);
        ball.parent = this.center;
        return ballscript
    },
    removeMonster: function (ball) {
        this._ballpool.put(ball);
    },

    insertBall: function (posIndex, tempball) {
        if (this.balllist[posIndex]) {
            for (let index = this.balllist.length - 1; index > posIndex; index--) {
                if (this.balllist[index - 1]) {
                    this.balllist[index] = this.balllist[index - 1]
                    this.balllist[index]._index = index
                    // console.log(`${index - 1} 后移成功 现在位置为${index}`);
                } else {
                    // console.log(`当前索引${index}  目标:${index - 1}是否为空${this.balllist[index - 1] == null}`);
                    continue
                }
            }
        }
        this.balllist[posIndex] = tempball;//存储小球对象到数组
        tempball._index = posIndex;
    },

    deleteBall: function (targetIndex) {
        this.balllist[targetIndex] = null;
    },
    update(dt) {
        if (this._canCreateBall) {
            this.tempball = this.generateBall();
            this._canCreateBall = false;
            this.canTouch = true;
        }

    },
});
