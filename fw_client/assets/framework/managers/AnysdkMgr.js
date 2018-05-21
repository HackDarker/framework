module.exports = ModuleClass;
function ModuleClass(){}

/*
if(cc.sys.isNative){
    jsb.reflection.callStaticMethod = function(){
        console.log('hahahaha');
    }
}
*/

/** 获取GPS的信息
* @param  {String}   type    信息类型
* @param  {Number}   latitude    经度
* @param  {Number}   longitude   纬度
* @param  {Number}   altitude    海拔
* @param  {String}   addr        地址
* @param  {Number}   time        时间
* @param  {Number}   oper
* @param  {String}   desc        描述
* @param  {String}   netType     网络定位类型
*/
function struct_GPS_Info(type, latitude, longitude, altitude, addr, time, oper, desc, netType) {
    return {
        type: type,// - 0,
        latitude: latitude - 0,
        longitude: longitude - 0,
        altitude: altitude - 0,
        addr: addr,
        oper: oper,
        desc: desc,
        netType: netType,
        time: time - 0,
    };
}


ModuleClass.prototype.init = function () {
    this.ANDROID_API = "com/babykylin/NativeAPI";
    this.IOS_API = "AppController";
}

// 电池百分比
ModuleClass.prototype.getBatteryPercent = function () {
    if (cc.sys.isNative) {
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            return jsb.reflection.callStaticMethod(this.ANDROID_API, "getBatteryPercent", "()F");
        }
        else if (cc.sys.os == cc.sys.OS_IOS) {
            return jsb.reflection.callStaticMethod(this.IOS_API, "getBatteryPercent");
        }
    }
    return 0.534;
}

//信号强度 （无用）
ModuleClass.prototype.getSignalStrength = function () {
    if (cc.sys.isNative) {
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            return jsb.reflection.callStaticMethod(this.ANDROID_API, "getSignalStrength", "()F");
        }
        else if (cc.sys.os == cc.sys.OS_IOS) {
            return jsb.reflection.callStaticMethod(this.IOS_API, "getSignalStrength");
        }
    }
    return 90;
}

//网络类型
ModuleClass.prototype.getNetworkType = function () {
    if (cc.sys.isNative) {
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            return jsb.reflection.callStaticMethod(this.ANDROID_API, "getNetworkType", "()F");
        }
        else if (cc.sys.os == cc.sys.OS_IOS) {
            return jsb.reflection.callStaticMethod(this.IOS_API, "getNetworkType");
        }
    }
    return 0;
},

ModuleClass.prototype.login = function () {
    if (cc.sys.os == cc.sys.OS_ANDROID) {
        jsb.reflection.callStaticMethod(this.ANDROID_API, "Login", "()V");
    }
    else if (cc.sys.os == cc.sys.OS_IOS) {
        jsb.reflection.callStaticMethod(this.IOS_API, "login");
    }
    else {
        console.log("platform:" + cc.sys.os + " dosn't implement share.");
    }
},

ModuleClass.prototype.share = function (title, desc, scene, cb) {
    if (cc.sys.os == cc.sys.OS_ANDROID) {
        jsb.reflection.callStaticMethod(this.ANDROID_API, "Share", "(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;I)V", gc.SI.appweb, title, desc, scene);
    }
    else if (cc.sys.os == cc.sys.OS_IOS) {
        jsb.reflection.callStaticMethod(this.IOS_API, "share:shareTitle:shareDesc:scene:", gc.SI.appweb, title, desc, scene);
    }
    else {
        console.log(title + "  " + desc);
        console.log("platform:" + cc.sys.os + " dosn't implement share.");
    }
    this.shareCallback = cb;
}

