
cc.Class({
    extends: cc.Component,

    properties: {
     
    },
    onLoad: function () {
        this._time = 0;
        this.on_offbool = -1;
        this.shopid=2;
        this.buyId=2001;
        this.getShopData();
    },
    
    start: function () {
        this.chongzhiClicked();
        this.chongzhijiluClicked();
        this.quedingchongzhi();
    },

    getShopData: function () {
        gc.wc.showWC('正在获取商品信息');
        var self = this;
        var onGet = function (ret) {
            if (ret.errcode !== 0) {
                console.log(ret.errmsg);
                self.showItems(null);
            }
            else { 
                self.showItems(ret.data);
            }
        };

        var data = {
            account: gc.user.account,
            sign: gc.user.sign,
            shopid: self.shopid,
        };
        gc.http.sendRequest("/get_shop_data", data, onGet);
    },

    //显示商品信息
    showItems: function (data) {
        gc.wc.hideWC();
        if (data == null) {
            gc.alert.showUI('获取商店信息失败，请稍后重试', function () {
            }.bind(this));
          return;
        }
        
        for (var k in data) {
            var itemData = data[k];
            var itemView = this._contentRoot.children[k];
            if(!itemView)
            {
                break;
            }
            itemView.itemData = itemData;
            this.initButtonHandler(itemView.getChildByName('btn_zhuanshi'));//购买钻石按钮
            gc.text.setTxtString(cc.find("btn_zhuanshi/price", itemView), itemData.price);
            gc.text.setTxtString(cc.find("zhuangs/fkz/gain", itemView), itemData.gain);
        }
    },

    
    chongzhiClicked:function(){//充值窗口
        this._rechargeRoot = this.node;//充值窗口主节点
        var btnClose = this._rechargeRoot.getChildByName('btn_close');//关闭按钮
        gc.button.addBtnClickEvent(btnClose, this.node, this, "onButtonClicked");
        this._contentRoot = cc.find("bg_cz/ScrollView/view/content",this.node);//滑动事各按钮主节点
        this._bg_CZgeRoot = cc.find('bg_cz',this.node);//充值背景节点  
        this._bg_CZgeRoot.active =true;
        var btnCZJL_1 = this._bg_CZgeRoot.getChildByName('binCZJL_1');//打开充值记录按钮
        this.onButtonHandler(btnCZJL_1);

    }, 
    
    quedingchongzhi:function(){//确定充值
        this._zhifu = cc.find("zhifu",this.node);
        this._zhifu.active=false;
        var _btnok = this._zhifu.getChildByName('btnOK');
        var _zhifucolse = this._zhifu.getChildByName('btncolse');
        
        this.onButtonHandler(_btnok);
        this.onButtonHandler(_zhifucolse);

        this._xuanzezhifu = [];
        var t = this._zhifu.getChildByName("choose");
        for(var i = 0; i < t.childrenCount; ++i){
            var n = t.children[i].getComponent("RadioButton");
            if(n != null){
                this._xuanzezhifu.push(n);
            }
        }
    },
    //---新增 ----流水记录 未添加节点
    chongzhijiluClicked:function(){//充值记录窗口  //节点未添加
            this._CzhiJLgeRoot = cc.find("chongzhijl_bg",this.node);//充值记录背景主节点
            this._CzhiJLgeRoot.active =false;
            this._viewlist = this._CzhiJLgeRoot.getChildByName("ScrollView");
            this._content = cc.find("view/content",this._viewlist);
            this._viewitemTemp = this._content.children[0];
            this._content.removeChild(this._viewitemTemp);
            var btnCZ_1 = this._CzhiJLgeRoot.getChildByName('binCZ_1');//打开充值界面按钮
            this.onButtonHandler(btnCZ_1);
            this.qingqiujilu();
    },

    qingqiujilu:function(){
        var onCreate = function(ret){
                if(ret.errcode === 0){
                    console.log('充值记录成功',ret);
                    gc.user.chongzhiJL=ret;
                   }else{
                       console.log('充值记录失败',ret);
                       gc.user.chongzhiJL=ret;
                   }
                   
                };
                
            var data = {
                account:gc.user.account,
                sign:gc.user.sign,
                userid:gc.user.userId,
            };
            gc.http.sendRequest("/get_pay_record",data,onCreate);
            if(gc.user.chongzhiJL){
                this.initchongzhiJiLuList(gc.user.chongzhiJL);
            }
    },

    Opbtnclicked:function(){
        this.qingqiujilu();
    },
    //--------end  未添加节点----------------

    onButtonHandler:function(btnPath){//多选按钮判断
        gc.button.addBtnClickEvent(btnPath, this.node, this, "onButtonClicked");       
    },//end
     initButtonHandler:function(btnPath){//
        gc.button.addBtnClickEvent(btnPath, this.node, this, "onToolBarClicked");     
    },//end

    onButtonClicked:function(event){
        if(event.target.name == 'btncolse'){//关闭支付窗口
            this._zhifu.active = false;
            return;
        }
        else if(event.target.name == 'btn_close'){//关闭充值窗口
            // var onLogin = function (ret) {
            //     console.log("===申请游戏币===",ret);
            //     if (ret.errcode !== 0) {
            //        // gc.http.sendRequest("/get_gems", { account: gc.user.account, sign: gc.user.sign }, onLogin);
            //     } else {
            //         if (gc.user.gems != ret.gems) {
            //             var addgems = gc.user.gems - ret.gems;
            //             gc.alert.showUI("充值成功钻石+" + Math.abs(addgems));
            //             gc.user.gems = ret.gems;
            //         }
            //     }
            // }
            // gc.http.sendRequest("/get_gems", { account: gc.user.account, sign: gc.user.sign }, onLogin);
            gc.ui.hideUI(this);
            return;
        }
        else if(event.target.name == 'shop'||event.target.name == 'btn_recharge'){
            var self=this;
            this.qingqiujilu();
            return;
        }
         else if(event.target.name == 'binCZJL_1'){
            this.qingqiujilu();
            this._bg_CZgeRoot.active=false;//关闭充值背景
            this._CzhiJLgeRoot.active=true;//关闭充值记录背景
            return;
         }   
        else if(event.target.name == 'binCZ_1'){
            console.log("打开充值");
            this._bg_CZgeRoot.active=true;//打开充值背景
            this._CzhiJLgeRoot.active=false;//关闭充值记录背景
            return;
         }else if(event.target.name == 'btnOK'){
            this.pay();
            this._zhifu.active=false;
            return;
         }else if(event.target.name == 'btncolse'){
            this._zhifu.active=false;
            return;
         }    
    },//end

  
    onToolBarClicked: function (event) {
        if(event.target)
        {
            this.buyId=event.target.parent.itemData.item_id;
        }
        this._zhifu.active = true;
    },
   
    shrinkContent:function(num){//增添列表
        while(this._content.childrenCount > num){
            this.lastOne[this._content.childrenCount -1] = this._content.children[this._content.childrenCount -1];
            this._content.removeChild(this.lastOne[this._content.childrenCount -1],true);
        }
    },
    getViewItem:function(index){
        var btncontent = this._content;
        if(btncontent.childrenCount > index){
            return btncontent.children[index];
        }
        var node = cc.instantiate(this._viewitemTemp);//克隆节点
        btncontent.addChild(node);
        return node;
    }, 

    initchongzhiJiLuList:function(data){   //充值记录克隆
        let index=data.length;
        let shopmun=[2001,2002,2003,2004];
        let moneymun=[30,60,120,240];
        let shunxu = 0;
        for(let i = index-1; i >=0; --i){
            if(data[i]!=null){
                let node = this.getViewItem(shunxu);
                shunxu++;
                node.idx = i;
                let datetime = this.dateFormat(data[i].time*1000);//转换时间
                //var conf = JSON.parse(data);
                node.getChildByName("liushui").getComponent(cc.Label).string = data[i].order_id;//流水号
                let money=0;
                for(let j=0;j<shopmun.length;j++){
                    if(shopmun[j]==data[i].item_id){
                        money=moneymun[j];
                        break;
                    }
                }
                node.getChildByName("monry").getComponent(cc.Label).string = money;//金额
                if(gc.user.agent_id!=null){
                    node.getChildByName("daili").getComponent(cc.Label).string = gc.user.agent_id;//代理
                }else{
                    node.getChildByName("daili").getComponent(cc.Label).string = '未绑定';//代理
                }
                node.getChildByName("zhuangtai").getComponent(cc.Label).string = data[i].state==3?'已支付':'未支付';//状态
                node.getChildByName("timers").getComponent(cc.Label).string = datetime;//时间
            }
        this.shrinkContent(index);
        }
    },

    dateFormat:function(time){//当前时间时间
        var date = new Date(time);
        var datetime = "{0}-{1}-{2} {3}:{4}:{5}";
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        month = month >= 10? month : ("0"+month);
        var day = date.getDate();
        day = day >= 10? day : ("0"+day);
        var h = date.getHours();
        h = h >= 10? h : ("0"+h);
        var m = date.getMinutes();
        m = m >= 10? m : ("0"+m);
        var s = date.getSeconds();
        s = s >= 10? s : ("0"+s);
        datetime = datetime.format(year,month,day,h,m,s);
        return datetime;
    },

    pay:function(){
        console.log("调用接口哟");
        this._time=-1;
        var self = this;
        var zhifuxuanze = 0;
        for(var i = 0; i < this._xuanzezhifu.length; ++i){
            if(this._xuanzezhifu[i].checked){
                zhifuxuanze = i;
                break;
            }     
        }
        let str='wechat';
        if(zhifuxuanze==1){
            str='alipay';
        }
        
        var onCreate = function (ret) {
            console.log("充值测试哟!!",ret);
            if (ret.url) {
                cc.sys.openURL(ret.url);
                self._orderid = ret.orderid;
                 self.on_offbool=1;
                setTimeout(function () {
                    self.onPayCloseClicked();
                }, 3000);
            }
        };

        var data = {
          account:gc.user.account,
          sign:gc.user.sign,
          item_id:self.buyId,
          pay_type:str,
          agent_id:null,
          userid:gc.user.userId,
        };
       gc.http.sendRequest("/get_pay_url",data,onCreate);
    },

    onPayCloseClicked: function () {
        var self=this;
        var onGet = function (ret) {
            console.log("onPayCloseClicked--ret:", ret);
            if (ret.errcode == 0) {
                var onLogin = function (ret) {
                    if (ret.errcode !== 0) {
                        gc.alert.showUI("充值成功了哟");
                    } else {
                        if (gc.user.gems != ret.gems) {
                            var addgems = gc.user.gems - ret.gems;
                            gc.alert.showUI("充值成功钻石+" + Math.abs(addgems));
                            gc.user.gems = ret.gems;
                        }
                    }
                }
                gc.http.sendRequest("/get_gems", { account: gc.user.account, sign: gc.user.sign }, onLogin);
            } else {
                self._time = 10;
            }
        };
        var data = {
          account:gc.user.account,
          sign:gc.user.sign,
          orderid: this._orderid,
        };
        gc.http.sendRequest("/get_pay_state", data, onGet);
    },

    
    // called every frame, uncomment this function to activate update callback
    update: function (dt) {
        if(this._time > 0){
            this._time -= dt;
            if(Math.ceil(this._time)==0){
                if(this.on_offbool>=0){
                    this.onPayCloseClicked();
                    this.on_offbool--;
                }
            }
        }
    },
});
