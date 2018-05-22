/**
 * 数据处理接口
 */

module.exports = utils;
function utils() {

}
/**
* 根据点击的位置获取对应的角度,与正X轴所形成的角度
* @param {*} point 
*/
utils.getAngleWithTouchPoint = function (point) {
    let radian = 180 / Math.PI;//1弧度 == 180 / Math.PI度
    let angle = Math.atan(point.y / point.x)
    if (point.x < 0 && point.y > 0) {
        angle = Math.PI + angle;
    }
    if (point.x < 0 && point.y < 0) {
        angle = Math.PI + angle;
    }
    if (point.x > 0 && point.y < 0) {
        angle += 2 * Math.PI;
    }

    return angle * radian;
};
/**
* 根据所给的角度,计算圆上节点坐标
* @param {*} point 
*/
utils.getPointWithAngle = function (angle, radius) {
    let unitAngle = Math.PI / 180;
    let X = radius * Math.cos(angle * unitAngle);
    let Y = radius * Math.sin(angle * unitAngle);

    return cc.v2(X, Y)
};

/**
   * 根据小球个数等分计算圆上节点位置和与正x轴所形成的角度
   * 以(300,0)为0度开始
   * @param {*} number 
   * @param {*} radius 半径
   * @param {*} offSetAnlge 位移角
   */
utils.getPointsWithNumber = function (number, radius, offSetAnlge) {
    let points = [];
    let detalAngle = 360 / number
    let angle = 0;
    let unitAngle = Math.PI / 180;//1° == Math.PI / 180弧度
    offSetAnlge = offSetAnlge || 0
    // console.log(`初始角度:${angle}  detal角：${detalAngle} 半径:${Radio}`);
    for (let index = 0; index < number; index++) {
        let X = radius * Math.cos((angle + offSetAnlge) * unitAngle);
        let Y = radius * Math.sin((angle + offSetAnlge) * unitAngle);
        let data = {
            pos: cc.v2(X, Y),
            angle: angle
        }
        // points.push(cc.v2(X, Y))
        points.push(data)
        angle += detalAngle;
    }
    return points;
}
/**
 * 以触摸点为起始点 计算所有小球的坐标
 * @param {*} array 
 * @param {*} targetIndex 
 * @param {*} radius 
 */
utils.getPointsBaseTouchPoint = function (array, targetIndex, radius) {
    let targetPoint = array[targetIndex],
        arraylength = array.length,//
        targetAngle = utils.getAngleWithTouchPoint(targetPoint.node.position),
        number = utils.getNotNullOfArray(array).length,//非空对象个数
        detalAngle = 360 / number,//平分角度
        unitAngle = Math.PI / 180,//1° == Math.PI / 180弧度 
        points = []
    console.log('targetPoint', targetPoint);
    console.log(`非空数组长度:${number}  detal角：${detalAngle} 半径:${radius}`);
    for (let index = 0; index < array.length; index++) {
        if (!array[index]) {
            continue
        }
        let num = (index + number - targetIndex) % number;
        console.log(`小球${index} 需要添加平均角的个数：${num}`);
        console.log(`参照小球的角度:${targetAngle}`);
        let angle = targetAngle + num * detalAngle;
        while (angle > 360) {
            angle -= 360;
        }
        console.log(`小球${index} 最终的角度：${angle}`);
        let X = radius * Math.cos(angle * unitAngle);
        let Y = radius * Math.sin(angle * unitAngle);
        let data = {
            pos: cc.v2(X, Y),
            angle: angle
        }
        // points.push(cc.v2(X, Y))
        points.push(data)
    }
    return points;
}
/**
 * 游戏结束 先刷新所有小球的位置 当最后一个小球（不在数组中的）到达圆上时再结束  要实现这个效果 则必须将原来添加的detalAngle个数都加1 且targetIndex的为1
 * @param {*} array 
 * @param {*} targetIndex 
 * @param {*} touchAngle 
 * @param {*} radius 
 * @param {*} isOver 
 */
utils.getPointsBaseTouchAngle = function (array, targetIndex, touchAngle, radius, isOver) {
    let arraylength = array.length,//
        targetAngle = touchAngle,
        number = utils.getNotNullOfArray(array).length,//非空对象个数
        detalAngle = isOver ? 360 / (number + 1) : 360 / number,//平分角度
        unitAngle = Math.PI / 180,//1° == Math.PI / 180弧度 
        points = []
    if (isOver) {
        // number++;
        arraylength++
    }
    // console.log(`非空数组长度:${number}  detal角：${detalAngle} 半径:${radius}`);
    for (let index = 0; index < arraylength; index++) {
        if (!array[index]) {
            continue
        }
        let num = (index + number - targetIndex) % number;
        // console.log('before num:', num);
        if (isOver && targetIndex == index) {//over
            num = 1;
        } else if (isOver) {
            num++
        }
        //#region 可设计结束效果  所有小球向一个地点移动
        // if (array.length == number) {//over   
        //     num = number;
        // }
        //#endregion
        // console.log(`小球${index} :${array[index] ? array[index]._instanceid : '空'} 需要添加平均角的个数：${num}`);
        // console.log(`参照小球的角度:${targetAngle}`);
        let angle = targetAngle + num * detalAngle;
        while (angle > 360) {
            angle -= 360;
        }
        // console.log(`小球${index} 最终的角度：${angle}`);
        let X = radius * Math.cos(angle * unitAngle);
        let Y = radius * Math.sin(angle * unitAngle);
        let data = {
            pos: cc.v2(X, Y),
            angle: angle
        }
        // points.push(cc.v2(X, Y))
        points.push(data)
    }
    return points;
}
/**
 * 根据点击位置换算成在圆上的位置
 * @param {*} localLoc 
 * @param {*} radius 半径
 */
utils.getPositionWithTouchPoint = function (localLoc, radius) {
    //直线斜率k
    let a = localLoc.x;
    let b = localLoc.y;
    let k = b / a

    let X = Math.abs(radius / Math.sqrt(1 + Math.pow(k, 2)));
    let Y = Math.abs(k * X)
    if (a < 0 && b > 0) {
        X = -X;
    }
    if (a > 0 && b < 0) {
        Y = -Y;
    }
    if (a < 0 && b < 0) {
        Y = -Y;
        X = -X;
    }

    return cc.v2(X, Y);
}
/**
 * 获取数组中非空元素
 * @param {*} array 
 */
utils.getNotNullOfArray = function (array) {
    if (!array) { return null }
    let count = [];
    array.forEach(element => {
        if (element) {
            count.push(element)
        }
    });
    return count;
}
/**
 * 获取圆上两点所对应的圆心角
 * @param {*} radius 
 * @param {*} pointA 
 * @param {*} pointB 
 */
utils.getdeltaAngleBetweenPoints = function (radius, pointA, pointB) {
    // console.log(`半径：${radius}  A点：${pointA}  B点：${pointB}`)
    let angleA = utils.getAngleWithTouchPoint(pointA);
    let angleB = utils.getAngleWithTouchPoint(pointB);

    // console.log(`圆心角：${Math.abs(angleA - angleB)}`)
    return Math.abs(angleA - angleB)
}

utils.getCenterPoint = function (pointA, pointB, radius) {
    let centerpoint = cc.v2((pointA.x + pointB.x) / 2, (pointA.y + pointB.y) / 2)
    // console.log('centerpoint', centerpoint);
    return utils.getPositionWithTouchPoint(centerpoint, radius);
}

