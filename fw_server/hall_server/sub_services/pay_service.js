var crypto = require('../../externals/utils/crypto');
var db = require('../../externals/utils/dbsync');
var http = require("../../externals/utils/http");
var fibers = require('fibers');
var consts = require('../../externals/utils/consts');
const CASH_CHANGE_RESONS = consts.CashChangeResons;

var SH_KEY = 'cd113b16f97c43d695e68f3ea1e6a2c2';

function check_account(req, res) {
    var token = req.query.token;
    if (token == null) {
        http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
        return null;
    }

    var userdata = db.get_userdata_by_token(token);
    if (!userdata) {
        http.send(res, HALL_ERRS.TOKEN_TIMEOUT, null, true);
        return null;
    }

    return userdata;
}

exports.start = function (conf, routMgr, app) {
    init(conf, routMgr, app);
};

function init(conf, routMgr, app) {
    if (!routMgr) {
        console.log('init pay service error...');
        return;
    }
    console.log('init pay service...');


    // app.get('/get_pay_url', function (req, res) {
    //     console.log("==充值==");
    //     var userdata = check_account(req, res);
    //     if (!userdata) {
    //         return;
    //     }


    //     var callbackurl = conf.PAY_CALL_BACK_URL;
    //     var hrefbackurl = conf.PAY_HREF_BACK_URL;
    //     var SHOPID = conf.SHOPID;
    //     var SH_KEY = conf.SH_KEY;

    //     //获取购买数据信息
    //     var itemId = req.query.item_id;
    //     var payType = req.query.pay_type;
    //     if (itemId == null || payType == null) {
    //         http.send(res, SYS_ERRS.INVALID_PARAMETER, null, true);
    //         return;
    //     }

    //     var itemData = db.get_item_data(itemId);
    //     if (itemData == null) {
    //         http.send(res, GAME_ERRS.GET_ITEM_DATA_FAILED, null, true);
    //         return;
    //     }

    //     //此路径必须是RMB购买方式
    //     if (itemData.price_type != 3) {
    //         http.send(res, GAME_ERRS.INCORRECT_ITEM_PRICE_TYPE, null, true);
    //         return;
    //     }


    //     //判断支付类型
    //     if (payType != 'wechat' && payType != 'alipay') {
    //         http.send(res, 1004, "支付类型错误:failed");
    //         return;
    //     }
    //     var type = 0;
    //     if (payType == 'wechat') {
    //         type = 41;
    //         var url = 'http://www.dbt100.com//gateway/weixin/wap-weixinpay.asp';
    //     } else if (payType == 'alipay') {
    //         type = 44;
    //         var url = 'http://www.zhifuka.net/gateway/alipay/wap-alipay.asp';

    //     } else {
    //         return;
    //     }

    //     var data = {
    //         customerid: SHOPID,
    //         cardno: type,
    //         orderAmount: Number(itemData.price) * 100,
    //         // orderAmount:1,

    //         sdcustomno: 'BK' + Date.now() + Math.floor(Math.random() * 1000) + userdata.userid,
    //         noticeurl: callbackurl,
    //         backurl: hrefbackurl,
    //         sign: 'ddd',
    //         mark: '1024',
    //         remarks: 'test',
    //     };
    //     // console.log(JSON.stringify(data));
    //     console.log(JSON.stringify(data));
    //     var signFields = ['customerid', 'sdcustomno', 'orderAmount', 'cardno', 'noticeurl', 'backurl'];
    //     var signStr = '';
    //     var sep = '';
    //     for (var i = 0; i < signFields.length; ++i) {
    //         var k = signFields[i];
    //         signStr += sep + k + '=' + data[k];
    //         sep = '&';
    //     }
    //     signStr += SH_KEY;
    //     console.log(signStr)
    //     data.sign = crypto.md5(signStr).toUpperCase();
    //     var urlStr = '';
    //     var sep = '';
    //     for (var k in data) {
    //         urlStr += sep + k + '=' + data[k];
    //         sep = '&';
    //     }
    //     var ret = url + '?' + urlStr;
    //     var price = '' + itemData.price + '元';

    //     if (db.create_pay_record(userdata.userid,
    //         userdata.agent,
    //         data.sdcustomno,
    //         itemData.price,
    //         itemData.item_id)) {
    //         console.log(ret);
    //         http.send(res,
    //             RET_OK,
    //             { url: ret, item: itemData.name, price: price, orderid: data.sdcustomno }, true);
    //     } else {
    //         http.send(res, GAME_ERRS.CREATE_PAY_RECORD_FAILED, null, true);
    //     }
    // });
app.get('/pay_back', function (req, res) {
    console.log("向支付平台汇报支付情况2", req.body);
    // var opstate  = parseInt(req.query.state);
    // var customerid = req.query.customerid;
    // var sd51no = req.query.sd51no;
    // var sdcustomno  = req.query.sdcustomno ;
    // var ordermoney = req.query.ordermoney;
    // var mark = req.query.mark;
    // var sign = req.query.sign;
    var orderid = req.body.buss_order_num;
    var  result_code = parseInt(req.body.result_code);
    //检查MD5

    //var str = "customerid="+customerid+"&sd51no="+sd51no+"&sdcustomno="+sdcustomno+"&mark="+mark+"&key="+conf.SH_KEY;
    // var md5 = crypto.md5(str).toUpperCase();
    // if (md5 != sign) {
	// 	console.log(md5)
	// 	console.log(sign)
    //     //向支付平台汇报错误情况
    //     http.send(res, '<result>0</result>');
    //     return;
    // }
        
        var changeStateOK = false;
        var payData = db.get_pay_data(orderid);
        console.log("=================",payData);
        if (payData == null) {
            http.send(res, '<result>1</result>');
            return;
        }

        if (payData.state == 1) {
            var state = 2;
            if (opstate == 1) {
                state = 3;
            }
            changeStateOK = db.update_pay_state(payData.order_id, state);

            if (changeStateOK) {
                var itemData = db.get_item_data(payData.item_id);
                if (itemData) {
                    if (itemData.gain_type == 1) {//coins
                        db.add_user_coins(payData.user_id, itemData.gain, '+ bought by RMB');
                    } else if (itemData.gain_type == 2) {//gems
                        var gain = itemData.gain;
                        var userdata = db.get_user_data_by_userid(payData.user_id);
                        function notify_daili_server() { //向代理系统汇报充值
                            function md5(msg) {
                                return cp.createHash('md5').update(msg).digest('hex');
                            }
                            // 通知代理服务器
                            var temp = {
                                ord: payData.order_id, // 唯一订单号
                                money: payData.cost, // 金额, 单位元
                                user: payData.user_id, // t_users表中的主键 userid
                                agent: userdata.agent, // t_users表中的agent
                            };
                            var SIGN_KEY = "^&*#$%()@333";
                            temp.sign = md5(temp.ord + temp.user + temp.money + temp.agent + SIGN_KEY);
                            console.log('通知代理服务器前打印3', temp);
                            http.get(config.DAILI_HOST, config.DAILI_PORT, '/player_pay_sure', temp, function (ok, temp) {
                                if (ok) {
                                    console.log('通知代理服务器ok', temp);
                                } else {
                                    console.log('通知代理服务器失败');
                                    if (--try_count > 0) notify_daili_server();
                                }
                            });
                        }
                        //代理不等于空才调用
                        if (userdata.agent != null) {
                            notify_daili_server();
                            // if (gain == 11) { //如果绑定代理 房卡加送!
                            //     gain += 1;
                            // } else if (gain == 36) {
                            //     gain += 6;
                            // } else if (gain == 65) {
                            //     gain += 10;
                            // }
                        }
                        db.add_user_gems(payData.user_id, gain, '+ bought by RMB');
                    }

                }
            }
        }
            // 通知代理服务器
            // var data = {
            //     ord: sdcustomno, // 唯一订单号
            //     money: ordermoney , // 金额, 单位元
            //     user: payData.user_id, // t_users表中的主键 userid
            //     agent: payData.agent // t_users表中的agent
            // };

            // var SIGN_KEY = "^&*#$%()@333";
            // data.sign = crypto.md5(data.ord + data.user + data.money + data.agent + SIGN_KEY);
            // var httpres = http.getSync('http://127.0.0.1:8003/player_pay_sure', data);
            // console.log(httpres);
            // if (httpres && httpres.data && httpres.err==null) {
            //     console.log("==代理提成成功==");
            // } else {
            //     console.log("==代理提成失败==+");
            // }

     //   }

        


        //向支付平台汇报成功消息
        http.send(res, '<result>1</result>');
    });


    app.get('/get_pay_state', function (req, res) {
        var userdata = check_account(req, res);
        if (!userdata) {
            return;
        }

        var orderId = req.query.orderid;
        var payData = db.get_pay_data(orderId);
        if (payData == null) {
            http.send(res, GAME_ERRS.GET_PAY_RECORD_FAILED);
            return;
        }

        if (payData.state == 3) {
            console.log("===支付成功===2");
            //支付成功
            http.send(res, { code: 0, msg: 'ok' });
            return;
        } else if (payData.state == 2) {
            //支付失败
            http.send(res, { code: 1, msg: 'failed' });
            return;
        }

        http.send(res, { code: 1, msg: 'failed' });
    });
}