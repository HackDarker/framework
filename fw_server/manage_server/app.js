//加载错误码
require('../externals/utils/errcode');
var configs = require(process.argv[2]);
var config = configs.manage_service_conf();

var db = require('../externals/utils/dbsync');
db.init(configs.mysql_conf());

var client = require("./manage_service");
client.start(config);