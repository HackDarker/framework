var crypto = require('../utils/crypto');

function usermgr() {
    this.userList = {};
    this.userOnline = 0;
}

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

usermgr.prototype.bind = function (userId, socket) {
    this.userList[userId] = socket;
    this.userOnline++;
};

usermgr.prototype.del = function (userId, socket) {
    delete this.userList[userId];
    this.userOnline--;
};

usermgr.prototype.get = function (userId) {
    return this.userList[userId];
};

usermgr.prototype.isOnline = function (userId) {
    var data = this.userList[userId];
    if (data != null) {
        return true;
    }
    return false;
};

usermgr.prototype.getOnlineCount = function () {
    return this.userOnline;
}

usermgr.prototype.sendMsg = function (userId, event, msgdata) {
    console.log(event);
    var userInfo = this.userList[userId];
    if (userInfo == null) {
        return;
    }
    var socket = userInfo;
    if (socket == null) {
        return;
    }

    emitSocketEvent(socket, event, msgdata);
};

usermgr.prototype.kickAllInRoom = function (room) {
    if (room == null) {
        return;
    }
    for (var i = 0; i < room.seats.length; ++i) {
        var rs = room.seats[i];
        //如果不需要发给发送方，则跳过
        if (rs.userId > 0) {
            var socket = this.userList[rs.userId];
            if (socket != null) {
                this.del(rs.userId);
                console.log(rs.userId);
                socket.disconnect();
            }
        }
    }
};

usermgr.prototype.kickOne = function (userId) { //余姚
    var socket = this.userList[userId];
    console.log('kickOne', userId);
    if (socket != null) {
        socket.emit('exit_result');
        this.del(userId);
        socket.disconnect();
    }
};

usermgr.prototype.kickSeatInRoom = function (room, seatIndex) {
    if (room == null || seatIndex == null) {
        return;
    }

    var rs = room.seats[seatIndex];

    if (!rs) {
        return;
    }

    var socket = this.userList[rs.userId];
    if (socket != null) {
        this.del(rs.userId);
        socket.disconnect();
    }
};

usermgr.prototype.broacastInRoom = function (event, data, room, sender, includingSender) {
    if (room == null) {
        return;
    }

    for (var i = 0; i < room.seats.length; ++i) {
        var rs = room.seats[i];

        //如果不需要发给发送方，则跳过
        if (rs.userId == sender && includingSender != true) {
            continue;
        }
        var socket = this.userList[rs.userId];
        if (socket != null) {
            emitSocketEvent(socket, event, data);
        }
    }
};
usermgr.prototype.broacastInClub = function (event, data, room, sender, includingSender) {
    if (room == null) {
        return;
    }
    for (var k in room.seats) {
        var rs = room.seats[k];
        // console.log(rs);
        //如果不需要发给发送方，则跳过
        if (rs.userId == sender && includingSender != true) {
            continue;
        }
        var socket = this.userList[rs.userId];
        if (socket != null) {
            emitSocketEvent(socket, event, data);
        }
    }
};

//比赛场--start
// usermgr.prototype.kickAllInMatch = function (matchId) {
//     if (matchId == null) {
//         return;
//     }

//     let matchInfo = matchMgr.getMatchMsg(matchId);
//     if (matchInfo == null) {
//         return;
//     }

//     let seatAll = matchMgr.getMatchAllSeat(matchId)
//     for (let i in seatAll) {
//         let rs = seatAll[i]
//         if (rs > 0) {
//             let socket = this.userList[rs];
//             if (socket != null) {
//                 this.del(rs);
//                 socket.disconnect();
//             }
//         }
//     }
// };

// usermgr.prototype.broacastMatch = function (event, data, matchId, userId, includingUserId, callback) {
//     var matchSeat = matchMgr.getMatchAllSeat(matchId);
//     if (matchSeat == null) {
//         return;
//     }
//     let num = 0
//     for (let i in matchSeat) {
//         num++        
//         let rs = matchSeat[i]
//         if (rs == userId && !includingUserId) {
//             continue
//         }
//         let socket = this.userList[rs];
//         if (socket != null) {
//             socket.emit(event, data);
//             console.log(`${event}通知${rs}成功`)
//         }
//         if (num === matchSeat.length) {
//             console.log(matchSeat.length, num)
//             if (callback) {
//                 callback()                
//             }
//         }
//     }
// };
//比赛场--end

var userMgrDict = {};

function getUserMgr(gametype) {
    if (!userMgrDict[gametype]) {
        userMgrDict[gametype] = new usermgr();
    }

    return userMgrDict[gametype];
}

function destroyUserMgr(gametype) {
    if (userMgrDict[gametype]) {
        delete userMgrDict[gametype];
    }
    userMgrDict[gametype] = null;
}

exports.getUserMgr = getUserMgr;
exports.destroyUserMgr = destroyUserMgr;