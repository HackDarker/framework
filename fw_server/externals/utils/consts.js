//游戏类型枚举
var EGameType = {
    PTDDZ: "0010001",    //普通斗地主
    SRDDZ: "0010002",    //四人斗地主
    DHT: "0020001",     //余姚麻将
    THIRTEEN: "0030001", //十三水
    NIUNIU: "0040001", //牛牛
};

//游戏模式枚举
var EGameMode = {
    //房卡模式
    NORM: 'norm',
    //金币模式
    GOLD: 'gold'
};

exports.GameType = EGameType;
exports.GameMode = EGameMode;

//服务器专用映射表，无需与客户端同步
//////////////////////////////////////
var EGameID2Type = {
    "0010001": 'ptddz',   //普通斗地主
    "0010002": 'srddz',   //普通斗地主
    "0020001": 'dht',    //余姚麻将
    "0030001": 'thirteen',//十三水
    "0040001": 'niuniu',//牛牛
};
/**
 * 所有游戏类型,
 * 用于创建房间时检索rooms各表中roomid是否唯一，
 * 用于加入房间时，通过roomid获取游戏房间信息
 * 
 * 以后加入房间的唯一标志是roomid
 * 因为前端加入房间的界面只有一个,只知道roomid无法知道是哪个游戏
 */
var EAllGameType = [
    'ptddz',   //普通斗地主
    'srddz',   //四人斗地主
    'dht',    //余姚麻将
    'thirteen',//十三水
    'niuniu',//牛牛
];


//游戏房间状态
var ERoomState = {
    NOT_START: 0,        //未开始
    PLAYING: 1,          //进行中
    WAITING_RENEW: 2,    //可续局
};

//房间续费状态
var ERoomRenewState = {
    UNACTIVE: 0, //未激活状态，房间内所有玩家都未选择续费
    ACTIVE: 1,   //激活状态，房间内某一玩家选择了续费
}

//玩家现金变更原因枚举
var ECashChangeResons = {
    //新用户赠送
    ADD_NEW_USER: '+ new user',
    //玩家充值
    ADD_USER_RECHARGING: '+ user recharge',
    //运营商后台添加
    ADD_DEALER: '+ dealer',
    //分享游戏赠送
    ADD_SHARE_GAME: '+ share game',
    //绑定邀请者获得，参数邀请者ID
    ADD_BIND_INVITOR: '+ bind the invitor {0}',
    //被绑定邀请码，被绑定者ID
    BOUND_BY_USER: '+ binded by {0}',
    //游戏中获取
    ADD_IN_GAME: '+ earn in game',
    //钻石购买
    ADD_EXCHANGE_GEMS: '+ bought by gems',
    //取消房间退回
    RETURN_DISSOLVE_ROOM: '+ return by dissolving the room {0}',
    //开房间扣除，参数房间ID
    COST_CREATE_ROOM: '- create the room {0}',
    //续费房间扣除，参数房间ID
    COST_RENEW_ROOM: '- renew the room {0}',
    //购买金币扣除，参数购买金币的数量
    COST_BUY_COIN: '- buy coins {0}',
    //游戏中扣除
    COST_IN_GAME: '- cost in game',
    //赠送钻石，参数，接受者的ID
    COST_GIVE_GEMS: '- give gems to {0}',
    //收到赠送的钻石，参数：赠送者ID
    ADD_GAVE_GEMS: '+ gave gems by {0}',
};

exports.GameID2Type = EGameID2Type;
exports.AllGameType = EAllGameType;
exports.RoomState = ERoomState;
exports.RoomRenewState = ERoomRenewState;
exports.CashChangeResons = ECashChangeResons;