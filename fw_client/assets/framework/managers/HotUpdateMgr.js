var directoryMap = {};

function prepareURL(url) {
    if (directoryMap == null) {
        directoryMap = {};
    }
    url = cc.hotUpdatePath + '/' + url;
    var index = url.lastIndexOf('/');
    var path = url.substring(0, index);
    if (directoryMap[path] == null) {
        directoryMap[path] = path;
        if (!jsb.fileUtils.isDirectoryExist(path)) {
            jsb.fileUtils.createDirectory(path);
        }
    }
    return url;
}

var context = {
    state:0, //状态
    localVerson:null, //本地版本号
    removeVersion:null, //远程版本号
    loadedFile:0,//已下载的文件数目
    totalFile:0,//总共需要下载的文件数目
    progress:0, //更新进度
    code:0,//用于鉴别此context的状态
};

//连接服务器
context.STATE_CONNECT_TO_SERVER = 1;
//连接失败，即将重试
context.STATE_CONNECT_TO_SERVER_FAILED = 2;
//检查热更新版本
context.STATE_CHECK_HOT_UPDATE = 3;
//获取服务器资源列表
context.STATE_DOWNLOAD_REMOTE_ASSETS_LIST = 4;
//准备下载列表
context.STATE_PREPARE_DIFF_LIST = 5;
//正在下载
context.STATE_DOWNLOADING = 6;
//预加载
context.STATE_FINISHED = 7;

module.exports = ModuleClass;
function ModuleClass(){}

ModuleClass.prototype.init = function(){

}

// use this for initialization
ModuleClass.prototype.start = function () {
    console.log('current core version:' + cc.CORE_VERSION);
    console.log('hot update path',cc.hotUpdatePath);
    this.getServerInfo();
}

ModuleClass.prototype.gotoNext = function(){
    context.state = context.STATE_FINISHED;
    gc.emit('app_hot_update_ok');
}

ModuleClass.prototype.getContext = function(){
    return context;
}

ModuleClass.prototype.getServerInfo = function () {
    var self = this;

    var onGetVersion = function (ret) {
        console.log("on get version callback");
        if (ret.version == null) {
            console.log("on get version callback error.");
        }
        else {
            gc.SI = ret;
            console.log(ret);
            if (!cc.sys.isNative ) {
                self.gotoNext();
                return;
            }

            console.log("version exist");
            if (ret.version != cc.CORE_VERSION) {
                console.log(" cv false ");
                gc.emit('app_need_download');
            }
            else {
                console.log("cv true");
                console.log("is native");
                if (!cc.hotUpdatePath) {
                    console.log('cc.hotUpdatePath == null');
                    self.gotoNext();
                }
                else {
                    self.checkVersion(ret.update_url);
                }
            }
        }
    };

    var fnCheckNetwork = function () {
        //self.loadingProgess.string = "正在连接服务器";
        context.state = context.STATE_CONNECT_TO_SERVER;

        gc.http.sendRequest("/get_serverinfo", { cv: cc.CORE_VERSION, platform: cc.sys.os }, function (ret) {
            console.log('get_serverinfo',ret);
            if (!ret || ret.errcode !== 0) {
                //self.loadingProgess.string = "连接失败，即将重试";
                context.state = context.STATE_CONNECT_TO_SERVER_FAILED;

                setTimeout(function () {
                    fnCheckNetwork();
                }, 3000);
            } else {
                onGetVersion(ret);
            }
        },null,true);
    };

    fnCheckNetwork();
}

