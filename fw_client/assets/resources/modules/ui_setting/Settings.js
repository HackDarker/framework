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
        _btnYXOpen:null,
        _btnYXClose:null,
        _btnYYOpen:null,
        _btnYYClose:null,
    },

    // use this for initialization
    onLoad: function () {            
        this._btnYXOpen = this.node.getChildByName("yinxiao").getChildByName("btn_yx_open");
        this._btnYXClose = this.node.getChildByName("yinxiao").getChildByName("btn_yx_close");
        
        this._btnYYOpen = this.node.getChildByName("yinyue").getChildByName("btn_yy_open");
        this._btnYYClose = this.node.getChildByName("yinyue").getChildByName("btn_yy_close");

        this._btnSqjsfj = this.node.getChildByName("btn_sqjsfj");
        this.initButtonHandler(this._btnSqjsfj);
        
        this.initButtonHandler(this.node.getChildByName("btn_close"));
        
        this.initButtonHandler(this._btnYXOpen);
        this.initButtonHandler(this._btnYXClose);
        this.initButtonHandler(this._btnYYOpen);
        this.initButtonHandler(this._btnYYClose);
        

        var slider = this.node.getChildByName("yinxiao").getChildByName("progress");
        this.addSlideEvent(slider,this.node,"Settings","onSlided");
        
        var slider = this.node.getChildByName("yinyue").getChildByName("progress");
        this.addSlideEvent(slider,this.node,"Settings","onSlided");
        
        this.refreshVolume();
    },

    addSlideEvent:function(node,target,component,handler){
        var eventHandler = new cc.Component.EventHandler();
        eventHandler.target = target;
        eventHandler.component = component;
        eventHandler.handler = handler;

        var slideEvents = node.getComponent(cc.Slider).slideEvents;
        slideEvents.push(eventHandler);
    },

    addClickEvent:function(node,target,component,handler){
        console.log(component + ":" + handler);
        var eventHandler = new cc.Component.EventHandler();
        eventHandler.target = target;
        eventHandler.component = component;
        eventHandler.handler = handler;

        var clickEvents = node.getComponent(cc.Button).clickEvents;
        clickEvents.push(eventHandler);
    },

    start:function(){
        var language = cc.sys.localStorage.getItem('settings_language');
        if(language != null){
            this.setRadioButton(language,true);
        }
        gc.room.mj_yuyan = language;
        this._lastLanguage = language;
    },
    
    onSlided:function(slider){
        if(slider.node.parent.name == "yinxiao"){
            gc.audio.setSFXVolume(slider.progress);
        }
        else if(slider.node.parent.name == "yinyue"){
            gc.audio.setBGMVolume(slider.progress);
        }
        this.refreshVolume();
    },
    
    initButtonHandler:function(btn){
        this.addClickEvent(btn,this.node,"Settings","onBtnClicked");    
    },
    
    refreshVolume:function(){
        
        this._btnYXClose.active = gc.audio.sfxVolume > 0;
        this._btnYXOpen.active = !this._btnYXClose.active;
        
        var yx = this.node.getChildByName("yinxiao");
        var width = 333 * gc.audio.sfxVolume;
        var progress = yx.getChildByName("progress")
        progress.getComponent(cc.Slider).progress = gc.audio.sfxVolume;
        progress.getChildByName("progress").width = width;  
        //yx.getChildByName("btn_progress").x = progress.x + width;
        
        
        this._btnYYClose.active = gc.audio.bgmVolume > 0;
        this._btnYYOpen.active = !this._btnYYClose.active;
        var yy = this.node.getChildByName("yinyue");
        var width = 333 * gc.audio.bgmVolume;
        var progress = yy.getChildByName("progress");
        progress.getComponent(cc.Slider).progress = gc.audio.bgmVolume; 
        
        progress.getChildByName("progress").width = width;
        //yy.getChildByName("btn_progress").x = progress.x + width;
    },
    
    onBtnClicked:function(event){
        console.log("设置点击事啊=",event.target.name);
        gc.audio.playSFX("resources/common/sound", "button.mp3");
        if(event.target.name == "btn_close"){
            this.node.active = false;
        }
        else if(event.target.name == "btn_yx_open"){
            gc.audio.setSFXVolume(1.0);
            this.refreshVolume(); 
        }
        else if(event.target.name == "btn_yx_close"){
            gc.audio.setSFXVolume(0);
            this.refreshVolume();
        }
        else if(event.target.name == "btn_yy_open"){
            gc.audio.setBGMVolume(1);
            this.refreshVolume();
        }
        else if(event.target.name == "btn_yy_close"){
            gc.audio.setBGMVolume(0);
            this.refreshVolume();
        }
        else if(event.target.name == this._btnSqjsfj.name){
            gc.room.sendRoomDissolveRequest();
            this.node.active = false;
        }
    },

    setRadioButton(checkIndex,value){
        var t = this.node.getChildByName('language');
        if(t == null){
            return;
        }
        var c = t.children[checkIndex];
        if(c == null){
            return;
        }

        var n = c.getComponent("RadioButton");
        if(n == null){
            return;
        }
        n.setAsChecked(value);
    },

    getSelectedOfRadioGroup(){
        var t = this.node.getChildByName('language');
        if(t == null){
            return;
        }

        var arr = [];
        for(var i = 0; i < t.children.length; ++i){
            var n = t.children[i].getComponent("RadioButton");
            if(n != null){
                arr.push(n);
            }
        }
        var selected = 0;
        for(var i = 0; i < arr.length; ++i){
            if(arr[i].checked){
                selected = i;
                break;
            }     
        }
        return selected;
    },

    // called every frame, uncomment this function to activate update callback
    update: function (dt) {
        var language = this.getSelectedOfRadioGroup();
        if(this._lastLanguage != language){
            cc.sys.localStorage.setItem('settings_language',language);
            console.log("==选择本地声音==",language);
            gc.room.mj_yuyan = language;
            this._lastLanguage = language;
        }

        if (gc.room.numOfGames > 0){
            this._btnSqjsfj.active = true;
        }
        else{
             this._btnSqjsfj.active = false;
        }
    },
});
