var defaultHeadIcon = null;
var headIcon = null;
/** 当前加载进来的资源列表 */
var tmp_source = null;
/** 当前加载的回调函数列表 */
var loading_call = null;
/** 排除列表 */
var keep_list = null;

/**
 * 加载资源
 * @param {String} url                          需要的资源 （路径）
 * @param {Function} callBack                   设定完毕后的回调函数
 * @param {Boolean} is_keep                     切换场景时资源是否不被销毁
 */
function loadImage(url, callback, is_keep) {
    var load_url;
    if (url && url != "/0") {
        load_url = 'url=' + encodeURIComponent(url) + '.jpg';
    }
    if (is_keep) {
        addExclusion(load_url);
    }

    loading_call[load_url] = loading_call[load_url] || [];
    loading_call[load_url].push(callback);

    var tOnLoaded = function (err, tex) {
        if (!tmp_source[load_url]) {
            tmp_source[load_url] = tex;
        }
        if (tex) {
            var spriteFrame = new cc.SpriteFrame(tex, cc.Rect(0, 0, tex.width, tex.height));
        }
        var tCallList = loading_call[load_url] || [];
        cc.log("set img ", load_url, " call length ", tCallList.length);
        while (tCallList.length) {
            var tCallBack = tCallList.pop();
            if (!tCallBack) { continue; }
            tCallBack(spriteFrame);
        }
    }


    if (!load_url) {
        cc.log("dont load img ", load_url);
        tOnLoaded(null, null);
    }
    else if (!(load_url in tmp_source) || !cc.isValid(tmp_source[load_url])) {     //没有资源，开始加载
        cc.log("gc load img ", load_url, " from loader");
        tmp_source[load_url] = null;
        cc.loader.load((gc.http.url + '/image?mid=' + (++gc.http.mid) + '&' + load_url), tOnLoaded);
    }
    else if (tmp_source[load_url]) {                                     //有这个资源并且加载完毕
        cc.log("gc load img ", load_url, " from cache");
        tOnLoaded(null, tmp_source[load_url]);
    }
};

/**
 * 对节点设定图片
 * @param {CC.Node} node                        节点
 * @param {Object} spriteFrame                  需要的资源 （路径或者图片）
 * @param {CC.spriteFrame} defaultSpriteFrame   默认图片资源
 * @param {Function} callBack                   设定完毕后的回调函数
 * @param {Boolean} is_keep                     切换场景时资源是否不被销毁
 */
function setNodeSprite(node, spriteFrame, defaultSpriteFrame, callBack, is_keep) {
    if (!node) {
        return;
    }

    var tSprite;
    // if (("__classname__" in node) && (node.__classname__ === "cc.Sprite")) {
    if (node instanceof cc.Sprite) {
        tSprite = node;
    }
    else {
        tSprite = node.getComponent(cc.Sprite);
    }

    if (!tSprite) {
        return;
    }

    if (("now_frame" in tSprite) && (tSprite.now_frame == spriteFrame)) {
        return;
    }

    tSprite.now_frame = spriteFrame;

    if (!defaultSpriteFrame) {
        defaultSpriteFrame = new cc.SpriteFrame(cc.Rect(0, 0, 5, 5))
    }
    if (defaultSpriteFrame !== -1) {
        tSprite.spriteFrame = defaultSpriteFrame;
    }

    var tCallBack = function (parms) {
        if (parms) {
            tSprite.spriteFrame = parms;
        }
        gc.utils.exeCallback(callBack, parms);
    }

    if (!spriteFrame) {
        tCallBack(null);
    }
    else if (spriteFrame instanceof cc.SpriteFrame) {
        tCallBack(spriteFrame);
    }
    else {
        loadImage(spriteFrame, tCallBack, is_keep);
    }
}

/**
 * 对节点设定图片（玩家自己的头像将会自动设定为切换场景不销毁）
 * @param {CC.Node} icon_node                                   头像节点
 * @param {Number} userID                                       玩家userID
 * @param {CC.SpriteFrame} defaultSpriteFrame                   默认头像
 */
