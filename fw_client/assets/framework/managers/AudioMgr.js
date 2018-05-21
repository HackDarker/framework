module.exports = ModuleClass;

function getRealBGMVolume(){
    var audioMgr = gc.audio;
    //如果当前标记为静音
    var extraFactor = 1.0;
    for(var k in audioMgr.bgmMuteFlags){
        if(audioMgr.bgmMuteFlags[k]){
            extraFactor = 0.0;
        }
    }

    var volume = audioMgr.bgmVolume * audioMgr.bgmVolumeFactor * extraFactor;
    return volume;
}


function getRealSFXVolume(){
    var audioMgr = gc.audio;
    //如果当前标记为静音
    var extraFactor = 1.0;
    for(var k in audioMgr.sfxMuteFlags){
        if(audioMgr.sfxMuteFlags[k]){
            extraFactor = 0.0;
        }
    }

    var volume = audioMgr.sfxVolume * extraFactor;
    return volume;
}

const KEY_BGM = 'bgmVolume';
const KEY_SFX = 'sfxVolume'


function ModuleClass(){

}

ModuleClass.prototype.init = function () {

    this.bgmVolume = 1.0;
    this.sfxVolume = 1.0;

    this.bgmAudioID = -1;

    this.bgmVolumeFactor = 0.3;

    this.currentID = -1;

    this.bgmMuteFlags = {};
    this.sfxMuteFlags = {};

    this.sfxMap = {};

    this.oldAudioUrl = null;

    var t = cc.sys.localStorage.getItem(KEY_BGM);
    if (t != null) {
        this.bgmVolume = parseFloat(t);
    }

    var t = cc.sys.localStorage.getItem(KEY_SFX);
    if (t != null) {
        this.sfxVolume = parseFloat(t);
    }


    cc.game.on(cc.game.EVENT_HIDE, function () {
        console.log("cc.audioEngine.pauseAll");
        cc.audioEngine.pauseAll();
    });
    cc.game.on(cc.game.EVENT_SHOW, function () {
        console.log("cc.audioEngine.resumeAll");
        cc.audioEngine.resumeAll();
    });
}

// called every frame, uncomment this function to activate update callback
// update = function (dt) {

// },

ModuleClass.prototype.getUrl = function (path, url) {
    if (path.charAt(path.length - 1) !== "/") {
        path = path + "/";
    }
    return cc.url.raw(path + url);
}

ModuleClass.prototype.playBGM = function (path, url) {

    var tSelf = gc.audio;
    var audioUrl = tSelf.getUrl(path, url);

    //背景音乐不需要重复播放
    if(this.oldAudioUrl == audioUrl){
        return;
    }
    this.oldAudioUrl = audioUrl;
    
    console.log(" play bgm : " + audioUrl);

    //停止旧的bgm
    if (tSelf.bgmAudioID >= 0) {
        cc.audioEngine.stop(tSelf.bgmAudioID);
    }
    var volume = getRealBGMVolume();
    tSelf.bgmAudioID = cc.audioEngine.play(audioUrl, true, volume);
    cc.audioEngine.setVolume(tSelf.bgmAudioID,volume);
}

ModuleClass.prototype.stopBGM = function(){
    var tSelf = gc.audio;
    if (tSelf.bgmAudioID >= 0) {
        cc.audioEngine.stop(tSelf.bgmAudioID);
    }
}

ModuleClass.prototype.playSFX = function (path, url, userID) {
    var fnPlaySFX = function(path,url){
        var tSelf = gc.audio;
        var audioUrl = tSelf.getUrl(path, url);
        var volume = getRealSFXVolume();
        var audioId = cc.audioEngine.play(audioUrl, false, tSelf.sfxVolume);
        cc.audioEngine.setVolume(audioId,volume);
        cc.audioEngine.setFinishCallback(audioId,function(){
            var id = this;
            delete gc.audio.sfxMap[id];
        }.bind(audioId));
        gc.audio.sfxMap[audioId] = audioId;
    }

    if (!userID) {
        fnPlaySFX(path, url);
    }
    else {
        gc.player.callPlayerInfo(userID, function(userID, playerInfo){
            var tSex = "";
            switch (playerInfo.sex) {
                case 1:
                    tSex = "male/";
                    break;
                default:
                    tSex = "female/";
                    break;
            }
            path += tSex;
            fnPlaySFX(path,url);
        });
    }
}

function refreshSFXVolume(){
    var volume = getRealSFXVolume();
    for(var k in gc.audio.sfxMap){
        var id = gc.audio.sfxMap[k];
        cc.audioEngine.setVolume(id,volume);
    }
}

function refreshBGMVolume(){
    if(gc.audio.bgmAudioID ){
        var volume = getRealBGMVolume();
        cc.audioEngine.setVolume(gc.audio.bgmAudioID,volume);
    }
}

ModuleClass.prototype.setSFXVolume = function (v) {
    var tSelf = gc.audio;
    if (tSelf.sfxVolume != v) {
        cc.sys.localStorage.setItem(KEY_SFX, v);
        tSelf.sfxVolume = v;
    }
    refreshSFXVolume();
}

ModuleClass.prototype.setBGMVolume = function (v, force) {
    if(this.bgmVolume != v){
        cc.sys.localStorage.setItem(KEY_BGM, v);
        this.bgmVolume = v;
    }
    refreshBGMVolume();
}

ModuleClass.prototype.muteBGM = function(reason){
    this.bgmMuteFlags[reason] = true;
    refreshBGMVolume();
}

ModuleClass.prototype.unmuteBGM = function(reason){
    delete this.bgmMuteFlags[reason];
    refreshBGMVolume();
}

ModuleClass.prototype.muteSFX = function(reason){
    this.sfxMuteFlags[reason] = true;
    refreshSFXVolume();
}

ModuleClass.prototype.unmuteSFX = function(reason){
    delete this.sfxMuteFlags[reason];
    refreshSFXVolume();
}

ModuleClass.prototype.mute = function(reason){
    this.muteBGM(reason);
    this.muteSFX(reason);
}

ModuleClass.prototype.unmute = function(reason){
    this.unmuteBGM(reason);
    this.unmuteSFX(reason);
}

ModuleClass.prototype.stopAll = function(){
    cc.audioEngine.stopAll();
    this.init();
}

ModuleClass.prototype.pauseAll = function () {
    cc.audioEngine.pauseAll();
}

ModuleClass.prototype.resumeAll = function () {
    cc.audioEngine.resumeAll();
}