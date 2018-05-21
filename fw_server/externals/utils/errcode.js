//GameError构造函数
function GameError(code, msg) {
	if (code == null) {
		throw new Error('Every GMError must be assigned a code!');
	}
	this.code = code;
	this.msg = msg ? msg : '';
}

GameError.prototype.toString = function () {
	return 'GameError: [' + this.code + '] - ' + this.msg;
};

//内部函数，查找对应的错误
function _findError(errcode, errs) {
	if(errcode == null || errs == null) {
		return null;
	}

	for (var key in errs) {
		var err = errs[key];
		if (!err) {
			continue;
		}

		if (err.code == errcode) {
			return err;
		}
	}
	return null;
}

//根据错误码查找对应的错误
global.findErrorByCode = function (errcode) {
	if(errcode == null) {
		return null;
	}

	var errs  = null;
	if(errcode === 0) {
		return global.RET_OK;
	} else if(errcode >= SYS_ERR_CODE_BEGIN && errcode <= SYS_ERR_CODE_END) {
		errs = global.SYS_ERRS;
	} else if(errcode >= ACC_ERR_CODE_BEGIN && errcode <= ACC_ERR_CODE_END) {
		errs = global.ACC_ERRS;
	} else if(errcode >= HALL_ERR_CODE_BEGIN && errcode <= HALL_ERR_CODE_END) {
		errs = global.HALL_ERRS;
	} else if(errcode >= GAME_ERR_CODE_BEGIN && errcode <= GAME_ERR_CODE_END) {
		errs = global.GAME_ERRS;
	}

	return _findError(errcode, errs);
};

//成功返回码 0
global.RET_OK = new GameError(0, 'ok');

//系统错误码 1 ~ 1999
var SYS_ERR_CODE_BEGIN = 1;
var SYS_ERR_CODE_END = 1999;
var SYS_ERR_CODE_BASE = SYS_ERR_CODE_BEGIN;
global.SYS_ERRS = {
	//1 - 参数错误
	INVALID_PARAMETER: new GameError(SYS_ERR_CODE_BASE++, 'invalid parameter.'),
	//2 - 内部网络错误
	INTER_NETWORK_ERROR: new GameError(SYS_ERR_CODE_BASE++, 'internal network error.'),
};

//账号服错误码 2000 ~ 3999
var ACC_ERR_CODE_BEGIN = 2000;
var ACC_ERR_CODE_END = 3999;
var ACC_ERR_CODE_BASE = ACC_ERR_CODE_BEGIN;
global.ACC_ERRS = {
	//2000 - 账号已存在
	ACC_EXISTED: new GameError(ACC_ERR_CODE_BASE++, 'account has been existed.'),
	//2001 - 创建账号失败
	CREATE_ACC_FAILED: new GameError(ACC_ERR_CODE_BASE++, 'create account failed.'),
	//2002 - 获取账号信息失败
	GET_ACC_INFO_FAILED: new GameError(ACC_ERR_CODE_BASE++, 'get account info failed.'),
	//2003 - 获取微信token信息失败
	GET_WECHAT_TOKEN_FAILED: new GameError(ACC_ERR_CODE_BASE++, 'get wechat token failed.'),
	//2004 - 获取微信账号信息失败
	GET_WECHAT_USER_INFO_FAILED: new GameError(ACC_ERR_CODE_BASE++, 'get wechat user info failed.'),
	//2005 - 获取用户基础信息失败
	GET_USER_BASE_INFO_FAILED: new GameError(ACC_ERR_CODE_BASE++, 'get user base info failed.'),
};

//大厅服错误码 4000 ~ 5999
var HALL_ERR_CODE_BEGIN = 4000;
var HALL_ERR_CODE_END = 5999;
var HALL_ERR_CODE_BASE = HALL_ERR_CODE_BEGIN;
global.HALL_ERRS = {
	//4000 - token超时
	TOKEN_TIMEOUT: new GameError(HALL_ERR_CODE_BASE++, 'token timeout.'),
	//4001 - 已经在房间中
	USER_ALREADY_IN_ROOM: new GameError(HALL_ERR_CODE_BASE++, 'user is playing in room.'),
	//4002 - 分配游戏服务器失败
	ASSIGN_GAME_SERVER_FAILED: new GameError(HALL_ERR_CODE_BASE++, 'assign game server failed.'),
	//4003 - 获取钻石信息失败
	GET_GEMS_INFO_FAILED: new GameError(HALL_ERR_CODE_BASE++, 'get gems info failed.'),
	//4004 - 获取游戏服务器地址失败
	GET_SERVER_ADDR_FAILED: new GameError(HALL_ERR_CODE_BASE++, 'get game server address failed.'),
	//4005 - 获取消息失败
	GET_MESSAGE_FAILED: new GameError(HALL_ERR_CODE_BASE++, 'get message failed.'),
	//4006 - GSID冲突
	GSID_CONFLICTED: new GameError(HALL_ERR_CODE_BASE++, 'gsid conflicted.'),
	//4007 - 不能绑定自己
	INVITOR_CANT_BIND_SELF: new GameError(HALL_ERR_CODE_BASE++, 'invitor can\'t bind self.'),
	//4008 - 已经绑定了邀请者
	INVITOR_HAS_BEEN_BOUND: new GameError(HALL_ERR_CODE_BASE++, 'invitor has been bound.'),
	//4009 - 推荐者不存在
	INVALID_INVITOR: new GameError(HALL_ERR_CODE_BASE++, 'invitor is not existed.'),
	//4010 - 已经绑定了代理
	HAS_BOUND_AGENT: new GameError(HALL_ERR_CODE_BASE++, 'has bound agent.'),
	//4011 - 绑定代理失败
	BIND_AGENT_FAILED: new GameError(HALL_ERR_CODE_BASE++, 'bind agent failed.'),
	//4012 - 充值添加游戏币失败
	PAY_ADD_GEMS: new GameError(HALL_ERR_CODE_BASE++, '充值添加游戏币失败 failed.'),
};

