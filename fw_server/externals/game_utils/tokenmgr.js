var crypto = require("../utils/crypto");

function tokenmgr() {
	this.tokens = {};
	this.users = {};
}

tokenmgr.prototype.createToken = function (userId, lifeTime) {
	var token = this.users[userId];
	if (token != null) {
		this.delToken(token);
	}

	var time = Date.now();
	token = crypto.md5(userId + "!@#$%^&" + time);
	this.tokens[token] = {
		userId: userId,
		time: time,
		lifeTime: lifeTime
	};
	this.users[userId] = token;
	return token;
};

tokenmgr.prototype.getToken = function (userId) {
	return this.users[userId];
};

tokenmgr.prototype.getUserID = function (token) {
	return this.tokens[token].userId;
};

tokenmgr.prototype.isTokenValid = function (token) {
	var info = this.tokens[token];
	if (info == null) {
		return false;
	}
	if (info.time + info.lifetime < Date.now()) {
		return false;
	}
	return true;
};

tokenmgr.prototype.delToken = function (token) {
	var info = this.tokens[token];
	if (info != null) {
		this.tokens[token] = null;
		this.users[info.userId] = null;
	}
};

var tokenMgrDict = {};

function getTokenMgr(gametype) {
    if(!tokenMgrDict[gametype]) {
        tokenMgrDict[gametype] = new tokenmgr();
    }

    return tokenMgrDict[gametype];
}

function destroyTokenMgr(gametype) {
    if(tokenMgrDict[gametype]) {
        delete tokenMgrDict[gametype];
    }
    tokenMgrDict[gametype] = null;
}

exports.getTokenMgr = getTokenMgr;
exports.destroyTokenMgr = destroyTokenMgr;