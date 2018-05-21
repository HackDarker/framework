/**
 * 注册UI信息，UIMgr通过ui名实例化相应UI组件
 */
var setttings = [
    {
        name: 'alert',
        prefab: 'modules/ui_alert/ui_alert',
        script: 'ui_alert'
    },

    {
        name: 'wc',
        prefab: 'modules/ui_waiting_connection/waiting_connection',
        script: 'waiting_connection'
    },

    {
        //新版本下载界面
        name: 'download_alert',
        prefab: 'modules/ui_download_alert/ui_download_alert',
        script: 'ui_download_alert',
    },

    {
        //分享界面
        name: 'share',
        prefab: 'modules/ui_share/share',
        script: 'share',
    },

    {
        //大厅设置界面
        name: 'setting_platform',
        prefab: 'modules/ui_setting/setting_platform',
        script: 'setting_platform_script',
    },

    {
        //游戏设置界面
        name: 'settings_game',
        prefab: 'modules/ui_setting/settings',
        script: 'Settings',
    },

    {
        //用户信息界面 大厅
        name: 'player_info_lobby',
        prefab: 'modules/ui_player_info/ui_player_info',
        script: 'ui_player_info_lobby',
    },

    {
        //用户信息界面 游戏中
        name: 'player_info_game',
        prefab: 'modules/ui_player_info/ui_player_info_ingame',
        script: 'ui_player_info_game',
    },

    {
        //加入房间界面
        name: 'join_game',
        prefab: 'modules/ui_join_room/ui_join_room',
        script: 'ui_join_room_script',
    },

    {
        //协商解散界面
        name: 'ui_dissolve_notice',
        prefab: 'modules/ui_dissolve_notice/ui_dissolve_notice',
        script: 'ui_dissolve_notice_script',
    },

    {
        //弹出广告界面
        name: 'poster',
        prefab: 'modules/ui_poster/ui_poster',
        script: 'ui_poster',
    },

    {
        //绑定代理界面
        name: 'bind_agent',
        prefab: 'modules/ui_bind_agent/ui_bind_agent',
        script: 'ui_bind_agent_script'
    },

    {
        //客服界面
        name: 'kefu',
        prefab: 'modules/ui_ke_fu/ke_fu',
        script: 'ke_fu_script'
    },

    {
        //活动界面
        name: 'ui_active',
        prefab: 'modules/ui_activity/activity',
        script: 'ui_activity_sc',
    },

    {
        //支付界面
        name: 'payment',
        prefab: 'modules/ui_pay/payment',
        script: 'payment'
    },

    {
        //支付选择界面
        name: 'paySelect',
        prefab: 'modules/ui_pay/ui_pay_select',
        script: 'ui_pay_select'
    },

    {
        //商店界面
        name: 'mall',
        prefab: 'modules/ui_mall/mall',
        script: 'mall_script'
    },

    {
        //聊天界面
        name: 'chat',
        prefab: 'modules/ui_chat/ui_chat',
        script: 'ui_chat_script',
    },

    {
        //消息界面
        name: 'xiaoxi',
        prefab: 'modules/ui_xinxi/ui_xinxi',
        script: 'OnBack'
    },



    {
        //调试日志显示
        name: 'log',
        prefab: 'modules/ui_log/log',
        script: 'log'
    }


]
module.exports = setttings;