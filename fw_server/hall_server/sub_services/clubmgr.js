
var db = require('../../externals/utils/dbsync');
var userMgr = (require('../../externals/game_utils/usermgr')).getUserMgr('club');
var tokenMgr = (require("../../externals/game_utils/tokenmgr")).getTokenMgr('club');
var consts = require('../../externals/utils/consts');
var fibers = require('fibers');

//所有在线俱乐部列表
var clubs = {};
//俱乐部房间总数
var totalClubs = 0;
//在线玩家人数
var totalusers = 0;
//大厅服务器配置信息
var config = null;
//玩家所在俱乐部列表
var memberList = [];
//清除Club在内存列表
var dissolvingList = [];
//保存俱乐部聊天信息
var saveClubChats = {};
exports.saveClubChats = saveClubChats;
//系统消息：用于转发游戏结果以及其他消息
var msgList = {};
exports.msgList = msgList;

exports.setConfig = function (conf) {
    config = conf;
};
/**
 * 俱乐部房间不留存于内存，当有玩家在线时才恢复俱乐部房间
 * @param {Object} dbdata 
 */
function constructClubRoomFromDb(dbdata) {
    if (!dbdata) {
        console.log('club data is null');
        return null;
    }
    var clubInfo = {
        club_id: dbdata.club_id,
        creator: dbdata.creator,
        create_time: dbdata.create_time,
        seats: {},
    };

    clubs[dbdata.club_id] = clubInfo;
    saveClubChats[dbdata.club_id] = [];
    totalClubs++;
    return clubInfo;
};
/**
 * 进入俱乐部房间
 * @param {Object} dbdata 
 */
exports.enterClubRoom = function (data) {
    var userId = data.userid;
    var club_id = data.club_id;
    var clubInfo = exports.getClubRoom(club_id);
    if (clubInfo) {
        totalusers++;
        var data = {
            userId: userId,
            club_id: club_id,
            state: 1,//1:在线  0:下线  -1:离开  即离开当前俱乐部
            headimg: data.headimg,
            name: data.name,
        }
        memberList[userId] = data;
        clubInfo.seats[userId] = data;
        var token = tokenMgr.createToken(userId, 5000);
        var enterInfo = {
            ip: config.HALL_FOR_CLUB_IP,
            port: config.CLUB_FOR_CLIENT_PORT,
            token: token
        }
    } else {
        console.log('clubInfo is null', clubInfo);
        return null;
    }
    return enterInfo;
};
/**
 * 退出俱乐部房间 改变玩家在此俱乐部的状态
 */
exports.userStateChange = function (userId) {
    clubInfo.seats[userId].state = 0;
};

/**
 * 获取俱乐部房间信息
 * 
 */
exports.getClubRoom = function (club_id) {
    var clubInfo = clubs[club_id];
    if (!clubInfo) {
        var clubdata = db.get_club_data(club_id);
        clubInfo = constructClubRoomFromDb(clubdata[0]);
        return clubInfo;
    } else {
        return clubInfo;
    }
};
/**
 * 清理内存中俱乐部房间信息
 * 
 */
exports.deleteClubRoom = function (club_id) {
    var clubInfo = clubs[club_id];
    if (clubInfo) {
        delete clubs[club_id];
        console.log(club_id + '   is delete');
    } else {
        console.log('there is no clubinfo');
    }
};
/**
 * 当俱乐部中无人在线时，删除
 */
exports.destroy = function (club_id) {
    var roomInfo = exports.getClubRoom(club_id);
    if (roomInfo == null) {
        return;
    }
    delete clubs[club_id];
    totalClubs--;
};
/**
 * 获取玩家当前所在俱乐部
 * 
 */
exports.getUserClub = function (userId) {
    var member = memberList[userId];
    if (member != null) {
        return member.club_id;
    }
    return null;
};
/**
 * 保存俱乐部最近10条聊天消息，给新玩家同步
 */
exports.getSyncMsg = function (club_id) {
    var data = saveClubChats[club_id];
    return data ? data : null;
};

/**
 * sendRoomMsgtToClub
 * 游戏房间信息发送到聊天室
 * @param type 消息类型
 * @param sender 消息发送人id
 * @param data 发送的数据
 * @param club_id 要发送的俱乐部id
 * @param name 发送人昵称
 * @param headimg 发送人头像
 * @param roomId 房间号
 */
exports.sendRoomMsgtToClub = function (type, sender, data, name, club_id, headimg, roomId) {
    if (clubs[club_id]) {
        var result = {
            type: type,
            sender: sender,
            content: data,
            name: name,
            isCreator: clubs.creator == sender,
            time: Date.now(),
            headimg: headimg,
            roomId: roomId
        }
        msgList[club_id] = result;
        if (type != 'RoomInfoChange' && type != 'num_of_room_change') {
            saveClubChats[club_id].push(result);//保存数据用于同步
        }
        return true;
    }
    return false;
};

function update() {
    for (const club_id in msgList) {
        if (msgList.hasOwnProperty(club_id)) {
            const data = msgList[club_id];
            var club = exports.getClubRoom(club_id);
            if (club) {
                console.log('msgList', data);
                if (data.type == 'RoomInfoChange') {
                    console.log('RoomInfoChange',data);
                    userMgr.broacastInClub('roomMsg_to_club_push', [data], club, null, true);
                }else if(data.type == 'num_of_room_change'){
                    userMgr.broacastInClub('num_of_room_change_push', [data], club, null, true);
                }else {
                    console.log('chat_push',data);
                    userMgr.broacastInClub('chat_push', [data], club, null, true);
                }
                delete msgList[club_id];
            }
        }
    }
}

setInterval(update, 1000);