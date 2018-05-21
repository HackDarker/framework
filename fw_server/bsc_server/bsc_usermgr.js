var crypto = require('../externals/utils/crypto');
var matchMgr = require('./matchmgr');//比赛场

var userList = {};
var userOnline = 0;

function emitSocketEvent(socket, event, data) {
    if (!socket) {
        return;
    }
    // console.log('usermgr emit socket event [' + event + ']');

    var senddata = { event: event, data: data };
    var sendstr = JSON.stringify(senddata);
    if (global.GAME_AES_KEY != null) {
        sendstr = crypto.AesEncrypt(sendstr, global.GAME_AES_KEY, 128);
    }
    socket.emit('gamemsg', { msg: sendstr });
}

exports.bind = function (userId, socket) {
    userList[userId] = socket;
    userOnline++;
};

exports.del = function (userId, socket) {
    delete userList[userId];
    userOnline--;
};

exports.get = function (userId) {
    return userList[userId];
};

exports.isOnline = function (userId) {
    var data = userList[userId];
    if (data != null) {
        return true;
    }
    return false;
};

exports.getOnlineCount = function () {
    return userOnline;
}

exports.sendMsg = function (userId, event, msgdata) {
    console.log(event);
    var socket = userList[userId];
    if (socket == null) {
        return;
    }

    emitSocketEvent(socket, event, msgdata);
};

exports.kickOne = function(userId) {
    var socket = userList[userId];
    if(socket != null){
        socket.emit('exit_result');
        socket.disconnect();
    }
};

//比赛场--start
exports.kickAllInMatch = function (matchId) {
    if (matchId == null) {
        return;
    }

    let matchInfo = matchMgr.getMatchMsg(matchId);
    if (matchInfo == null) {
        return;
    }

    let seatAll = matchMgr.getMatchAllSeat(matchId)
    for (let i in seatAll) {
        let rs = seatAll[i]
        if (rs > 0) {
            let socket = userList[rs];
            if (socket != null) {
                this.del(rs);
                socket.disconnect();
            }
        }
    }
};

exports.broacastMatch = function (event, data, matchId, userId, includingUserId, callback) {
    var matchSeat = matchMgr.getMatchAllSeat(matchId);
    if (matchSeat == null) {
        return;
    }
    let num = 0
    for (let i in matchSeat) {
        num++        
        let rs = matchSeat[i]
        if (rs == userId && !includingUserId) {
            continue
        }
        let socket = userList[rs];
        if (socket != null) {
           // socket.emit(event, data);
            emitSocketEvent(socket, event, data);
            console.log(`${event}通知${rs}成功`)
        }
        if (num === matchSeat.length) {
            console.log(matchSeat.length, num)
            if (callback) {
                callback()                
            }
        }
    }
};
//比赛场--end
