var fibers = require('fibers');

var i = 0;
global.sleep = function(ms){
    var f = fibers.current;
    setTimeout(function(){
        f.run();
    },ms);
    fibers.yield();
    return;
};