ModuleClass.prototype.shareScreen = function (cb) {
    if (this._isCapturing) {
        return;
    }

    if (!cc.sys.isNative) {
        console.log("platform:" + cc.sys.os + " dosn't implement share result.");
        return;
    }

    this._isCapturing = true;
    var size = cc.director.getWinSize();
    var currentDate = new Date();
    var fileName = "result_share.jpg";
    var fullPath = jsb.fileUtils.getWritablePath() + fileName;
    if (jsb.fileUtils.isFileExist(fullPath)) {
        jsb.fileUtils.removeFile(fullPath);
    }
    var texture = new cc.RenderTexture(Math.floor(size.width), Math.floor(size.height), cc.Texture2D.PIXEL_FORMAT_RGBA4444, gl.DEPTH24_STENCIL8_OES);
    texture.setPosition(cc.p(size.width / 2, size.height / 2));
    texture.begin();
    cc.director.getRunningScene().visit();
    texture.end();
    texture.saveToFile(fileName, cc.IMAGE_FORMAT_JPG);

    var self = this;
    var tryTimes = 0;
    var fn = function () {
        if (jsb.fileUtils.isFileExist(fullPath)) {
            var height = 50;
            var scale = height / size.height;
            var width = Math.floor(size.width * scale);

            if (cc.sys.os == cc.sys.OS_ANDROID) {
                jsb.reflection.callStaticMethod(self.ANDROID_API, "ShareIMG", "(Ljava/lang/String;II)V", fullPath, width, height);
            }
            else if (cc.sys.os == cc.sys.OS_IOS) {
                jsb.reflection.callStaticMethod(self.IOS_API, "shareIMG:width:height:", fullPath, width, height);
            }
            else {
                console.log("platform:" + cc.sys.os + " dosn't implement share.");
            }
            self._isCapturing = false;
        }
        else {
            tryTimes++;
            if (tryTimes > 10) {
                console.log("time out...");
                return;
            }
            setTimeout(fn, 50);
        }
    }
    setTimeout(fn, 50);

    this.shareCallback = cb;
},

ModuleClass.prototype.onLoginResp = function (code) {
    gc.master.wechatAuth(code,1);
},

/**
 * 分享回调
 * @param {int} errcode 错误码
 * 0    确定
 * -2   用户取消
 */
ModuleClass.prototype.onShareResp = function (errcode) {
    if (this.shareCallback) {
        this.shareCallback(errcode);
    }
}

//获取GPS当前状态
//return gc.enum.E_GPS_STATUS
ModuleClass.prototype.getGPSStatus = function () {
    if (cc.sys.isNative) {
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            return jsb.reflection.callStaticMethod(this.ANDROID_API, "checkGPSStatus", "()I");
        }
        else if (cc.sys.os == cc.sys.OS_IOS) {
            // return jsb.reflection.callStaticMethod(this.IOS_API, "getSignalStrength");
        }
    }
    return gc.enum.E_GPS_STATUS.OUT_OF_SERVICE;
}

/**获取GPS 坐标信息
* @param  {Boolean} isReturnObj 是否转换为结构体
* @return {Object} struct_GPS_Info()
*/
ModuleClass.prototype.getGPSInfo = function (isReturnObj) {
    var locationInfo;
    if (cc.sys.isNative) {
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            locationInfo = jsb.reflection.callStaticMethod(this.ANDROID_API, "getLocationByBaidu", "()Ljava/lang/String;");
        }
        else if (cc.sys.os == cc.sys.OS_IOS) {
            locationInfo = jsb.reflection.callStaticMethod(this.IOS_API, "getLocationByBaidu");
        }
    }
    else {
        locationInfo = "161,30.558656,104.072398,449.0,腐都二街,2017-06-19 17:18:36,0,NetWork location successful!,wf";
    }

    console.log(" gps info ", locationInfo);
    if (!locationInfo || locationInfo.length <= 0) {       //定位信息字符串长度小于1 代表没有获取成功
        return null;
    }
    if (isReturnObj) {
        var tLocation = locationInfo.split(",");
        return struct_GPS_Info.apply(null, tLocation);
        // return struct_GPS_Info(tLocation[0], tLocation[1], tLocation[2], tLocation[3], tLocation[4]);
    }
    else {
        return locationInfo;
    }
}

/**
 * 检查是否含有权限权限
 * gc.enum.E_PERMISSION
 * **/
ModuleClass.prototype.isHasPermission = function (permissinoName) {
    console.log("is Has Permission");
    var isHasPermission = false;
    if (cc.sys.isNative) {
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            isHasPermission = jsb.reflection.callStaticMethod(this.ANDROID_API, "hasPermission", "(Ljava/lang/String;)Z", permissinoName);
        }
        else if (cc.sys.os == cc.sys.OS_IOS) {
            isHasPermission = jsb.reflection.callStaticMethod(this.IOS_API, "hasPermission:isShowSetting:", permissinoName, false);
        }
    }
    else {
        isHasPermission = true;
    }
    console.log("is Has Permission" + isHasPermission);
    return isHasPermission;
}

