/** 大厅的信息 */
// exports.E_PLATFORM_INFO = require("PlatformConfig").platformConfig.platformInfo;

// /** 大厅的子游戏列表 */
// exports.E_SUB_GAME_LIST = require("PlatformConfig").platformConfig.subGameArray;

/** 游戏模式 */
exports.E_GAME_MODE = {
    /** 钻石模式 */
    MODE_CARD: "norm",
    /** 金币模式 */
    MODE_GOLD: "gold",
    /** 比赛模式 */
    MODE_MATCH: "match",
}

/** 设备GPS当前状态 */
exports.E_GPS_STATUS = {
    /**GPS可用 */
    AVAILABLE: 0x2,                       //GPS可用
    /**GPS暂停服务 */
    TEMPORARILY_UNAVAILABLE: 0x1,         //GPS暂停服务
    /**GPS在服务区外 */
    OUT_OF_SERVICE: 0x0,                  //GPS在服务区外
};

/** 设备GPS来源 */
exports.E_GPS_PROVIDER = {
    /**定位信息的获取方式——gps */
    GPS: "gps",                       //定位信息的获取方式——gps
    /**定位信息的获取方式——网络 */
    NETWORK: "network",               //定位信息的获取方式——网络
    /**定位信息的获取方式——最后一次的正常定位 */
    PASSIVE: "passive",               //定位信息的获取方式——最后一次的正常定位
};

/** 百度GPS状态 */
exports.E_GPS_BAIDU_LOCATION_TYPE = {
    /**百度 gps定位 */
    GPS: 0x3d,                     //百度 gps定位
    /**百度 net定位 */
    NET: 0xa1,                     //百度 net定位
    /**百度 定位缓存 */
    TEMP: 0x41,                    //百度 定位缓存
    /**百度 离线定位 */
    OFF_LINE: 0x42,                //百度 离线定位
    /**百度 服务器错误 */
    SERVER_ERROR: 0xa7,            //百度 服务器错误
    /**百度 网络有问题 */
    NET_ERROR: 0x3f,               //百度 网络有问题
    /**百度 无效定位 */
    CRITERIA_EXCEPTION: 0x3e,      //百度 无效定位
};

/** 信息类型 */
exports.E_MESSAGE_TYPE = {

};

/** 默认信息 */
exports.E_DEFAULT_SERVER_MESSAGE = {

};

/** 设备权限 */
exports.E_PERMISSION = {
    /**GPS权限 */
    GPS: "gps",
    /**录音权限 */
    RECORD: "record",
    /**网络权限 */
    NET: "net",
};

/** 分享的类型 */
exports.E_SHARE_TYPE = {
    HAO_YOU: 0,
    PENG_YOU_QUAN: 1,
}

/** 付款类型 */
exports.E_PAY_TYPE = {
    ALIPAY: "alipay",       //支付宝支付
    WECHAT: "wechat",       //微信支付
}

/** 花费类型 */
exports.E_PRICE_TYPE = {
    COIN: 1,                //金币
    GEM: 2,                 //钻石
    RMB: 3,                 //人民币
}

/** 花费名字 */
exports.E_PRICE_NAME = {
    "1": "金币",                //金币
    "2": "钻石",                 //钻石
    "3": "元",                 //人民币
}

/** 获取错误码对应信息 */
exports.GET_ERROR_DESC = function (errcode) {
    var content = "";
    switch (errcode) {
        case 1:
            content = "参数错误!";
            break;
        case 2:
            content = "内部网络错误!";
            break;
        case 4000:
            content = "token超时";
            break;
        case 4001:
            content = "已经在房间中";
            break;
        case 4002:
            content = "分配游戏服务器失败";
            break;
        case 4003:
            content = "获取钻石信息失败";
            break;
        case 40004:
            content = "获取游戏服务器地址失败";
            break;
        case 4005:
            content = "取消消息失败";
            break;
        case 6000:
            content = "sign验证失败";
            break;
        case 6002:
            content = "不支持的游戏类型!";
            break;
        case 6003:
            content = "创建房间失败!";
            break;
        case 6004:
            content = "钻石不足，加入房间失败!";
            break;
        case 6005:
            content = "金币不足";
            break;
        case 6006:
            content = "房间[{0}]已满!";
            break;
        case 6007:
            content = '房间[{0}]不存在，\n请重新输入!';
            break;
        case 6008:
            content = '获取房间数据失败!';
            break;
        case 6009:
            content = '获取游戏配置文件失败!';
            break;
        case 6010:
            content = '游戏类型或者模式不匹配!';
            break;
        default:
            cc.info("creator info", errcode);
            content = "" + errcode;
            break;
    }
    return content;
}