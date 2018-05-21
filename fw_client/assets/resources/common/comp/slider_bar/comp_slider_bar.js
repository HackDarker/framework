cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        slider: cc.Slider,
        progressBar: cc.ProgressBar,
    },

    // use this for initialization
    onLoad: function () {
        this.value = -1;
    },

    // called every frame, uncomment this function to activate update callback
    update: function (dt) {
        if (!this.progressBar)
            return;
        var tNowValue = this.slider.progress;
        if (tNowValue == this.value) {
            return;
        }

        this.progressBar.progress = tNowValue;
    },
});
