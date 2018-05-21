//本类用于接收网络消息。
//使用示范
/*
    var na = new NetAgent(名字，用于调试);
    na.addTarget(...);
    na.addHandler(...);
    gc.net.addAgent(na);

    //
    gc.net.removeAgent(na);

    注：NetAgent可以创建若干个，并根据自己的情况进行add和remove
*/

var idbase = 0;

module.exports = NetClass;
function NetClass(name){
    this.name = name;
    this.id = idbase++;
    this.handlers = {};
    console.log('NetAgent',name,':',idbase,'has been created.');
}

NetClass.prototype.addTarget = function(target,prefix){
    if (!target) {
        return;
    }
    if(!prefix){
        prefix = 'onnet_';
    }

    for (var k in target) {
        if (k.search(prefix) == 0) {
            var event = k.substr(prefix.length);
            var fn = target[k];
            var tFunc = fn.bind(target);
            this.addHandler(event, tFunc);
        }
    }
}

NetClass.prototype.addHandler = function(msgType,func){
    this.handlers[msgType] = func;
}

//网络消息
NetClass.prototype.onMessage = function(msgType,data){
    var func = this.handlers[msgType];
    if(func){
        func(data);
    }
}