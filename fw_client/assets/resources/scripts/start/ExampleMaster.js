//Master用于控制一个子游戏的入口和出口
//大厅到子游戏的切换，必须经过Master的enter和exit
//在enter里面进行自己的网络，显示，特殊用户模块的初始化
//有exit里面，进行相关的资源清除操作。
//创建一个子游戏的时候，请复制此内容。 可以快速创建
module.exports = MasterClass;
function MasterClass(){};

MasterClass.prototype.enter = function(params){
};

MasterClass.prototype.update = function(){

}

MasterClass.prototype.exit = function(){

}