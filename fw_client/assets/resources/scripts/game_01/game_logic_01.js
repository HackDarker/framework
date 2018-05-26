
let game_setting = require('game_settings')
let MONSTER_TEMPLATE = game_setting.MONSTER_TEMPLATE
let ENUM_MONSTER_TYPE = game_setting.ENUM_MONSTER_TYPE
let MONSTER_SCALE = 0.5;
let utils = require('game_utils');
cc.Class({
    extends: cc.Component,

    properties: {
        center: cc.Node,
        monsterPrefab: cc.Prefab,
        monsterRoot: cc.Node,
        Graphics: cc.Node,
        _canCreateMonster: false,//生成小球控制器
        _radius: 300,
        maxMonsters: 15,//最大个数，超过则游戏结束
        _initNumber: 6,//游戏开始预设个数
        _state: ''
    },

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {},

    start() {
        this.drawCircle();
        this._monsterPool = new cc.NodePool('monster');
        this.initTouchHandler();
        this.gameBegin();
    },
    //游戏开始 初始化游戏
    gameBegin: function () {
        this.monsterRoot.removeAllChildren();
        this.center.removeAllChildren();
        this._gameOver = false;
        this._count = 0;
        this.monsterList = new Array();
        console.log(this.monsterList);
        this.tempMonster = null;
        this.canTouch = true;
        let number = 0;
        for (let index = 0; index < 10; index++) {
            let newMonster = this.generateMonster();
            if (newMonster._type != ENUM_MONSTER_TYPE.norm) {
                this.removeMonster(newMonster)
                continue
            }
            this.insertMonster(number++, newMonster);
            newMonster.node.parent = this.monsterRoot;
            if (this._initNumber == number) {
                break;
            }
        }
        this.initMonsterPosition(true, 50);
    },
    /**
     * 游戏开局 将新生成的小球放到圆上
     * @param {*} tag 
     * @param {*} offsetangle 初始角度位移
     */
    initMonsterPosition(tag, offsetangle) {
        let count = utils.getNotNullOfArray(this.monsterList);
        let points = utils.getPointsWithNumber(count.length, this._radius, offsetangle);
        // console.log('monsterList：', this.monsterList);
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
    refreshMonstersPosition(targetindex, TouchAngle) {
        let count = utils.getNotNullOfArray(this.monsterList);
        let points = utils.getPointsBaseTouchAngle(this.monsterList, targetindex, TouchAngle, this._radius, this._gameOver);
        // let points = utils.getPointsBaseTouchPoint(this.monsterList, targetindex, this._radius);
        console.log('数组内非空对象', count);
        console.log('对应目标位置', points);
        for (let index = 0; index < count.length; index++) {
            const element = count[index];
            if (element && element._index != targetindex || this._gameOver) {//游戏结束前 target 单独运动 结束时一起调用move方法  因为此时的target为原来的节点 没有被替换掉
                element.move(this._radius, points[index].pos)
            }
        }
        // this._canCreateBall = true;
    },
    /**
    * 获取目标位置后一个对象：
    * @param {*} monsters 
    * @param {*} targetIndex 
    */
    getNewMonster: function (newMonsterNumber) {
        console.log('合并后新对象number', newMonsterNumber);
        if (newMonsterNumber > 6) {
            console.log('当前分值大于最大值');
            newMonsterNumber = 1;
        }
        let monsters = MONSTER_TEMPLATE
        let monster = null
        monsters.forEach(item => {
            item.skill = null
            if (item.number == newMonsterNumber) {
                monster = item;
            }
        });
        console.log('合并后产生新小球：', monster);
        return monster;
    },
    /**
 * 获取目标索引前一个对象
 * @param {*} monsters 
 * @param {*} targetIndex 
 */
    getFrontMonster: function (monsters, targetIndex) {
        const monster = monsters[targetIndex - 1];
        if (monster) {
            return monster
        }
        for (let index = monsters.length - 1; index >= 0; index--) {
            if (monsters[index]) {
                return monsters[index];
            } else {
                continue
            }
        }
    },
    /**
     * 获取目标位置后一个对象：
     * @param {*} monsters 
     * @param {*} targetIndex 
     */
    getNextMonster: function (monsters, targetIndex) {
        const monster = monsters[targetIndex + 1];
        if (monster) {
            return monster
        } else {
            return monsters[0]
        }
    },
    mergeObjs: function (monsterA, monsterB, monsterC) {
        monsterA.move(this._radius, monsterC.node.position)
        monsterB.move(this._radius, monsterC.node.position, () => {
            this.deleteMonsterAtIndex([monsterC._index, monsterB._index]);//待解决问题：循环检查是否还可以合并 否则重新刷新所有怪物的位置
            let newMonsterNumber = monsterA._number + monsterB._number + monsterC._number
            let newMonster = this.getNewMonster(newMonsterNumber)
            newMonster.skill = ENUM_MONSTER_TYPE.merge//合并完 赋予新对象合并的技能 用于下一轮检测
            monsterA.init(newMonster)

            return monsterA._index;
        })
    },
    /**
     * 检查是否有可以合并的小球
     */
    checkAndMerge: function (targetIndex) {
        if (targetIndex == -1) {
            return
        }
        let monsters = this.monsterList;

        let targetMonster = monsters[targetIndex];
        if (!targetMonster) {
            console.log('monsters', monsters);
            console.error(`索引异常:${targetIndex} 无法获取对象：${targetMonster}`);
            return
        }
        let front = this.getFrontMonster(monsters, targetIndex);
        let next = this.getNextMonster(monsters, targetIndex);
        console.log('targetMonster', targetMonster);
        console.log('front', front);
        console.log('next', next);
        console.log('targetMonster', targetMonster._number);
        console.log('front', front._number);
        console.log('next', next._number);

        let nexttargetindex = -1;//本轮合并完毕在检测下一轮
        let finalMonster = null;//合并完后的对象
        new Promise((resolve, reject) => {
            console.log('targetMonster._skill:' + targetMonster._monsterName, targetMonster._skill);
            if (targetMonster._type == ENUM_MONSTER_TYPE.merge || targetMonster._skill == ENUM_MONSTER_TYPE.merge) {//插入对象有合并技能
                if (front._type == next._type && front._number == next._number && front._monsterId != next._monsterId && next._type != ENUM_MONSTER_TYPE.merge) {
                    // this.Merge();
                    console.log(`front._index:${front._index} next._index:${next._index}  targetMonster._index:${targetMonster._index}  `);
                    front.move(this._radius, targetMonster.node.position)
                    next.move(this._radius, targetMonster.node.position, () => {
                        let newMonsterNumber = front._number + next._number + targetMonster._number
                        this.deleteMonsterAtIndex([targetIndex, next._index]);//待解决问题：循环检查是否还可以合并 否则重新刷新所有怪物的位置
                        let newMonster = this.getNewMonster(newMonsterNumber)
                        newMonster.skill = ENUM_MONSTER_TYPE.merge//合并完 赋予新对象合并的技能 用于下一轮检测
                        front.init(newMonster)

                        nexttargetindex = front._index;
                        console.log('nexttargetindex', nexttargetindex);
                        // nexttargetindex = this.mergeObjs(front, next, targetMonster);
                        resolve({ index: nexttargetindex })
                    })
                } else {
                    console.log('清除对象技能');
                    finalMonster = targetMonster;
                    targetMonster._skill = null
                    resolve({ index: nexttargetindex, finalMonster: finalMonster })
                }
                return
            }
            if (front._type == ENUM_MONSTER_TYPE.merge) {//插入对象前一个有合并技能
                let front2index = front._index
                console.log('front._index', front._index);
                let front2 = this.getFrontMonster(monsters, front2index)
                console.log('front2', front2);
                console.log(`插入点的前方 front._index:${front._index} next._index:${front2._index}  targetMonster._index:${targetMonster._index}  `);
                if (front2._type == targetMonster._type && front2._number == targetMonster._number) {
                    front2.move(this._radius, front.node.position)
                    targetMonster.move(this._radius, front.node.position, () => {
                        let newMonsterNumber = front2._number + targetMonster._number + front._number
                        this.deleteMonsterAtIndex([targetIndex, front._index]);//待解决问题：循环检查是否还可以合并 否则重新刷新所有怪物的位置
                        let newMonster = this.getNewMonster(newMonsterNumber)
                        newMonster.skill = ENUM_MONSTER_TYPE.merge
                        front2.init(newMonster)

                        nexttargetindex = front2._index;
                        console.log('nexttargetindex', nexttargetindex);
                        // nexttargetindex = this.mergeObjs(front2, targetMonster, front);
                        resolve({ index: nexttargetindex })
                    })
                    return
                }
                // else {
                //     resolve({ index: -1 })
                // }
            }
            if (next._type == ENUM_MONSTER_TYPE.merge) {//插入对象后一个有合并技能
                let next2index = next._index
                console.log('next._index', next._index);
                let next2 = this.getNextMonster(monsters, next2index)
                console.log('next2', next2);
                console.log(`插入点的后方 next2._index:${next2._index} next._index:${next._index}  targetMonster._index:${targetMonster._index}  `);
                if (next2._type == targetMonster._type && next2._number == targetMonster._number) {
                    next2.move(this._radius, next.node.position)
                    targetMonster.move(this._radius, next.node.position, () => {
                        let newMonsterNumber = next2._number + targetMonster._number + next._number
                        this.deleteMonsterAtIndex([next2._index, next._index]);//位置不能换
                        let newMonster = this.getNewMonster(newMonsterNumber)
                        newMonster.skill = ENUM_MONSTER_TYPE.merge
                        targetMonster.init(newMonster)

                        nexttargetindex = targetMonster._index;
                        console.log('nexttargetindex', nexttargetindex);
                        // nexttargetindex = this.mergeObjs(next2, targetMonster, next);
                        resolve({ index: nexttargetindex })
                    })
                }
                else {
                    console.error('插入点的后方 没有可以合并的组合')
                    resolve({ index: -1 })
                }
            } else {
                console.error('没有可以合并的组合');
                resolve({ index: -1 })
            }
        }).then(data => {
            let nexttargetindex = data.index
            let finalMonster = data.finalMonster
            console.log('进入下一轮检测在当前索引下是否还能合并：', nexttargetindex);
            console.log('进入下一轮检测在当前索引下是否还能合并：', finalMonster);
            if (nexttargetindex == -1) {
                if (finalMonster) {
                    console.log('无法再合并，刷新所有小球位置');
                    let touchAngle = utils.getAngleWithTouchPoint(finalMonster.node.position)
                    this.refreshMonstersPosition(finalMonster._index, touchAngle);
                }
                this._canCreateBall = true;
            } else {
                setTimeout((nexttargetindex) => {
                    this.checkAndMerge(nexttargetindex);
                }, 500, nexttargetindex);
            }
        }).catch(err => {
            console.error(err);
        })
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
            console.log(localLoc);
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
            console.log('触摸点转换后圆上坐标：', position)
            position = self.getCenterPoint(position);
            console.log('触摸点转换后圆上扇形中点坐标：', position)
            self.tempMonster.node.parent = self.monsterRoot;//将小球挂载到球列表
            // console.log('原始数组', self.monsterList)
            let insertIndex = self.getInsertIndex(position);
            console.log('小球插入位置', insertIndex)
            if (!self._gameOver) {
                self.insertMonster(insertIndex, self.tempMonster);
            }
            // console.log('添加新球后数组', self.monsterList)
            let ballCount = utils.getNotNullOfArray(self.monsterList).length

            self.canTouch = false;
            self.tempMonster.node.runAction(
                cc.sequence(
                    cc.moveTo(0.3, position),
                    cc.callFunc(() => {
                        self.tempMonster = null;
                        if (!self._gameOver) {
                            // self._canCreateBall = true;
                        } else {
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
            self.refreshMonstersPosition(insertIndex, touchAngle);

        }, this.Graphics);
    },
    /**
     * 根据触摸点获取所在扇形的中点
     */
    getCenterPoint: function (position) {
        let insertIndex = this.getInsertIndex(position);
        let array = utils.getNotNullOfArray(this.monsterList)
        let length = array.length
        let pointA = array[insertIndex] ? array[insertIndex].node.position : array[0].node.position
        let pointB = array[(length + insertIndex - 1) % length].node.position
        console.log(`pointA:${pointA} pointB:${pointB}`)
        console.log(`length:${length}`)
        let localLoc = position
        if (length > 1) {
            localLoc = utils.getCenterPoint(pointA, pointB, this._radius)//两点为对角时中点无限接近零但不是零  需要调整 c.v2 API问题 
            console.log('中点坐标：', localLoc);
            if (localLoc.x == 0 && localLoc.y == 0) {//只剩2个的时候    
                let angleA = utils.getAngleWithTouchPoint(pointA);
                let angleTouch = utils.getAngleWithTouchPoint(position);
                // if (angleA > angleTouch && angleA <= 180) {
                //     angleA -= 90;
                // } else if (180 < angleTouch && angleA <= 180) {
                //     angleA += 90;
                // }
                console.log(`angleA:${angleA}  angleTouch:${angleTouch}`);
                if (angleA <= 180) {
                    if (angleA <= angleTouch && angleTouch < angleA + 180) {
                        angleA += 90
                    } else {
                        angleA += 270
                        while (angleA > 360) {
                            angleA -= 360
                        }
                    }
                } else {
                    if (angleA - 180 <= angleTouch && angleTouch < angleA) {
                        angleA -= 90
                    } else {
                        angleA += 90
                        while (angleA > 360) {
                            angleA -= 360
                        }
                    }
                }
                localLoc = utils.getPointWithAngle(angleA)
            }
        }
        
        return localLoc;
    },


    getInsertIndex: function (position) {
        let touchAngle = utils.getAngleWithTouchPoint(position);
        let insertIdx = -1;

        // console.log(`------------------点击点角度：${touchAngle}`);

        let tempAngle = 10000;
        let tempObj = {};//离得最近的小球的索引
        var idx = 0;
        this.monsterList.forEach(element => {
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
        if (this.maxMonsters == this.monsterList.length) {
            // if (utils.getNotNullOfArray(this.monsterList).length == this.monsterList.length) {
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
    generateMonster: function () {
        let node = this._monsterPool.get();
        if (!node) {
            node = cc.instantiate(this.monsterPrefab);
            node.addComponent('monster')
        }
        this._count++
        node.position = cc.p({ x: 0, y: 0 });
        node.scale = MONSTER_SCALE
        node.parent = this.center;

        let monsterscript = node.getComponent('monster')
        monsterscript._monsterId = this._count;
        monsterscript._index = -1;

        let array = [1, 2, 6, 6, 6, 3, 4, 5, 6, 0]
        let index = Math.floor(Math.random() * array.length)
        let monster = MONSTER_TEMPLATE[array[index]]
        monster.skill = null
        monsterscript.init(monster);
        console.log('生成新对象Id:' + this._count, monster);
        return monsterscript
    },
    removeMonster: function (monster) {
        if (monster.node) {
            monster.reset();
            this._monsterPool.put(monster.node);
        } else {
            console.error('monster', monster);
        }
    },

    insertMonster: function (posIndex, tempMonster) {
        if (this.monsterList[posIndex]) {
            // console.log('this.monsterList', this.monsterList);
            for (let index = this.monsterList.length; index > posIndex; index--) {
                if (this.monsterList[index - 1]) {
                    // console.log(`目标：${this.monsterList[index - 1]._monsterName} : ${this.monsterList[index - 1]._monsterId}`);
                    this.monsterList[index] = this.monsterList[index - 1]
                    this.monsterList[index]._index = index
                    // console.log(` ${index - 1} 后移成功 现在位置为${index}`);
                } else {
                    // console.log(`当前索引${index}  目标:${index - 1}是否为空${this.monsterList[index - 1] == null}`);
                    continue
                }
            }
        } else {
            console.log(`this.monsterList[posIndex]在位置${posIndex}为空 直接插入`);
        }
        this.monsterList[posIndex] = tempMonster;//存储小球对象到数组
        tempMonster._index = posIndex;
        // console.log('this.monsterList2', this.monsterList);
    },

    deleteMonsterAtIndex: function (indexArry) {
        // console.log('deleteMonsterAtIndex-------------');
        for (let index = 0; index < indexArry.length; index++) {
            let monster = this.monsterList[indexArry[index]]
            // console.log('indexArry[index]', indexArry[index]);
            // console.log('monster', monster);
            this.removeMonster(monster)
            this.monsterList[indexArry[index]] = null;
        }

        let results = utils.getNotNullOfArray(this.monsterList)
        // console.log('getNotNullOfArray', results);
        for (let ii = 0; ii < this.monsterList.length; ii++) {
            if (results[ii]) {
                results[ii]._index = ii;
            } else {
                console.log('被删除的对象');
            }
        }
        this.monsterList = results;
        // console.log('monsterList', this.monsterList);
    },
    update(dt) {
        if (this._canCreateBall) {
            this.tempMonster = this.generateMonster();
            this._canCreateBall = false;
            this.canTouch = true;
        }

    },
});
