var crypto = require('../../externals/utils/crypto');
var db = require('../../externals/utils/dbsync');
var http = require("../../externals/utils/http");
var fibers = require('fibers');

var hallAddr = "";
var config = null;

exports.start = function (conf, routMgr, app) {
	config = conf;
	hallAddr = config.HALL_FOR_CLIENT_IP + ":" + config.HALL_FOR_CLIENT_PORT;
	init(routMgr, app);
};

function init(routMgr, app) {
	if (!routMgr) {
		console.log('init account service error...');
		return;
	}
	console.log('init account service...');

	routMgr.get('/register', function (req, res) {
		var account = req.query.account;
		var password = req.query.password;

		//账号已存在
		var exist = db.is_user_exist(account);
		if (exist) {
			http.send(res, ACC_ERRS.ACC_EXISTED);
			return;
		}

		//创建账号失败
		var ret = db.create_account(account, password);
		if (!ret) {
			http.send(res, ACC_ERRS.ACC_CREATE_FAILED);
			return;
		}

		http.send(res, RET_OK);
	});

	routMgr.get('/get_version', function (req, res) {
		var ret = {
			version: config.VERSION,
		};
		http.send(res, RET_OK, ret);
	});

	app.get('/get_serverinfo', function (req, res) {
		var ret = {
			version: config.VERSION,
			hall: hallAddr,
			appweb: config.APP_WEB,
			rgx: true,
			rgxs: false,
		};
		http.send(res, RET_OK, ret, true);
	});

	if (global.HTTP_AES_KEY != null) {
		routMgr.get('/get_serverinfo', function (req, res) {
			var ret = {
				version: config.VERSION,
				hall: hallAddr,
				appweb: config.APP_WEB,
				rgx: true,
				rgxs: false,
			};
			http.send(res, RET_OK, ret);
		});
	}

	routMgr.get('/guest', function (req, res) {
		var account = "guest_" + req.query.account;
		var sign = crypto.md5(account + req.ip + config.ACCOUNT_PRI_KEY);
		var ret = {
			account: account,
			halladdr: hallAddr,
			sign: sign
		};

		http.send(res, RET_OK, ret);
	});

	routMgr.get('/auth', function (req, res) {
		var account = req.query.account;
		var password = req.query.password;

		var info = db.get_account_info(account, password);
		if (info == null) {
			http.send(res, ACC_ERRS.GET_ACC_INFO_FAILED);
			return;
		}

		account = "vivi_" + req.query.account;
		var sign = get_md5(account + req.ip + config.ACCOUNT_PRI_KEY);
		var ret = {
			account: account,
			sign: sign
		};

		http.send(res, RET_OK);
	});

	function get_access_token(code, os) {
		var info = config.appInfo[os];
		if (!info) {
			return { err: 'haha' };
		}
		var data = {
			appid: info.appid,
			secret: info.secret,
			code: code,
			grant_type: "authorization_code"
		};

		return http.getSync("https://api.weixin.qq.com/sns/oauth2/access_token", data, true);
	}

	function get_state_info(access_token, openid) {
		var data = {
			access_token: access_token,
			openid: openid
		};

		return http.getSync("https://api.weixin.qq.com/sns/userinfo", data, true);
	}

	function create_user(account, name, sex, headimgurl, callback) {
		var configs = db.get_configs();
		var coins = configs.first_coins;
		var gems = configs.first_gems;
		var exist = db.is_user_exist(account);
		if (exist) {
			return db.update_user_info(account, name, headimgurl, sex);
		}
		else {
			return db.create_user(account, name, coins, gems, sex, headimgurl);
		}
	}

	routMgr.get('/wechat_auth', function (req, res) {
		var code = req.query.code;
		var os = req.query.os;
		console.log('wechat_auth');
		if (!code || code === "" || !os || os === "") {
			http.send(res, SYS_ERRS.INVALID_PARAMETER);
			return;
		}
		console.log(os);
		var ret = get_access_token(code, os);
		console.log("access token data - " + ret.data);
		if (ret.err || !ret.data) {
			http.send(res, ACC_ERRS.GET_WECHAT_TOKEN_FAILED);
			return;
		}

		var access_token = ret.data.access_token;
		var openid = ret.data.openid;
		ret = get_state_info(access_token, openid);
		if (ret.err || !ret.data) {
			http.send(res, ACC_ERRS.GET_WECHAT_USER_INFO_FAILED);
			return;
		}

		openid = ret.data.openid;
		var nickname = ret.data.nickname;
		var sex = ret.data.sex;
		var headimgurl = ret.data.headimgurl;
		var account = "wx_" + openid;
		create_user(account, nickname, sex, headimgurl);
		var sign = crypto.md5(account + req.ip + config.ACCOUNT_PRI_KEY);
		ret = {
			account: account,
			halladdr: hallAddr,
			sign: sign
		};
		http.send(res, RET_OK, ret);
	});

	routMgr.get('/base_info', function (req, res) {
		var userid = req.query.userid;
		var data = db.get_user_base_info(userid);
		if (!data) {
			http.send(res, ACC_ERRS.GET_USER_BASE_INFO_FAILED);
			return;
		}

		var ret = {
			name: data.name,
			sex: data.sex,
			headimgurl: data.headimg,
		};
		http.send(res, RET_OK, ret);
	});

	app.get('/image', function (req, res) {
		var url = req.query.url;
		if (!url) {
			http.send(res, 1, 'invalid url', true);
			return;
		}
		if (url.indexOf('images') == -1) {//比赛场的图片不删除后缀名
			url = url.split('.jpg')[0];
		}

		var safe = url.search('https://') == 0;
		try {
			var ret = http.getSync(url, null, safe, 'binary');
			if (!ret.type || !ret.data) {
				http.send(res, 1, 'invalid url', true);
				return;
			}
			res.writeHead(200, { "Content-Type": ret.type });
			res.write(ret.data, 'binary');
			res.end();
		} catch (error) {
			//console.error("请求微信头像报错",error);
		}
	});
}

