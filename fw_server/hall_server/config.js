var config = {
    //每天分享的钻石获取
    share_bonus_gems:3,
    //是否可以分享朋友圈
    share_pyq:true,
    //是否可以分享好友
    share_haoyou:false,
};

exports.config = config;

//玩家现金变更原因枚举
exports.CASH_CHANGE_RESONS = {
    //新用户赠送
    ADD_NEW_USER: '新玩家奖励',
    //玩家充值
    ADD_USER_RECHARGING: '玩家充值',
    //运营商后台添加
    ADD_DEALER: '代理[{0}]',
    //管理后台添加
    ADD_BY_ADMIN: '后台管理[{0}]',
    //分享游戏赠送
    ADD_SHARE_GAME: '分享游戏',
    //绑定邀请者获得，参数邀请者ID
    ADD_BIND_INVITOR: '绑定邀请者[{0}]',
    //绑定代理获得，代理ID
    ADD_BIND_DEALER: '绑定代理[{0}]',
    //游戏中获取
    ADD_IN_GAME: '游戏中获得',
    //钻石购买
    ADD_EXCHANGE_GEMS: '钻石兑换',
    //每日签到
    ADD_BY_SIGN: '每日签到',
    //幸运转盘
    ADD_BY_LUCKY: '幸运转盘获得',
    //取消房间退回
    RETURN_DISSOLVE_ROOM: '解散房间[{0}]返还',
    //幸运转盘返还
    RETURN_LUCKY: '幸运转盘返还',
    //开房间扣除，参数房间ID
    COST_CREATE_ROOM: '创建房间[{0}]',
    // 加入AA房间扣费
    COST_JOIN_AA_ROOM: '加入AA房间[{0}]',
    //购买金币扣除，参数购买金币的数量
    COST_BUY_COIN: '购买{0}金币',
    //游戏中扣除
    COST_IN_GAME: '游戏中消耗',
    //幸运转盘
    COST_BY_LUKY: '幸运转盘消耗',
    //互动表情消耗
    COST_BY_INTER_EMOJI: '互动表情',
};