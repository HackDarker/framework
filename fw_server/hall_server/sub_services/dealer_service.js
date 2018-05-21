var crypto = require('../../externals/utils/crypto');
var db = require('../../externals/utils/dbsync');
var http = require("../../externals/utils/http");
var fibers = require('fibers');
var fs = require("fs");
var express = require('express');
var app = express();
var configs = null;



exports.start = function (conf, routMgr) {
	configs = conf;
	app.listen(conf.DEALDER_API_PORT);
	console.log("client service is listening on port " + conf.DEALDER_API_PORT);
	init(app, app);
};

// exports.start = function (conf, routMgr, app) {
// 	init(routMgr, app);
// };

function init(routMgr, app) {
	if (!routMgr) {
		console.log('init dealer api service error...');
		return;
	}

	//设置跨域访问
	app.all('*', function (req, res, next) {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Headers", "X-Requested-With");
		res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
		res.header("X-Powered-By", '3.2.1');
		res.header("Content-Type", "application/json;charset=utf-8");

		fibers(function () {
			next();
		}).run();
	});
	console.log('init dealer api service...');




	// (function task() {

	// 	var time = 7 * 1000 * 60 * 60 * 24;   //1天存储一次
	// 	var currentDay = new Date().getDay();

	// 	console.log('今天星期' + currentDay)
	// 	var day = 6 - currentDay
	// 	if(day==0){
	// 		day = 7
	// 	}
	// 	var today = new Date();
	// 	today.setHours(0);
	// 	today.setMinutes(0);
	// 	today.setSeconds(0);
	// 	var nextTime = today.getTime() + day * 1000 * 60 * 60 * 24;
	// 	console.log("下个星期六凌晨0点0时0分0秒的时间戳：" + tomorrow);
	// 	var nowTime = new Date().getTime();
	// 	var subTime = nextTime - nowTime;
	// 	console.log("现在到下个星期六凌晨0点0时0分0秒的毫秒差：" + subTime)
	// 	console.log("现在到下个星期六凌晨0点0时0分0秒的小时差：" + subTime / 1000 / 60 / 60)

	// 	 fibers(function(){
	// 	 sleep(subTime);
	// 		while(1){
	// 		var suc= db.update_lastweek_rank_scores();
	// 		if(suc){
	// 			db.clear_thisweek_rank_scores();
	// 		}
	// 			sleep(time);
	// 		}
	// 	 }

	// 	 ).run()

	// })()



	//----------余姚旧框架接口代码整合过来-------------------start
	//获取游戏商品
	routMgr.get('/get_shop_data', function (req, res) {
		var start = req.query.start;
		var rows = req.query.rows;
		var ret = db.get_shop_data_tow(start, rows)
		if (ret) {
			http.send(res, 0, ret, "ok");
		}
		else {
			http.send(res, 1, "null", "null");
		}
	});


	//获取游戏公告
	// routMgr.get('/get_message', function (req, res) {
	// 	var start = req.query.start;
	// 	var rows = req.query.rows;
	// 	var data = db.get_game_message(start, rows);
	// 	if(data){
	// 		http.send(res, 0, data, "ok");
	// 	}else{
	// 		http.send(res, 1, "null","null");
	// 	}
	// });

	//添加游戏公告
	// routMgr.get('/add_message', function (req, res) {
	// 	var type = req.query.type;
	// 	var msg = req.query.msg;
	// 	var version = req.query.version;

	// 	var res = db.add_game_message(type, msg, version);
	// 	if(res){
	// 		http.send(res, 0, "ok", "ok");
	// 	}else{
	// 		http.send(res, 1, "fail", "fail");
	// 	}
	// });

	// 获取公告
	app.get('/get_message', function (req, res) {
		var start = req.query.start;
		var rows = req.query.rows;
		if (start == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}
		if (rows == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}

		var suc = db.get_all_message(start, rows);
		// db.get_all_message(start,rows,function(suc){
		if (suc !== null) {
			http.send(res, 0, suc, "ok");
		}
		else {
			http.send(res, 1, null, "failed");
		}
		// });
	});

	// 删除公告
	app.get('/delete_message', function (req, res) {
		var type = req.query.type;
		if (type == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}

		var suc = db.del_message(type);
		// db.del_message(type,function(suc){
		if (suc !== null) {
			http.send(res, 0, "ok");
		}
		else {
			http.send(res, 1, "failed", "failed");
		}
		// });
	});

	//禁封玩家
	app.get('/userForbidden', function (req, res) {
		var userid = req.query.userid;

		var ret = db.forbiddenUser(userid);
		if (ret) {
			http.send(res, 0, "ok", "ok");
		} else {
			http.send(res, 1, "failed", "failed");
		}
	});
	app.get('/update_user_agent', function (req, res) {
		var userid = req.query.userid;
		var agent = req.query.agent;

		var data = db.update_user_agent(userid, agent)
		http.send(res, RET_OK, { data: data }, "ok");

	})


	app.get('/get_last_week_rank_list', function (req, res) {

		var suc = db.get_last_week_rank_list()
		if (suc !== null) {
			for (let i = 0; i < suc.length; i++) {
				suc[i].rank = i + 1
			}
			http.send(res, 0, suc, "ok");
		}
		else {
			http.send(res, 1, "failed");
		}
	});


	app.get('/get_this_week_rank_list', function (req, res) {

		var suc = db.get_this_week_rank_list()

		if (suc !== null) {
			for (let i = 0; i < suc.length; i++) {
				suc[i].rank = i + 1
			}
			http.send(res, 0, suc, "ok");
		}
		else {
			http.send(res, 1, "failed");
		}
	});

	app.get('/majiang_rooms', function (req, res) {
		var start = req.query.start;
		var rows = req.query.rows;
		var roomid = req.query.roomid;
		if (start == null) {
			http.send(res, -1, "failed");
			return;
		}
		if (rows == null) {
			http.send(res, -1, "failed");
			return;
		}

		var suc = db.get_rooms_dht(start, rows, roomid)
		if (suc !== null) {
			http.send(res, 0, suc, "ok");
		}
		else {
			http.send(res, 1, "failed");
		}
	});

	app.get('/shisanshui_rooms', function (req, res) {
		var start = req.query.start;
		var rows = req.query.rows;
		var roomid = req.query.roomid;
		if (start == null) {
			http.send(res, -1, "failed");
			return;
		}
		if (rows == null) {
			http.send(res, -1, "failed");
			return;
		}

		var suc = db.get_rooms(start, rows, roomid)
		if (suc !== null) {
			http.send(res, 0, suc, "ok");
		}
		else {
			http.send(res, 1, "failed");
		}
	});
	//解封玩家
	app.get('/deleteUserF', function (req, res) {
		var userid = req.query.userid;
		var ret = db.deleteUserF(userid);
		if (ret) {
			http.send(res, 0, "ok", "ok");
		} else {
			http.send(res, 1, "failed", "failed");
		}
	})
	//----------余姚旧框架接口代码整合过来-------------------end
	//查询玩家信息
	routMgr.get('/get_user_info', function (req, res) {
		var userid = req.query.userid;
		var data = db.get_user_data_by_userid(userid);
		if (!data) {
			http.send(res, ACC_ERRS.GET_USER_BASE_INFO_FAILED);
			return;
		}

		var ret = {
			// userid: userid,
			// name: data.name,
			// gems: data.gems,
			// headimg: data.headimg
			userid: userid,
			name: data.name,
			gems: data.gems,
			headimg: data.headimg,
			agent: data.agent,
			account: data.account
		}
		console.log(ret);
		http.send(res, RET_OK, ret, "ok");
	});
	// 强制解散房间
	app.get('/dissolveRoom', function (req, res) {
		var roomid = req.query.roomid;
		var type = req.query.type;
		if (roomid == null) {
			http.send(res, -1, "failed");
			return;
		}
		var suc = db.dissolve_room(roomid, type);
		if (suc !== null) {
			http.send(res, 0, "ok");
		}
		else {
			http.send(res, 1, "failed");
		}
	});
	app.get('/add_user_gems', function (req, res) {
		var userid = req.query.userid;
		var gems = req.query.gems;
		var suc = db.add_user_gems(userid, gems);
		if (suc) {
			http.send(res, 0, "ok", "ok");

		}
		else {
			http.send(res, GAME_ERRS.ADD_GEMS_FAILED);
		}
	});

	//====================代理绑定自己的玩家账号==============
	app.get('/agent_bound_userid', function (req, res) {
		var agentid = req.query.agentid;
		var userid = req.query.userid;
		if (agentid == null || userid == null) {
			return http.send(res, -1, "parameter err", "parameter err");
		}
		var ret = db.agent_bound_userid(agentid, userid);
		if (ret) {
			console.log('agent_bound_userid success');
			http.send(res, 0, "ok", "ok");
		} else {
			console.log('agent_bound_userid fail');
			http.send(res, 1, "failed", "failed");
		}
	})
	//====================代理标志自己的玩家账号==============

	app.get('/get_user_ranking', function (req, res) {
		var start = req.query.start;
		var rows = req.query.rows;
		var user_id = req.query.userid;
		if (start == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}
		if (rows == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}

		var suc = db.get_user_ranking(start, rows, user_id);
		if (suc) {
			//http.send(res,0,"ok",suc);
			http.send(res, 0, suc, "ok");
		}
		else {
			http.send(res, 1, "failed", "failed");
		}
	});
	app.get('/get_pay_list', function (req, res) {
		var userId = parseInt(req.query.userid);
		var start = parseInt(req.query.start);
		var rows = parseInt(req.query.rows);
		var end_time = parseInt(req.query.end_time);
		var start_time = parseInt(req.query.start_time);

		var data = db.get_pay_list(start, rows, userId, start_time, end_time);
		http.send(res, RET_OK, data, true);


	});

	app.get('/get_change_record', function (req, res) {
		var userId = parseInt(req.query.userid);
		var start = parseInt(req.query.start);
		var rows = parseInt(req.query.rows);
		var end_time = parseInt(req.query.end_time);
		var start_time = parseInt(req.query.start_time);

		var data = db.get_change_record(start, rows, userId, start_time, end_time);

		http.send(res, RET_OK, data, "ok");


	});
	app.get('/change_record_state', function (req, res) {
		var id = parseInt(req.query.id);
		var data = db.change_record_state(id);
		if (data) {
			http.send(res, RET_OK, true, "ok");
		} else {
			http.send(res, RET_OK, false, "ok");
		}
	});

	app.get('/rooms', function (req, res) {
		var start = req.query.start;
		var rows = req.query.rows;
		var roomid = req.query.roomid;
		if (start == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}
		if (rows == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}

		var suc = db.get_rooms_dht(start, rows, roomid);
		if (suc) {
			console.log(suc);
			//http.send(res,0,"ok",suc);
			http.send(res, 0, suc, "ok");
		}
		else {
			http.send(res, 1, "failed", "failed");
		}
	});
	app.get('/get_userid_by_bind_agent', function (req, res) {
		var agent = req.query.agent;
		var start = req.query.start;
		var rows = req.query.rows;
		if (agent == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}
		if (start == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}
		if (rows == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}

		var suc = db.get_userid_by_bind_agent(agent, start, rows);
		if (suc !== null) {
			//http.send(res,0,"ok", suc);
			http.send(res, 0, suc, "ok");
		}
		else {
			http.send(res, 1, "failed", "failed");
		}

	});


	// 获取公告
	app.get('/get_all_message', function (req, res) {
		var start = req.query.start;
		var rows = req.query.rows;
		if (start == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}
		if (rows == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}

		var suc = db.get_all_message(start, rows);
		// db.get_all_message(start,rows,function(suc){
		if (suc !== null) {
			http.send(res, 0, suc, "ok");
		}
		else {
			http.send(res, 1, null, "failed");
		}
		// });
	});
	// 新增公告
	app.get('/add_message', function (req, res) {
		var type = req.query.type;
		var msg = req.query.msg;
		var version = req.query.version;
		if (type == null) {
			console.log(1);
			http.send(res, -1, "failed", "failed");
			return;
		}
		if (msg == null) {
			console.log(2);

			http.send(res, -1, "failed", "failed");
			return;
		}


		var suc = db.add_message(type, msg, version);
		// db.add_message(type,msg,version,function(suc){
		if (suc !== null) {
			http.send(res, 0, "ok", "ok");
		}
		else {
			http.send(res, 1, "failed", "failed");
		}
		// });
	});
	// 更新公告
	app.get('/update_message', function (req, res) {
		var type = req.query.type;
		var msg = req.query.msg;
		var version = req.query.version;

		if (type == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}
		if (msg == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}
		if (version == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}

		var suc = db.update_message(type, msg, version);
		// db.update_message(type,msg,version,function(suc){
		if (suc !== null) {
			http.send(res, 0, "ok");
		}
		else {
			http.send(res, 1, "failed", "failed");
		}
		// });
	});
	// 删除公告
	app.get('/del_message', function (req, res) {
		var type = req.query.type;
		if (type == null) {
			http.send(res, -1, "failed", "failed");
			return;
		}

		var suc = db.del_message(type);
		// db.del_message(type,function(suc){
		if (suc !== null) {
			http.send(res, 0, "ok");
		}
		else {
			http.send(res, 1, "failed", "failed");
		}
		// });
	});
	//获取中奖纪录
	app.get('/get_welfare_records', function (req, res) {
		var start = req.query.start;
		var rows = req.query.rows;
		var state = req.query.state;
		var start_time = req.query.start_time;
		var end_time = req.query.end_time;
		var user_id = req.query.user_id;

		var data = db.get_welfare_records(start, rows, state, start_time, end_time, user_id)
		http.send(res, RET_OK, { data: data }, "ok");
	})
	//处理中奖纪录
	app.get('/deal_welfare_records', function (req, res) {
		var id = req.query.id;

		var data = db.deal_welfare_record(id)
		http.send(res, RET_OK, { data: data }, "ok");
	})

	//获取转盘商品信息
	app.get('/get_awards_config', function (req, res) {
		var start = req.query.start;
		var rows = req.query.rows;
		var data = db.get_awards_config(start, rows)

		http.send(res, RET_OK, { data: data }, "ok");

	})

	//更新转盘商品信息
	app.get('/update_awards_config', function (req, res) {
		var id = req.query.id;
		var type = req.query.type;
		var num = req.query.num;
		var name = req.query.name;
		var prop = req.query.prop;
		var cnt = req.query.cnt;

		var data = db.update_awards_config(id, type, num, name, prop, cnt)
		http.send(res, RET_OK, { data: data }, "ok");


	})

	/**----------------------比赛场-<<--->>-管理后台--------------- */
	app.get('/get_match_list', function (req, res) {
		console.log('get_match_list----req', req.query)
		if (req.query.type === null || req.query.game_type === null) {
			return
		}

		let match_list = new Promise((resolve, reject) => {
			let get_match_list = db.get_match_list(req.query.game_type, req.query.type)
			get_match_list.then(data => {
				if (data) {
					resolve(data)
				}
			})
		})

		match_list.then(data => {
			if (data !== null) {
				http.send(res, { code: 0, msg: "ok" }, data, true);
			} else {
				http.send(res, { code: 1, msg: "failed" });
			}
		}).catch(err => {
			console.log(err)
		})
	});
	app.get('/add_match_list', function (req, res) {
		console.log('管理后台传输数据add_match_list', req.query)
		if (req.query.type === null ||
			req.query.game_type === null ||
			req.query.title === null ||
			req.query.rewards === null ||
			req.query.people_limit === null ||
			req.query.consume === null ||
			req.query.isPlay === null ||
			req.query.isCycle === null ||
			req.query.base_turns === null ||
			req.query.match_type === null
		) {
			return
		}

		let newMatch = () => {
			let generateMatchId = new Promise((resolve, reject) => {
				let match_id = '';
				for (let i = 0; i < 6; i++) {
					match_id += Math.floor(Math.random() * 10);
					if (i == 5) {
						resolve(match_id)
					}
				}
			})
			generateMatchId.then(id => {
				fibers(function () {
					let get_has_match = db.get_has_match(id);
					get_has_match.then(data => {
						if (data) {
							newMatch()
						} else {
							fibers(function () {
								let matchdata = {
									id: id,
									type: req.query.type,
									title: req.query.title,
									rewards: JSON.parse(req.query.rewards),
									people_limit: req.query.people_limit,
									consume: JSON.parse(req.query.consume),
									game_type: req.query.game_type,
									isCycle: req.query.isCycle,
									base_turns: req.query.base_turns,
									match_type: req.query.match_type,
									order_weight: req.query.order_weight,
									match_passwor: req.query.match_passwor,
									match_icon: req.query.match_icon || '',
									isPlay: req.query.isPlay
								}
								let add_match_list = db.add_match_list(matchdata);

								add_match_list.then(str => {
									if (str !== null) {
										console.log('创建新的比赛场成功！比赛ID：', str)
										http.send(res, { code: 0, msg: "ok" }, str, true);
									} else {
										http.send(res, 1, "failed");
									}
								})
							}).run();
						}
					})
				}).run();

			})
		}
		newMatch()
	});

	app.get('/del_match_list', function (req, res) {
		console.log(req.query)
		if (req.query.id === null) {
			return
		}
		let matchId = req.query.id;
		db.delete_match(matchId).then(data => {
			http.send(res, { code: 0, msg: "ok" }, data, true);
		}).catch(err => {
			http.send(res, 1, "failed");
		});
	});

	app.get('/get_match_reward', (req, res) => {
		console.log('get_match_reward', req.query);
		db.get_match_reward().then(data => {
			if (data) {
				http.send(res, { code: 0, msg: "ok" }, data, true);
			} else {
				http.send(res, 1, "failed");
			}
		})
	})

	app.get('/update_match_reward', (req, res) => {
		console.log(req.query)
		if (req.query.uuid === null) {
			return
		}
		db.update_match_reward(req.query.uuid).then(data => {
			if (data) {
				http.send(res, { code: 0, msg: "ok" }, data, true);
			} else {
				http.send(res, 1, "failed");
			}
		})
	})

	app.get('/getUserInfo', (req, res) => {
		console.log(req.query)
		if (req.query.id === null || req.query.id === '') {
			http.send(res, { code: 2, msg: "parms err" }, null, true);
			return
		}
		let data = db.get_user_data_by_userid(req.query.id);
		if (data) {
			http.send(res, { code: 0, msg: "ok" }, data, true);
		} else {
			http.send(res, 1, "failed");
		}
	})
	app.get('/add_match_img', (req, res) => {
		let matchId = req.query.matchId;
		if (req.query.imgpath) {
			fibers(() => {
				let path = 'http://' + configs.HALL_FOR_CLIENT_IP + req.query.imgpath;
				db.update_match_icon_path(matchId, path)
					.then(ret => {
						http.send(res, { code: 0, msg: "ok" }, ret, true);
					});
			}).run();
		} else {
			http.send(res, 1, "failed");
		}


	})
	function saveImg2Disk(matchId, image) {//图片写入文件夹功能放到manage做，游戏端只需存入图片路径
		return new Promise((resolve, reject) => {
			if (!image || !matchId) { return reject(); }
			if (image.indexOf('base64') != -1) {
				image = image.slice(image.indexOf(',') + 1);
			}
			let randomCode = function () {
				var Id = "";
				for (var i = 0; i < 6; ++i) {
					if (i > 0) {
						Id += Math.floor(Math.random() * 10);
					}
					else {
						Id += Math.floor(Math.random() * 9) + 1;
					}
				}
				return Id;
			}
			let imgeName = matchId + randomCode() + ".jpg";
			// let path = 'E:/svn_01/lyq5655779.yymjnew/trunk/server/hall_server/sub_services'
			let path = __dirname;
			path = path.slice(0, path.indexOf('server'));
			let dirpath = path.split('\\').join('/') + 'images/' + imgeName;//服务器路径
			fs.writeFile(dirpath, image, 'base64', function (err) {
				console.log("图片2写入成功");
				let getpath = 'http://' + configs.HALL_FOR_CLIENT_IP + '/images/' + imgeName;//存入数据库路径
				return resolve(getpath);
			})
		})
	}
}

