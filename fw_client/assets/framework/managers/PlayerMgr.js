module.exports = ModuleClass;
function ModuleClass(){
    this.playerInfoMap = {};
};

//var playerInfoMap = {};

ModuleClass.prototype.init = function () {
    
}

// called every frame, uncomment this function to activate update callback
// update: function (dt) {

// },

//callback  参数为 (userID,playerInfo)
//userID    角色ID
//callback  回调函数 （gc.utils.struct_Callback() 或 function） (最后两个参数为参数为 userid ,{userid: 角色ID, name: 角色名字, sex: 角色姓名, url: 角色头像路径, })
//return true有值 false无值
ModuleClass.prototype.callPlayerInfo = function (userid, callback) {
    if (!this.playerInfoMap) {
        this.playerInfoMap = {};
    }

    var self = this;
    var info;
    var url = null;
    if (!gc.online) {
        info = {
            userid: userid,
            name: "name" + userid,
            sex: userid % 2,
            url: url,
        }
        this.playerInfoMap[userid] = info;
        gc.utils.exeCallback(callback, userid, this.playerInfoMap[userid]);
        return true;
    }

    if (this.playerInfoMap[userid] != null) {
        gc.utils.exeCallback(callback, userid, this.playerInfoMap[userid]);
        return true;
    }

    gc.http.sendRequest('/base_info', { userid: userid }, function (ret) {
        if (ret.headimgurl) {
            url = ret.headimgurl;
        }
        info = {
            userid: userid,
            name: ret.name,
            sex: ret.sex,
            url: url,
        }
        self.playerInfoMap[userid] = info;
        gc.utils.exeCallback(callback, userid, info);
        // callback(userid, info);

    }, gc.http.master_url);
    return false;
}

ModuleClass.prototype.clearAllInfo = function () {
    this.playerInfoMap = null;
}