ModuleClass.prototype.checkVersion = function (updata_url) {
    var localInfo;
    var self = this;
    //this.loadingProgess.string = '检查版本号...';
    context.state = context.STATE_CHECK_HOT_UPDATE;

    var onServerProjectManifestLoaded = function (err, data) {
        this.remoteData = data;
        var removeInfo = JSON.parse(data);
        this.constructLoadQueue(localInfo, removeInfo);
    };
    var onRemoteVersionManifestLoaded = function (err, data) {
        var json = JSON.parse(data);
        var remoteVersion = json.version;
        gc.SI.server_hot_version = remoteVersion;
        //如果远程版本和本地版本不一样，则下载远程文件列表并比对差异
        console.log("xxx check version ", "remote version ", remoteVersion, " local version ", localInfo.version);
        if (remoteVersion != localInfo.version) {
            //this.loadingProgess.string = '获取资源列表(' + remoteVersion + ')...';
            // this.hotUpdateTip.string = "当前版本号:" + localInfo.version + " >> 目标版本号:" + remoteVersion;

            context.state = context.STATE_DOWNLOAD_REMOTE_ASSETS_LIST;
            context.remoteVersion = remoteVersion;
            console.log('context.remoteVersion',context.remoteVersion);

            var remoteManifestUrl = this.packageUrl + "project.manifest";
            gc.utils.loadRemoteRes(remoteManifestUrl, 'text', onServerProjectManifestLoaded.bind(this));
        }
        else {
            self.gotoNext();
        }
    };

    var onLocalProjectManifestLoaded = function (err, data) {
        localInfo = JSON.parse(data);
        //this.loadingProgess.string = '检查版本号(' + localInfo.version + ')...';
        context.localVerson = localInfo.version;
        console.log('context.localVerson',context.localVerson);
        this.packageUrl = updata_url;
        var remoteVersionUrl = this.packageUrl + "version.manifest";
        gc.utils.loadRemoteRes(remoteVersionUrl, 'text', onRemoteVersionManifestLoaded.bind(this));
    }

    var url = cc.url.raw('resources/ver/project.manifest');
    cc.loader.load(url, onLocalProjectManifestLoaded.bind(this));
}

//构建加载队列
ModuleClass.prototype.constructLoadQueue = function (localInfo, remoteInfo) {
    //this.loadingProgess.string = '准备下载...';
    context.state = context.STATE_PREPARE_DIFF_LIST;

    this.loadQueue = [];
    this.currentLoadingIndex = -1;
    for (var k in remoteInfo.assets) {
        //project.manifest version.manifest cv.txt不参与热更新
        if (k != 'res/raw-assets/resources/ver/project.manifest' && k != 'res/raw-assets/resources/ver/version.manifest' && k != 'res/raw-assets/resources/ver/cv.txt') {
            //如果本地不存在此文件，或者文件MD5与服务器不一致，则添加到下载队列
            if (localInfo.assets[k] == null || remoteInfo.assets[k].md5 != localInfo.assets[k].md5) {
                var localUrl = prepareURL(k);
                var md5 = remoteInfo.assets[k].md5;
                var filePath = k;
                this.loadQueue.push({
                    filePath: filePath,
                    localUrl: localUrl,
                });
            }
        }
    }
    context.totalFile = this.loadQueue.length;

    this.startNext();
}

// called every frame, uncomment this function to activate update callback
ModuleClass.prototype.update = function (dt) {
}

ModuleClass.prototype.startNext = function () {
    context.state = context.STATE_DOWNLOADING;

    this.currentLoadingIndex++;
    if (this.currentLoadingIndex == this.loadQueue.length) {
        this.onHotUpdateComplete();
        return;
    }
    var loadItem = this.loadQueue[this.currentLoadingIndex];
    this.loadRemoteRes(this.packageUrl + loadItem.filePath, 'arraybuffer', function (err, data) {
        jsb.fileUtils.writeDataToFile(data, loadItem.localUrl);
        this.startNext();
    }.bind(this));

    context.loadedFile = this.currentLoadingIndex;
    //
    //this.loadingProgess.string = '资源更新中...' + Math.floor((this.currentLoadingIndex / this.loadQueue.length) * 100) + '%';
}

ModuleClass.prototype.onHotUpdateComplete = function () {
    //更新本地资源版本号
    var url = prepareURL('/res/raw-assets/resources/ver/project.manifest');
    jsb.fileUtils.writeStringToFile(this.remoteData, url);
    console.log(url);
    //重启游戏
    //
    gc.utils.restart();
}

ModuleClass.prototype.log = function (content) {
    this.label.string += content + '\n';
}

ModuleClass.prototype.loadRemoteRes = function (url, type, cb) {
    var xhr = cc.loader.getXMLHttpRequest();
    xhr.open("GET", url, true);
    if (type == null) {
        type = 'text';
    }
    xhr.responseType = type;
    xhr.onload = function (e) {
        if (xhr.readyState == 4 && (xhr.status >= 200 && xhr.status <= 207)) {
            //console.log('status:' + xhr.statusText);
            //console.log('type:' + xhr.responseType);
            if (type == 'arraybuffer') {
                var arrayBuffer = xhr.response;
                if (arrayBuffer) {
                    var result = new Uint8Array(arrayBuffer);
                    cb(null, result);
                }
                else {
                    cb('arraybuffer is null', null);
                }
            }
            else {
                cb(null, xhr.responseText);
            }
        }
    }

    xhr.onerror = function (e) {
        cb(e, null);
    }

    xhr.onprogress = function (e) {
        console.log(e.loaded + " of " + e.total + " bytes");
    }

    xhr.send();
}