//游戏服错误码 6000 ~ 9999
var GAME_ERR_CODE_BEGIN = 6000;
var GAME_ERR_CODE_END = 9999;
var GAME_ERR_CODE_BASE = GAME_ERR_CODE_BEGIN;
global.GAME_ERRS = {
	//6000 - sign验证失败
	CHECK_SIGN_FAILED: new GameError(GAME_ERR_CODE_BASE++, 'check sign failed.'),
	//6001 - 添加钻石失败
	ADD_GEMS_FAILED: new GameError(GAME_ERR_CODE_BASE++, 'add gems failed.'),
	//6002 - 不支持的游戏类型
	UNSUPPORTED_GAME_TYPE: new GameError(GAME_ERR_CODE_BASE++, 'unsupported game type.'),
	//6003 - 创建房间失败
	CREATE_ROOM_FAILED: new GameError(GAME_ERR_CODE_BASE++, 'create room failed.'),
	//6004 - 钻石不足
	GEMS_NOT_ENOUGH: new GameError(GAME_ERR_CODE_BASE++, 'gems are not enough.'),
	//6005 - 金币不足
	COINS_NOT_ENOUGH: new GameError(GAME_ERR_CODE_BASE++, 'coins are not enough.'),
	//6006 - 房间已满
	ROOM_IS_FULL: new GameError(GAME_ERR_CODE_BASE++, 'room is full.'),
	//6007 - 房间不存在
	ROOM_IS_NOT_EXISTED: new GameError(GAME_ERR_CODE_BASE++, 'room is not existed.'),
	//6008 - 获取房间信息失败
	GET_ROOM_INFO_FAILED: new GameError(GAME_ERR_CODE_BASE++, 'get room info failed.'),
	//6009 - 获取游戏配置信息失败
	GET_GAME_CONFIG_FAILED: new GameError(GAME_ERR_CODE_BASE++, 'get game config failed.'),
	//6010 - 游戏类型或者模式不匹配
	UNMATCH_GAME_TYPE_OR_MOD: new GameError(GAME_ERR_CODE_BASE++, 'unmatch game type or mod.'),
	//6011 - 房间限制相同IP
	IP_STRICT: new GameError(GAME_ERR_CODE_BASE++, 'same ip in ipstricted room.'),
	//6012 - GPS限制
	GPS_STRICT: new GameError(GAME_ERR_CODE_BASE++, 'gps strict.'),
	//6013 - GPS数据错误
	GPS_INVALID: new GameError(GAME_ERR_CODE_BASE++, 'gps data invalid.'),
	//6014 - 不支持的支付方式
	UNSUPPORT_PAY_WAY: new GameError(GAME_ERR_CODE_BASE++, 'unsupport pay way.'),
	//6015 - 获取商店信息失败
	GET_SHOP_DATA_FAILED: new GameError(GAME_ERR_CODE_BASE++, 'get shop data failed.'),
	//6015 - 获取商品信息失败
	GET_ITEM_DATA_FAILED: new GameError(GAME_ERR_CODE_BASE++, 'get item data failed.'),
	//6016 - 创建支付记录失败
	CREATE_PAY_RECORD_FAILED: new GameError(GAME_ERR_CODE_BASE++, 'create pay record failed.'),
	//6017 - 获取支付信息失败
	GET_PAY_RECORD_FAILED: new GameError(GAME_ERR_CODE_BASE++, 'get pay record failed.'),
	//6018 - 商品支付方式错误
	INCORRECT_ITEM_PRICE_TYPE: new GameError(GAME_ERR_CODE_BASE++, 'create pay record failed.'),
	//6019 - 重复赠送钻石
	DUPLICATE_GIVE_GEMS: new GameError(GAME_ERR_CODE_BASE++, 'duplicate give gems.'),
	//6020 - 赠送钻石失败
	GIVE_FAILED: new GameError(GAME_ERR_CODE_BASE++, 'give gems failed.'),
	//6021 - 获取流水记录失败
	GET_PAY_RECORD: new GameError(GAME_ERR_CODE_BASE++, 'give pay record failed.'),
	//6023 - 局数大于0 游戏已开始不能加入
	GET_JUSHUDAYUZREO_RECORD: new GameError(GAME_ERR_CODE_BASE++, 'jushu > 0 jia ru failed.'),
};