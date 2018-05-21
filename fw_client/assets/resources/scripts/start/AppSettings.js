var crypto = {
    HTTP_AES_KEY:null,//"hTtp^@AES&*kEy";
    GAME_AES_KEY:null,//"GaMe;$AES#!KeY";
}

//每一个MASTER，作为一个主场景，或者子游戏的主逻辑。负责进与出的唯一路径。
//每一个MASTER必须实现 enter,update,exit

var masters = {};

//登陆
masters.preloading = {
    type:'common', //类别 common:普通 subgame子游戏
    name:'预加载', //拿来看的
    master_script:'PreLoadingMaster', //主逻辑
    entry_scene:null, //入口场景，如果有，会在切换主逻辑的时候自动加载
}

//登陆
masters.login = {
    type:'common',
    name:'登陆',
    master_script:'LoginMaster',
    entry_scene:'login',
}

//创建角色
masters.create_role = {
    type:'common',
    name:'创建角色',
    master_script:'CreateRoleMaster',
    entry_scene:'createrole',
}

//大厅
masters.lobby_platform = {
    type:'common',
    name:'平台大厅',
    master_script:'LobbyMaster',
    entry_scene:'lobby_platform',
}

//子游戏
masters['0010001'] = {
    enable:true,
    type:'subgame',
    name: "斗地主", 
    master_script:'subgame_master_0010001',
    entry_scene:'hall_0010001',
    game_scene:'game_0010001',
    folder:'ddz_0010001',
}

masters['0020001'] = {
    enable:true,
    type:'subgame',
    name: "麻将", 
    master_script:'subgame_master_0020001',
    entry_scene:'hall_0020001',
    game_scene:'game_0020001',
    folder:'mj_0020001',
}

masters['0040002'] = {
    enable:true,
    type:'subgame',
    name: "牛牛", 
    master_script:'subgame_master_0040002',
    entry_scene:'hall_0040002',
    game_scene:'game_0040002',
    folder:'niuniu_0040002',
}

masters['0030001'] = {
    enable:true,
    type:'subgame',
    name: "十三水", 
    master_script:'subgame_master_0030001',
    entry_scene:'hall_0030001',
    game_scene:'game_0030001',
    folder:'thirteen_0030001',
}

masters['0110001'] = {
    enable:true,
    type:'subgame',
    name: "诈金花", 
    master_script:'subgame_master_0110001',
    entry_scene:'hall_0110001',
    game_scene:'game_0110001',
    folder:'zhajinhua_0110001',
}

masters['1000001'] = {
    enable:true,
    type:'subgame',
    name: "五子棋", 
    master_script:'subgame_master_1000001',
    //entry_scene:'game_0020001',
    game_scene:'game_1000001',
    folder:'wuziqi_1000001',
}

var settings = {};
settings.masters = masters;
settings.crypto = crypto;

module.exports = settings;