function setPlayerHeadIcon(icon_node, userID, defaultSpriteFrame) {
    var node = icon_node;
    if (!node) {
        return;
    }
    if (!userID) {
        return;
    }

    // if (userID == gc.user.userId && headIcon) {
    //     gc.sprite.setNodeSprite(node, headIcon, defaultSpriteFrame, null, true);
    //     return;
    // }

    gc.player.callPlayerInfo(userID, function (userID, playerInfo) {
        var url = playerInfo.url;

        // if (!url || (url == "/0") || !node.url) {
        //     url = null;
        //     if (!defaultSpriteFrame) { return; }
        //     if (node.url == "/0") { return; }
        //     node.url = "/0";
        //     gc.sprite.setNodeSprite(node, null, defaultSpriteFrame);
        //     return;
        // }
        // else {
        console.log("url: ", url);
        // }
        // if(node.URL != url){
        //     node.URL = url;
        //     gc.sprite.setNodeSprite(node, url, defaultSpriteFrame);
        // }
        loadImage(url, function (spriteFrame) {
            if (node.getComponent(cc.Sprite).spriteFrame !== spriteFrame) {
                gc.sprite.setNodeSprite(node, spriteFrame, defaultSpriteFrame);
            }
        }, (userID == gc.user.userId));

    });
}

function setDefaultHeadIcon(spriteFrame) {
    defaultHeadIcon = spriteFrame;
}

function getDefaultHeadIcon() {
    return defaultHeadIcon;
}

function change_scene() {
    for (var tKey in tmp_source) {                                   //销毁所有中途加载的资源
        if (keep_list && keep_list[tKey]) { continue; }   //不销毁的资源
        var tSprite = tmp_source[tKey]
        if (!tSprite || !cc.isValid(tSprite)) { continue; }
        // tSprite.releaseTexture();
        // tSprite.destroy();
    }
    tmp_source = tmp_source || {};                                //加载的文件列表
    loading_call = {};                                               //清空所有的加载回调
}

function addExclusion(url) {
    keep_list = keep_list || {};
    keep_list[url] = true;
}

function delExclusion(url) {
    keep_list = keep_list || {};
    keep_list[url] = null;
    delete keep_list[url];
}

// function loadHeadIcon(userID) {
//     gc.player.callPlayerInfo(userID, function (userID, playerInfo) {
//         var url = playerInfo.url;

//         if (!url || (url == "/0")) {
//             url = null;
//         }
//         else {
//             loadImage(url, function (spriteFrame) {
//                 headIcon = spriteFrame;
//             });
//             console.log("url: ", url);
//         }
//     });
// }


/**
 * 对节点设定图片
 * @param {CC.Node} node                        节点
 * @param {Object} spriteFrame                  需要的资源 （路径或者图片）
 * @param {CC.spriteFrame} defaultSpriteFrame   默认图片资源
 * @param {Function} callBack                   设定完毕后的回调函数
 * @param {Boolean} is_keep                     切换场景时资源是否不被销毁
 */
exports.setNodeSprite = setNodeSprite;
/**
 * 加载资源
 * @param {String} url                          需要的资源 （路径）
 * @param {Function} callBack                   设定完毕后的回调函数
 * @param {Boolean} is_keep                     切换场景时资源是否不被销毁
 */
exports.loadImage = loadImage;
/**
 * 对节点设定图片（玩家自己的头像将会自动设定为切换场景不销毁）
 * @param {CC.Node} icon_node                                   头像节点
 * @param {Number} userID                                       玩家userID
 * @param {CC.SpriteFrame} defaultSpriteFrame                   默认头像
 */
exports.setPlayerHeadIcon = setPlayerHeadIcon;
exports.setDefaultHeadIcon = setDefaultHeadIcon;
exports.getDefaultHeadIcon = getDefaultHeadIcon;
/** 切换场景触发的资源清理 */
exports.clear = change_scene;
// exports.loadHeadIcon = loadHeadIcon;