/**
 *  权限设定面板
*/
ModuleClass.prototype.showPermissionSetting = function (permissionName) {
    console.log("show Permission Setting " + permissionName);
    if (cc.sys.isNative) {
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            jsb.reflection.callStaticMethod(this.ANDROID_API, "showPermissionSetting", "(Ljava/lang/String;)V", permissionName);
        }
        else if (cc.sys.os == cc.sys.OS_IOS) {
            jsb.reflection.callStaticMethod(this.IOS_API, "showPermissionSetting");
        }
    }
    console.log("show Permission Setting over ");
}

/**
 *  权限设定面板
*/
ModuleClass.prototype.showPermissionSetting = function (permissionName) {
    console.log("show Permission Setting " + permissionName);
    if (cc.sys.isNative) {
        if (cc.sys.os == cc.sys.OS_ANDROID) {
            jsb.reflection.callStaticMethod(this.ANDROID_API, "showPermissionSetting", "(Ljava/lang/String;)V", permissionName);
        }
        else if (cc.sys.os == cc.sys.OS_IOS) {
            jsb.reflection.callStaticMethod(this.IOS_API, "showPermissionSetting");
        }
    }
    console.log("show Permission Setting over ");
},

/** 是否为模拟器 (基本无效) */
ModuleClass.prototype.isEmulator = function () {
    if (!cc.sys.isNative) {
        return false;
    }

    if (cc.sys.os == cc.sys.OS_ANDROID) {
        return jsb.reflection.callStaticMethod(this.ANDROID_API, "getIsEmulator", "()Z");
    }
    else if (cc.sys.os == cc.sys.OS_IOS) {
        return false;
    }
    return true;
}

//-----------原生GPS----------------
ModuleClass.prototype.onLocationResult = function (r) {
    try {
        if (this.getLocationCallback) {
            this.getLocationCallback(r);
        }
    } catch (error) {
        console.error(error);
    }
}

ModuleClass.prototype.getLocation = function (cb) {
    try {
        if (cc.sys.os === cc.sys.OS_ANDROID) {
            const cls = 'org/cocos2dx/javascript/AppActivity';
            const sig = '()Ljava/lang/String;';
            cb(jsb.reflection.callStaticMethod(cls, "getLocation", sig));
        }
        else if (cc.sys.os === cc.sys.OS_IOS) {
            this.getLocationCallback = cb;
            const cls = 'AppController';
            jsb.reflection.callStaticMethod(cls, "getPosition:", "gc.anysdk.onLocationResult('%@');");
        }
        else {
            console.log("平台:" + cc.sys.os + " 不支持获取位置");
            var d = { latitude: 0, longitude: 0 };
            cb(JSON.stringify(d));
        }
    } catch (error) {
        console.error(error);
    }
}

ModuleClass.prototype.calcDistance = function (a, b) {
    try {
        var check_arg = function (arg) {
            return typeof (arg.latitude) === 'number' && typeof (arg.longitude) === 'number';
        };
        let la = JSON.parse(a);
        let lb = JSON.parse(b);
        if (check_arg(la) && check_arg(lb)) {
            let arg = JSON.stringify({
                startLatitude: la.latitude,
                startLongitude: la.longitude,
                endLatitude: lb.latitude,
                endLongitude: lb.longitude,
            });

            if (cc.sys.os === cc.sys.OS_ANDROID) {
                const cls = 'org/cocos2dx/javascript/AppActivity';
                const sig = '(Ljava/lang/String;)Ljava/lang/String;';
                const r = jsb.reflection.callStaticMethod(cls, "calcDistance", sig, arg);
                return JSON.parse(r).distance;
            }
            else if (cc.sys.os === cc.sys.OS_IOS) {
                const cls = 'AppController';
                const r = jsb.reflection.callStaticMethod(cls, "calcDistance:", arg);
                return JSON.parse(r).distance;
            }
            else {
                console.log("平台:" + cc.sys.os + " 不支持计算距离");
                return 29;
            }
        }
    } catch (e) {
        console.error('error:', e);
    }
}