//加载错误码
require('../externals/utils/errcode');
var configs = require(process.argv[2]);
var config = configs.bsc_server_conf();

//初始化加密key
global.HTTP_AES_KEY = configs.HTTP_AES_KEY;
global.GAME_AES_KEY = configs.GAME_AES_KEY;

var db = require('../externals/utils/dbsync');
db.init(configs.mysql_conf());

//开启http服务
var http_service = require("./http_service");
http_service.start(config);

//开启比赛服
var matchmgr = require('./matchmgr');
matchmgr.setConfig(config,configs);

//开启比赛场socket
var match_socket = require("./match_socket");//比赛场服务
match_socket.start(config);

