cc.Class({
    extends: cc.Component,

    properties: {
        // inputName: cc.EditBox,
        // foo: {
        //    default: null,
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
    },

    onRandomBtnClicked: function () {
        var name = this.getRandomName();
        gc.text.setTxtString(cc.find("Canvas/center/inputName"), name);
    },

    // use this for initialization
    onLoad: function () {
        this.onRandomBtnClicked();
    },

    onBtnConfirmClicked: function () {
        // var name = this.inputName.string;
        var name = gc.text.getTxtString(cc.find("Canvas/center/inputName"));
        if (name == "") {
            console.log("invalid name.");
            return;
        }
        this.create(name);
    },
    getRandomName: function () {
        var firstNames = ["上官", "欧阳", "东方", "端木", "独孤", "司马", "南宫", "夏侯", "诸葛", "皇甫", "长孙", "宇文", "轩辕", "东郭", "子车", "东阳", "子言"];

        var lastNames = ["雀圣", "赌侠", "赌圣", "稳赢", "不输", "好运", "自摸", "有钱", "土豪"];
        var idx = Math.floor(Math.random() * firstNames.length);
        var idx2 = Math.floor(Math.random() * lastNames.length);
        return firstNames[idx] + lastNames[idx2];
    },
    create: function (name) {
        let account = {
            name: name,
            userId: gc.utils.randomNum(6)
        }
        cc.sys.localStorage.setItem("account", account);

        gc.wc.showWC("正在登录游戏");
        gc.utils.loadScene('hall');
    },
});
