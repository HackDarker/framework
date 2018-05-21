
cc.Class({
    extends: cc.Component,

    properties: {

    },

    // LIFE-CYCLE CALLBACKS:

    // onLoad () {},

    start() {
        this.initView();
        this.initHandler();

        gc.utils.addEscEvent(this.node);
    },

    initView() {
        this._layer_top = cc.find('layout_btns/layer_top', this.node);
        this._layer_bottom = cc.find('layout_btns/layer_bottom', this.node);

        //layer_top
        let btn_user_info = this._layer_top.getChildByName('btn_user_info');
        let btn_star_info = this._layer_top.getChildByName('btn_star_info');
        let btn_credits = this._layer_top.getChildByName('btn_credits');
        let btn_H3 = this._layer_top.getChildByName('btn_H3');
        let btn_crystals = this._layer_top.getChildByName('btn_crystals');

        gc.button.addBtnClickEvent(btn_user_info, this.node, this, "onBtnUserInfoClicked");
        gc.button.addBtnClickEvent(btn_star_info, this.node, this, "onBtnStarInfoClicked");
        gc.button.addBtnClickEvent(btn_credits, this.node, this, "onBtnCreditsClicked");
        gc.button.addBtnClickEvent(btn_H3, this.node, this, "onBtnH3Clicked");
        gc.button.addBtnClickEvent(btn_crystals, this.node, this, "onBtnCrystalsClicked");
        //layer_bottom
        let btn_lab = this._layer_bottom.getChildByName('btn_lab');
        let btn_rank = this._layer_bottom.getChildByName('btn_rank');
        let btn_messages = this._layer_bottom.getChildByName('btn_messages');
        let btn_setting = this._layer_bottom.getChildByName('btn_setting');

        gc.button.addBtnClickEvent(btn_lab, this.node, this, "onBtnLabClicked");
        gc.button.addBtnClickEvent(btn_rank, this.node, this, "onBtnRankClicked");
        gc.button.addBtnClickEvent(btn_messages, this.node, this, "onBtnMessagesClicked");
        gc.button.addBtnClickEvent(btn_setting, this.node, this, "onBtnSettingClicked");
    },
    initHandler() {

        gc.on('', () => {

        });

    },
    //layout_top
    onBtnUserInfoClicked(event) {
        console.log('显示玩家信息面板');
        gc.alert.showUI('显示玩家信息面板');
    },
    onBtnStarInfoClicked(event) {
        console.log('显示恒星信息面板');
        gc.alert.showUI('显示恒星信息面板');
    },
    onBtnCreditsClicked(event) {
        console.log('显示货币信息面板');
        gc.alert.showUI('显示货币信息面板');
    },
    onBtnH3Clicked(event) {
        console.log('显示氦3信息面板');
        gc.alert.showUI('显示氦3信息面板');
    },
    onBtnCrystalsClicked(event) {
        console.log('显示晶体信息面板');
        gc.alert.showUI('显示晶体信息面板');
    },
    //layout_bottom
    onBtnLabClicked(event) {
        console.log('显示研究室面板');
        gc.alert.showUI('显示研究室面板');
    },
    onBtnRankClicked(event) {
        console.log('显示排行榜面板');
        gc.alert.showUI('显示排行榜面板');
    },
    onBtnMessagesClicked(event) {
        console.log('显示邮件面板');
        gc.alert.showUI('显示邮件面板');
    },
    onBtnSettingClicked(event) {
        console.log('显示设置面板');
        // gc.alert.showUI('显示设置面板');
        gc.ui.showUI('setting_platform', () => {
            console.log('显示设置面板成功');
        });
    },

    openLog() {
        if (gc.ui.isShow('log')) {
            gc.ui.hideUI('log');
            return
        }
        gc.ui.showUI('log', () => {
            console.log('log has show');
        });
    },
    // update (dt) {},
});
