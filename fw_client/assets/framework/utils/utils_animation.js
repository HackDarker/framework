/** 当前加载进来的资源列表 */
var tmp_source = null;
/** 当前加载的回调函数列表 {efx_name ,cc.Node ,function} */
var loading_call = null;
/** 排除列表 */
var keep_list = null;

/**
 * 在节点上自动加载并播放动画
 * @param  {cc.Node} node       播放动画的节点
 * @param  {String} efxName     动画名字
 * @param  {String} efxPath     动画的路径
 * @param  {Function} callBack  回调函数
 */
function playEfx(node, efxName, efxPath, callBack) {
    console.log('debug Utils play efx node: ', node);
    console.log("debug Utils play efx name: ", efxName);
    console.log("debug Utils play efx path: ", efxPath);
    if (!cc.isValid(node)) {
        return;
    }

    if (efxPath.charAt(efxPath.length - 1) != "/") {
        efxPath += "/";
    }
    var load_url = efxPath + efxName;

    // var tPlay = function (animation, efx_name) {
    //     animation.play(efx_name);
    // }

    var tAddAndPlayClip = function (err, clip) {
        if (!cc.isValid(clip)) {
            cc.loader.loadRes(load_url, tAddAndPlayClip);
            return;
        }
        tmp_source[load_url] = clip;

        var tCallList = loading_call[load_url] || [];

        while (tCallList.length) {
            var tLoadInfo = tCallList.pop();
            if (tLoadInfo.efx_name != tLoadInfo.anim_node.now_efx_name) {
                continue;
            }

            var ani = tLoadInfo.anim_node.getComponent(cc.Animation);
            if (!ani) {
                ani = tLoadInfo.anim_node.addComponent(cc.Animation);
            }
            if (clip) {
                ani.addClip(clip, tLoadInfo.efx_name);
                ani.play(tLoadInfo.efx_name);
            }
            if (tLoadInfo.call_back) {
                tLoadInfo.call_back(clip).bind(ani);
            }
        }

        // var tAni = this;
        // if (tAni.node.clipMap[clip.name] == 'loading') {
        //     tAni.node.clipMap[clip.name] = 'loaded';
        //     tAni.addClip(clip);
        // }
        // tPlay(tAni, clip.name);
    }

    if (node) {
        node.now_efx_name = efxName;

        loading_call = loading_call || {};
        loading_call[load_url] = loading_call[load_url] || [];
        loading_call[load_url].push({
            efx_name: efxName,
            anim_node: node,
            call_back: callBack,
        });
    }

    if (cc.isValid(tmp_source[load_url])) {                         //有资源
        tAddAndPlayClip(null, tmp_source[load_url]);
    }
    else if (tmp_source[load_url]) {
        delete tmp_source[load_url];
    }

    if (!(load_url in tmp_source)) {                               //还没有开始加载
        tmp_source[load_url] = null;
        cc.loader.loadRes(load_url, tAddAndPlayClip);
    }


    // if (node.clipMap == null) {
    //     node.clipMap = {};
    //     var clips = ani.getClips();
    //     for (var i = 0; i < clips.length; ++i) {
    //         var clip = clips[i];
    //         node.clipMap[clip.name] = 'loaded';
    //     }
    // }

    // if (node.clipMap[efxName] == 'loaded') {
    //     tPlay(ani, efxName);
    //     return;
    // }

    // if (node.clipMap[efxName] == 'loading') {
    //     return;
    // }

    // node.clipMap[efxName] = 'loading';
    // //在
    // cc.loader.loadRes(load_url, tAddAndPlayClip.bind(ani));
}

function change_scene() {
    // for (var tKey in tmp_source) {                                  //销毁所有中途加载的资源
    //     if (keep_list && keep_list[tKey]) { continue; }             //不销毁的资源
    //     var tClip = tmp_source[tKey]
    //     if (!tClip || !cc.isValid(tClip)) { continue; }
    //     tClip.destroy();
    // }
    tmp_source = {};                                                //加载的文件列表
    loading_call = {};                                              //清空所有的加载回调
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


/**
 * 在节点上自动加载并播放动画
 * @param  {cc.Node} node       播放动画的节点
 * @param  {String} efxName     动画名字
 * @param  {String} efxPath     动画的路径
 */
exports.playEfx = playEfx;
exports.clear = change_scene;
