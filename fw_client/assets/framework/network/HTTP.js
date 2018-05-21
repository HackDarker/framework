// var URL = "http://s1.babykylin.com:9000"

var URL = "http://127.0.0.1:9000"
var URL = "http://localhost:9000"

exports.master_url = null;
exports.url = null;
exports.token = null;
exports.mid = 0;

init();

function init() {
    exports.master_url = URL;
    exports.url = URL;
}

function handleTokenTimeout(errcode) {
    var content = "登陆已过期，请重新登陆";
    // 弹出提示返回大厅
    gc.alert.showUI(content, function () {
        // if (cc.args["account"] == null) {
        //     cc.sys.localStorage.removeItem("account");
        // }
        cc.sys.localStorage.removeItem("wx_code");
        gc.utils.restart();
    });
}

function sendRequest(path, data, handler, extraUrl, sendByPlainText) {
    var xhr = cc.loader.getXMLHttpRequest();
    xhr.timeout = 5000;

    if (data == null) {
        data = {};
    }
    if (exports.token) {
        data.token = exports.token;
    }

    if (exports.mid) {
        exports.mid++;
        data.mid = exports.mid;
    }

    if (extraUrl == null) {
        extraUrl = exports.url;
    }

    //解析请求路由以及格式化请求参数
    var sendpath = '';
    var sendtext = '';
    if (sendByPlainText === true || gc.crypto.HTTP_AES_KEY == null) {
        sendpath = path;
        sendtext = '?';
        for (var k in data) {
            if (sendtext != "?") {
                sendtext += "&";
            }
            sendtext += (k + "=" + data[k]);
        }
    } else {
        sendpath = '/sec';
        var senddata = {
            path: path,
            data: data,
        };
        sendtext = JSON.stringify(senddata);
        sendtext = gc.crypto.AesEncrypt(sendtext, gc.crypto.HTTP_AES_KEY);
        sendtext = '?' + sendtext;
    }

    //组装完整的URL
    var requestURL = extraUrl + sendpath + encodeURI(sendtext);

    //发送请求
    console.log("RequestURL:" + requestURL);
    xhr.open("GET", requestURL, true);

    if (cc.sys.isNative) {
        xhr.setRequestHeader("Accept-Encoding", "gzip,deflate", "text/html;charset=UTF-8");
    }

    var timer = setTimeout(function () {
        xhr.hasRetried = true;
        xhr.abort();
        console.log('http timeout');
        retryFunc();
    }, 5000);

    var retryFunc = function () {
        sendRequest(path, data, handler, extraUrl);
    };

    xhr.onreadystatechange = function () {
        console.log("onreadystatechange");
        clearTimeout(timer);
        if (xhr.readyState === 4 && (xhr.status >= 200 && xhr.status < 300)) {
            // console.log("http res(" + xhr.responseText.length + "):" + xhr.responseText);

            var respText = xhr.responseText;
            if (sendByPlainText !== true && gc.crypto.HTTP_AES_KEY != null) {
                respText = gc.crypto.AesDecrypt(xhr.responseText, gc.crypto.HTTP_AES_KEY);
            }

            cc.log("request from [" + xhr.responseURL + "] data [", respText, "]");

            var ret = null;
            try {
                ret = JSON.parse(respText);
            } catch (e) {
                console.log("err:" + e);
                ret = {
                    errcode: -10001,
                    errmsg: e
                };
            }

            // token超时单独处理
            if (ret.errcode == 4000) {
                handleTokenTimeout(ret.errcode);
                return;
            }

            if (handler) {
                handler(ret);
            }

            handler = null;
        }
        else if (xhr.readyState === 4) {
            if (xhr.hasRetried) {
                return;
            }

            console.log('other readystate == 4' + ', status:' + xhr.status);
            setTimeout(function () {
                retryFunc();
            }, 5000);
        }
        else {
            console.log('other readystate:' + xhr.readyState + ', status:' + xhr.status);
        }
    };

    try {
        xhr.send();
    }
    catch (e) {
        //setTimeout(retryFunc, 200);
        retryFunc();
    }

    return xhr;
}

exports.sendRequest = sendRequest;