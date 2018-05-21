var  io = require('socket.io-client');
var socket = io.connect('192.168.1.33:10020');
socket.on('connect', function(){
    console.log('connect');
});