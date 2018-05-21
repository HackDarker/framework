/**
 * Auther：Rango
 * Date:2018.4.22
 * Description：游戏场景管理器 
 */
module.exports = ModuleClass;
function ModuleClass() {
    this.settings = null;
    this.masterCache = {};
};

ModuleClass.prototype.init = function () {

}
/**
 * 初始化游戏全局配置
 */
ModuleClass.prototype.start = function () {
    this.settings = gc.settings.masters;
}
/**
 * 根据AppSetting配置的场景数据对多场景进行管理
 * @param {*} id 场景名
 * @param {*} dontLoadScene 不加载场景 
 * @param {*} params 
 */
ModuleClass.prototype.enter = function (id, dontLoadScene, params) {
    var cfg = this.settings[id];

    if (gc.masterSettings && gc.masterSettings.id == id) {
        console.log('no need switch.');
        return;
    }

    if (!cfg) {
        console.log('can not find settings with id:', id);
        return false;
    }
    if (cfg.enable == false) {
        return false;
    }

    cfg.id = id;

    if (gc.master) {
        gc.master.exit();
    }
    gc.subgame = null;
    gc.masterSettings = null;

    if (!this.masterCache[cfg.master_script]) {//缓存没有主逻辑，则重新加载
        var MasterClass = require(cfg.master_script);
        this.masterCache[cfg.master_script] = new MasterClass();
    }

    gc.master = this.masterCache[cfg.master_script];
    if (cfg.type == 'subgame') {
        gc.subgame = gc.master;
    }

    gc.masterSettings = cfg;
    gc.master.enter(params);
    if (cfg.entry_scene && !dontLoadScene) {
        console.log('当前的场景：', cfg);
        gc.utils.loadScene(cfg.entry_scene);
    }

    return true;
}
