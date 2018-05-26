
/**
 * 怪物种类枚举，对应相应的技能
 */
let ENUM_MONSTER_TYPE = {
    norm: 0,//无任何技能
    merge: 1,//合并左右两边相同类型的怪物
    merge_any: 2,//合并左右两边任意的怪物
    replace: 3,//替换
    clone: 4//克隆
}
exports.ENUM_MONSTER_TYPE = ENUM_MONSTER_TYPE
/**
 * 怪物预设模板
 */
exports.MONSTER_TEMPLATE = [
    {
        name: 'H',//名字 氢
        color: '#00FFFF',//颜色
        number: 1,//初始数值
        type: ENUM_MONSTER_TYPE.norm,
        skill: null
    },
    {
        name: 'He',//名字 氦
        color: '#E100FF',//颜色
        number: 2,//初始数值
        type: ENUM_MONSTER_TYPE.norm,
        skill: null
    },
    {
        name: 'Li',//名字 锂
        color: '#E1E100',//颜色
        number: 3,//初始数值
        type: ENUM_MONSTER_TYPE.norm,
        skill: null
    },
    {
        name: 'Be',//名字 铍
        color: '#492626',//颜色
        number: 4,//初始数值
        type: ENUM_MONSTER_TYPE.norm,
        skill: null
    },
    {
        name: 'C',//名字 铍
        color: '#27E617',//颜色
        number: 5,//初始数值
        type: ENUM_MONSTER_TYPE.norm,
        skill: null
    },
    {
        name: 'P',//名字 铍
        color: '#00662D',//颜色
        number: 6,//初始数值
        type: ENUM_MONSTER_TYPE.norm,
        skill: null
    },
    {
        name: null,//合并
        color: '#FF0000',//颜色
        number: 0,//初始数值
        type: ENUM_MONSTER_TYPE.merge,
        skill: ENUM_MONSTER_TYPE.merge
    },
]

exports.default_config = {

}
/**
 * 游戏状态枚举
 */
exports.ENUM_GAME_TSATE = {
    BEGIN: 0,
    OVER: 1,
    PLAYING: 2,
}