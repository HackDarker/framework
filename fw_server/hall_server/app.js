//加载错误码
require('../externals/utils/errcode');
var configs = require(process.argv[2]);
var config = configs.hall_server_conf();

//初始化加密key
global.HTTP_AES_KEY = configs.HTTP_AES_KEY;
global.GAME_AES_KEY = configs.GAME_AES_KEY;

var client_service = require("./client_service");
var account_service = require("./sub_services/account_service");
var dealer_service = require("./sub_services/dealer_service");
var pay_service = require("./sub_services/pay_service");
var room_service = require("./room_service");
var club_service = require("./sub_services/club_service");

var db = require('../externals/utils/dbsync');
db.init(configs.mysql_conf());

//开启大厅客户端主服务
var serverInfo = client_service.start(config);
//开启账号认证子服务
account_service.start(config, serverInfo.encryptRoutMgr, serverInfo.app);
//开启运营商接口子服务
dealer_service.start(config, serverInfo.encryptRoutMgr, serverInfo.app);

pay_service.start(config, serverInfo.encryptRoutMgr, serverInfo.app);

//开启俱乐部聊天服务
club_service.start(config);
var clubmgr = require('./sub_services/clubmgr');
clubmgr.setConfig(config);

//开启房间管理主服务
room_service.start(config);

var luckyWheelModule = require('./modules/lucky_wheel');
luckyWheelModule.start(serverInfo.encryptRoutMgr,serverInfo.app, config);