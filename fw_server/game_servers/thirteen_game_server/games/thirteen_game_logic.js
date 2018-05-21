'use strict';
var HAND_CARD_COUNT = 13                    //扑克数目
var cbIndexCount = 4;

var ThirteenGameLogic = {};

var CT_INVALID = 0;                           //错误类型
var CT_SINGLE = 1;                            //单牌类型
var CT_ONE_DOUBLE = 2;                        //只有一对
var CT_TWO_DOUBLE = 3;                        //两对牌型
var CT_THREE = 4;                             //三张牌型
var CT_FIVE_MIXED_FLUSH_FIRST_A = 5;          //A前顺子
var CT_FIVE_MIXED_FLUSH_NO_A = 6;             //普通顺子
var CT_FIVE_MIXED_FLUSH_BACK_A = 7;           //A后顺子
var CT_FIVE_FLUSH = 8;                        //同花
var CT_FIVE_THREE_DEOUBLE = 9;                //三条一对
var CT_FIVE_FOUR_ONE = 10;                    //四带一张
var CT_FIVE_STRAIGHT_FLUSH_FIRST_A = 11;      //A同花顺
var CT_FIVE_STRAIGHT_FLUSH = 12;              //同花顺牌
var CT_FIVE = 13;                             //五同

//特殊类型
var CT_EX_INVALID = 14;                       //非特殊牌
var CT_EX_SANTONGHUA = 15;                    //三同花 1
var CT_EX_SANSHUNZI = 16;                     //三顺子 1
var CT_EX_LIUDUIBAN = 17;                     //六对半 1
var CT_EX_WUDUISANTIAO = 18;                  //五对一刻
var CT_EX_SITAOSANTIAO = 19;                  //四套三条1
var CT_EX_SHUANGGUAICHONGSAN = 20;            //双怪冲三
var CT_EX_COUYISE = 21;                       //凑一色
var CT_EX_QUANXIAO = 22;                      //全小
var CT_EX_QUANDA = 23;                        //全大
var CT_EX_SANFENGTIANXIA = 24;                //三分天下1
var CT_EX_SANTONGHUASHUN = 25;                //三同花顺1
var CT_EX_SHIERHUANGZU = 26;                  //十二皇族
var CT_EX_YITIAOLONG = 27;                    //一条龙1
var CT_EX_ZHIZUNQINGLONG = 28;                //至尊清龙1
var CT_EX_LIUDUIBAN_TIEZHI=29;                  //铁支六对半
var CT_EX_LIUDUIBAN_WUTONG=30;                  //五同六对半
var CT_EX_SAN_HU_LU=31;                         //三发
var CT_EX_QUAN_HEI_YIDIANHONG=32;                  //全黑一点红
var CT_EX_QUAN_HONG_YIDIANHEI=33;                  //全红一点黑
var CT_EX_QUAN_HEI=34;                  //全黑
var CT_EX_QUAN_HONG=35;                 //全红
var CT_EX_BANXIAO=36;                   //半小
var CT_EX_BANDA=37;                     //半大


//数值掩码
var LOGIC_MASK_COLOR = 0xF0;                  //花色掩码
var LOGIC_MASK_VALUE = 0x0F;                  //数值掩码

//分析结构
function struct_tagAnalyseData() {
    var ret = {};
    ret.bOneCount = 0;      //单张数目
    ret.bTwoCount = 0;      //两张数目 
    ret.bThreeCount = 0;    //三张数目
    ret.bFourCount = 0;     //四张数目
    ret.bFiveCount = 0;     //五张数目
    ret.bOneFirst = [];     //单牌位置
    ret.bTwoFirst = [];     //对牌位置
    ret.bThreeFirst = [];   //三条位置
    ret.bFourFirst = [];    //四张位置
    ret.bFiveFirst = [];     //五张位置
    ret.bSameColor = false;         //是否同花
    return ret;
}

//分析结构
function struct_tagAnalyseResult() {
    var ret = {};
    ret.cbBlockCount = [0, 0, 0, 0, 0,0,0];                        //同牌数目
    ret.cbCardData = [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]];                      //扑克列表
    return ret;
}

//分布信息
function struct_tagDistributing() {
    var ret = {};
    ret.cbCardCount = 0;                        //扑克数目
    ret.cbDistributing = [];              //分布信息
    for (var i = 0; i < 16; ++i) {
        ret.cbDistributing[i] = [0, 0, 0, 0, 0,0];
    }
    return ret;
}

//搜索结果
function struct_tagSearchCardResult() {
    var ret = {};
    ret.cbSearchCount = 0;                      //结果数目
    ret.cbCardCount = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];                    //扑克数目
    ret.cbResultCard = [];               //扑克列表
    for (var i = 0; i < 13; ++i) {
        ret.cbResultCard[i] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    }
    return ret;
};

//转化数据
function struct_tagTransData() {
    var ret = {};
    ret.bKingCount = 0;                         //王牌数目
    ret.bHaveKing = 0;                          //是否有王  (0 无 1 小王 2 大王 3 大小王)       
    ret.transList = [];                          //转化成的数字链表
    return ret;
};

var enCRLess = -1;
var enCREqual = 0;
var enCRGreater = 1;
var enCRError = 2;

//排列类型
var enDescend = 0;                                                              //降序类型 
var enAscend = 1;                                                               //升序类型
var enColor = 2;                                                                 //花色类型

function ASSERT(b) {
    if (!b) {
        try {
            throw new Error('assert.');
        }
        catch (err) {
            console.log(err);
        }
    }
}

function CopyMemory(arr1, arr2, begin1, begin2, len) {
    if (!begin1) {
        begin1 = 0;
    }
    if (!begin2) {
        begin2 = 0;
    }
    if (!len) {
        len = arr2.length;
    }
    for (var i = 0; i < len; ++i) {
        arr1[begin1 + i] = arr2[begin2 + i];
    }
}

function CREATE_ARRAY() {
    var ret = [];
    function local_create_array(arr, paramArray) {
        if (paramArray.length == 0) {
            for (var i = 0; i < 13; ++i) {
                arr[i] = 0;
            }
            return;
        }
        for (var i = 0; i < paramArray[0]; ++i) {
            arr[i] = [];
            local_create_array(arr[i], paramArray.slice(1));
        }
    }
    var argArr = [];
    for (var i = 1; i < arguments.length; ++i) {
        argArr.push(arguments[i]);
    }
    for (var i = 0; i < arguments[0]; ++i) {
        ret[i] = [];
        local_create_array(ret[i], argArr);
    }
    return ret;
}

//获取类型
function getCardType(bCardData, bCardCount) {
    //数据校验
    var bMaxCardData = 0;
    ASSERT(bCardCount == 3 || bCardCount == 5);
    if (bCardCount != 3 && bCardCount != 5)
        return [CT_INVALID, bMaxCardData];

    bMaxCardData = 0;

    bCardData = convertMagicCards(bCardData);

    //分析扑克
    var AnalyseData = struct_tagAnalyseData();
    analyseCard(bCardData, bCardCount, AnalyseData);
    sortCardList(bCardData, bCardCount, enDescend);

    //分析扑克
    var AnalyseResult = struct_tagAnalyseResult();
    analysebCardData(bCardData, bCardCount, AnalyseResult);

    //开始分析
    switch (bCardCount) {
        //三条类型
        case 3: {
            //单牌类型
            if (3 == AnalyseData.bOneCount) {
                bMaxCardData = getCardLogicValue(AnalyseResult.cbCardData[0][0]);
                return [CT_SINGLE, bMaxCardData];
            }

            //对带一张
            if (1 == AnalyseData.bTwoCount && 1 == AnalyseData.bOneCount) {
                bMaxCardData = getCardLogicValue(AnalyseResult.cbCardData[1][0]);
                return [CT_ONE_DOUBLE, bMaxCardData];
            }

            //三张牌型
            if (1 == AnalyseData.bThreeCount) {
                bMaxCardData = getCardLogicValue(AnalyseResult.cbCardData[2][0]);
                return [CT_THREE, bMaxCardData];
            }
            //错误类型
            return [CT_INVALID, bMaxCardData];
        }
        //五张牌型
        case 5: {
            var bFlushNoA = false;
            var bFlushFirstA = false;
            var bFlushBackA = false;

            //五同类型
            if (getCardLogicValue(bCardData[0]) == getCardLogicValue(bCardData[1])
                && getCardLogicValue(bCardData[0]) == getCardLogicValue(bCardData[2])
                && getCardLogicValue(bCardData[0]) == getCardLogicValue(bCardData[3])
                && getCardLogicValue(bCardData[0]) == getCardLogicValue(bCardData[4])) {
                return [CT_FIVE, bCardData[0]];
            }

            //A连在后
            if (14 == getCardLogicValue(bCardData[0]) && 10 == getCardLogicValue(bCardData[4])) {
                bFlushBackA = true;
            } else {
                bFlushNoA = true;
            }
            for (var i = 0; i < 4; ++i) {
                if (1 != getCardLogicValue(bCardData[i]) - getCardLogicValue(bCardData[i + 1])) {
                    bFlushBackA = false;
                    bFlushNoA = false;
                }
            }

            //A连在前
            if (false == bFlushBackA && false == bFlushNoA && 14 == getCardLogicValue(bCardData[0])) {
                bFlushFirstA = true;
                for (var i = 1; i < 4; ++i) {
                    if (1 != getCardLogicValue(bCardData[i]) - getCardLogicValue(bCardData[i + 1])) {
                        bFlushFirstA = false;
                    }
                }
                if (2 != getCardLogicValue(bCardData[4])) {
                    bFlushFirstA = false;
                }
            }

            //同花五牌
            if (false == bFlushBackA && false == bFlushNoA && false == bFlushFirstA) {
                if (true == AnalyseData.bSameColor) {
                    bMaxCardData = getCardLogicValue(AnalyseResult.cbCardData[0][0]);
                    if((1 == AnalyseData.bFourCount && 1 == AnalyseData.bOneCount)||(1 == AnalyseData.bThreeCount && 1 == AnalyseData.bTwoCount)){
                    
                    }else{
                        return [CT_FIVE_FLUSH, bMaxCardData];
                    }
                    
                }
            }
            else if (true == bFlushNoA) {
                bMaxCardData = getCardLogicValue(AnalyseResult.cbCardData[0][0]);
                //杂顺类型
                if (false == AnalyseData.bSameColor) {
                    if((1 == AnalyseData.bFourCount && 1 == AnalyseData.bOneCount)||(1 == AnalyseData.bThreeCount && 1 == AnalyseData.bTwoCount)){
                    
                    }else{
                        return [CT_FIVE_MIXED_FLUSH_NO_A, bMaxCardData];
                    }
                } else {
                    //同花顺牌
                    return [CT_FIVE_STRAIGHT_FLUSH, bMaxCardData];
                }
            }
            else if (true == bFlushFirstA) {
                bMaxCardData = getCardLogicValue(AnalyseResult.cbCardData[0][0]);
                //杂顺类型
                if (false == AnalyseData.bSameColor) {
                    if((1 == AnalyseData.bFourCount && 1 == AnalyseData.bOneCount)||(1 == AnalyseData.bThreeCount && 1 == AnalyseData.bTwoCount)){
                    
                    }else{                    
                        return [CT_FIVE_MIXED_FLUSH_FIRST_A, bMaxCardData];
                    }
                } else {
                    //同花顺牌
                    return [CT_FIVE_STRAIGHT_FLUSH_FIRST_A, bMaxCardData];
                }
            }
            else if (true == bFlushBackA) {
                bMaxCardData = getCardLogicValue(AnalyseResult.cbCardData[0][0]);
                //杂顺类型
                if (false == AnalyseData.bSameColor) {
                    if((1 == AnalyseData.bFourCount && 1 == AnalyseData.bOneCount)||(1 == AnalyseData.bThreeCount && 1 == AnalyseData.bTwoCount)){
                    
                    }else{                    
                        return [CT_FIVE_MIXED_FLUSH_NO_A, bMaxCardData];
                    }
                } else {
                    //同花顺牌
                    return [CT_FIVE_STRAIGHT_FLUSH, bMaxCardData];
                }
            }
            
            // if(14==getCardLogicValue(bCardData[0]) && getCardLogicValue(bCardData[1])==8){ //此玩法只适合3个人
                 
            //     let IsContinue=true;

            //       for(let i=1;i<4;i++){
            //           if(1!=bCardData[i]-bCardData[i+1])
            //               IsContinue=false;
            //       }
                   
            //       if(true==IsContinue){
                           
            //            bMaxCardData=getCardLogicValue(bCardData[1]);
            //             if(false==AnalyseData.bSameColor){
            //                 return [CT_FIVE_MIXED_FLUSH_NO_A, bMaxCardData];  //A变成4, 8 是顺子的最大值
            //             }
            //             else{
            //                     //同花顺牌
            //                 return [CT_FIVE_STRAIGHT_FLUSH, bMaxCardData];
            //             }
            //       }
                 

            // }

            //四带单张
            if (1 == AnalyseData.bFourCount && 1 == AnalyseData.bOneCount) {
                bMaxCardData = getCardLogicValue(AnalyseResult.cbCardData[3][0]);
                return [CT_FIVE_FOUR_ONE, bMaxCardData];
            }

            //三条一对
            if (1 == AnalyseData.bThreeCount && 1 == AnalyseData.bTwoCount) {
                bMaxCardData = getCardLogicValue(AnalyseResult.cbCardData[2][0]);
                return [CT_FIVE_THREE_DEOUBLE, bMaxCardData];
            }

            //三条带单
            if (1 == AnalyseData.bThreeCount && 2 == AnalyseData.bOneCount) {
                bMaxCardData = getCardLogicValue(AnalyseResult.cbCardData[2][0]);
                return [CT_THREE, bMaxCardData];
            }

            //两对牌型
            if (2 == AnalyseData.bTwoCount && 1 == AnalyseData.bOneCount) {
                bMaxCardData = getCardLogicValue(AnalyseResult.cbCardData[1][0]);
                return [CT_TWO_DOUBLE, bMaxCardData];
            }

            //只有一对
            if (1 == AnalyseData.bTwoCount && 3 == AnalyseData.bOneCount) {
                bMaxCardData = getCardLogicValue(AnalyseResult.cbCardData[1][0]);
                return [CT_ONE_DOUBLE, bMaxCardData];
            }

            //单牌类型
            if (5 == AnalyseData.bOneCount && false == AnalyseData.bSameColor) {
                bMaxCardData = getCardLogicValue(AnalyseResult.cbCardData[0][0]);
                return [CT_SINGLE, bMaxCardData];
            }

            //错误类型
            return [CT_INVALID, bMaxCardData];
        }
    }

    return [CT_INVALID, bMaxCardData];
}

function isMagicLinkCard(cards,magicCount){
    var tempcards=[];
    CopyMemory(tempcards,cards);
    if(tempcards.length!=13){
        return false;
    }
    //分析扑克
    var Distributing = struct_tagDistributing();
    analysebDistributing(tempcards, tempcards.length, Distributing);
    var needMagicCount=0;
    for(var i=0;i<tempcards.length;i++){
        if(Distributing.cbDistributing[i][cbIndexCount]==0){
            needMagicCount++;
        }
        if(needMagicCount>magicCount){
            return false;
        }
    }
    return true

}

//特殊牌型
function getSpecialType(bHandCardData, bCardCount) {
    console.log("特殊牌型")
    // console.log(bHandCardData)
    // console.log(bCardCount)

    ASSERT(bCardCount == HAND_CARD_COUNT);
    if (bCardCount != HAND_CARD_COUNT)
        return CT_EX_INVALID;

    //排列扑克
    var bCardData = [];
    CopyMemory(bCardData, bHandCardData);
    //排序扑克
    sortCardList(bCardData, bCardCount, enDescend);
    // console.log("排列后的扑克")
    // console.log(bCardData)

    // var anlysMagicResult = analyseMagicCards(bCardData);
    // console.log(anlysMagicResult)

    // if (anlysMagicResult.magicCount != 0) {
    //         if(isMagicLinkCard(bCardData,anlysMagicResult.magicCount)){
    //             var colornum=0;
    //             for(var i=0;i<anlysMagicResult.colorArray.length;i++){
    //                 if(anlysMagicResult.colorArray[i]){
    //                     colornum++;
    //                 }
    //             }
    //             if(colornum==2){
    //                 return CT_EX_ZHIZUNQINGLONG;
    //             }
    //             return CT_EX_YITIAOLONG;
    //         }
    //         return CT_EX_INVALID;
    // }
    //设置结果
    var AnalyseData = struct_tagAnalyseData();

    //变量定义
    var bSameCount = 1;
    var bCardValueTemp = 0;
    var bFirstCardIndex = 0;    //记录下标

    var bLogicValue = getCardLogicValue(bCardData[0]);
    var bCardColor = getCardColor(bCardData[0]);
    //////////////////////////////////////////////////////////////////////////
    //扑克分析
    for (var i = 1; i < bCardCount; i++) {
        //获取扑克
        bCardValueTemp = getCardLogicValue(bCardData[i]);
        if (bCardValueTemp == bLogicValue) {
            bSameCount++;
        }

        //保存结果
        if ((bCardValueTemp != bLogicValue) || (i == (bCardCount - 1))) {
            switch (bSameCount) {
                case 1:     //一张
                    break;
                case 2: {//两张
                    AnalyseData.bTwoFirst[AnalyseData.bTwoCount] = bFirstCardIndex;
                    AnalyseData.bTwoCount++;
                    break;
                }
                case 3: {//三张
                    AnalyseData.bThreeFirst[AnalyseData.bThreeCount] = bFirstCardIndex;
                    AnalyseData.bThreeCount++;
                    break;
                }
                case 4: {//四张
                    AnalyseData.bFourFirst[AnalyseData.bFourCount] = bFirstCardIndex;
                    AnalyseData.bFourCount++;
                    break;
                }
                case 5: {//四张
                    AnalyseData.bFiveFirst[AnalyseData.bFiveCount] = bFirstCardIndex;
                    AnalyseData.bFiveCount++;
                    break;
                }                
            }
        }

        //设置变量
        if (bCardValueTemp != bLogicValue) {
            if (bSameCount == 1) {
                if (i != bCardCount - 1) {
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = bFirstCardIndex;
                    AnalyseData.bOneCount++;
                } else {
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = bFirstCardIndex;
                    AnalyseData.bOneCount++;
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = i;
                    AnalyseData.bOneCount++;
                }
            } else {
                if (i == bCardCount - 1) {
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = i;
                    AnalyseData.bOneCount++;
                }
            }
            bSameCount = 1;
            bLogicValue = bCardValueTemp;
            bFirstCardIndex = i;
        }
    }

    //////////////////////////////////////////////////////////////////////////
    // //至尊青龙
    // if (isStraightDragon(bCardData, bCardCount) == true) {
    //     return CT_EX_ZHIZUNQINGLONG;
    // }

    //一条龙
    if ((isLinkCard(bCardData, bCardCount) == true)) {
        return CT_EX_YITIAOLONG;
    }
     


      //全黑全红
    var quanhei=0;
    var quanhong=0;
    for(var jj=0;jj<bCardCount;jj++){
        var color=getCardColor(bCardData[jj]);
       // console.log(color)
        if(color==1||color==3){
            quanhei++;
        }else if(color==0||color==2||color==18){
            quanhong++;
        }
    }
    // console.log(quanhei);
    // console.log(quanhong);
    if(quanhei==13){
        return CT_EX_QUAN_HEI;
    }else if(quanhei==12){
        return CT_EX_QUAN_HEI_YIDIANHONG;
    }
    if(quanhong==13){
        return CT_EX_QUAN_HONG;
    }else if(quanhong==12){
        return CT_EX_QUAN_HONG_YIDIANHEI;
    }        


    /* 三分天下要放在六对半前面 ------------neng*/

    //三分天下
    // if (AnalyseData.bFourCount == 3) {
    //     return CT_EX_SANFENGTIANXIA;
    // }
    
    // 三葫芦--两葫芦+三条

    if(AnalyseData.bTwoCount==2 && AnalyseData.bThreeCount==3){
       return  CT_EX_SAN_HU_LU;
    }

    //六对半
    if ((AnalyseData.bTwoCount+AnalyseData.bThreeCount+AnalyseData.bFourCount*2+AnalyseData.bFiveCount*2)== 6) {
        // if(AnalyseData.bFiveCount>0)return CT_EX_LIUDUIBAN_WUTONG;
        // if(AnalyseData.bFourCount>0)return CT_EX_LIUDUIBAN_TIEZHI;
        if(AnalyseData.bThreeCount>0)    return CT_EX_WUDUISANTIAO;
        return CT_EX_LIUDUIBAN;
    }

     /* 增加全大，全小，半大，半小特殊牌 ------- */

    var A = false;  //判断整幅牌是否有A
    var small=false;  //判断是否只能小牌
    var big = false;  //判断是否只能大牌
    // console.log("bCardData")
    // console.log(bCardData)
    for(var nn=0;nn<bCardCount;nn++){
        var cardLogicValue=getCardLogicValue(bCardData[nn]);
        if(cardLogicValue == 11 || cardLogicValue == 12 || cardLogicValue == 13){
            big = true;
        }
        if(cardLogicValue == 2 || cardLogicValue ==3 || cardLogicValue ==4 || cardLogicValue ==5){
            small = true;
        }
        if(cardLogicValue == 14){
            A = true;
        }
    }
    if(small && !big){
        if(A){
            console.log("牌型为半小")
            return CT_EX_BANXIAO;
        }else{
            console.log("牌型为全小")
            return CT_EX_QUANXIAO;
        }
    }
    if(!small && big){
        if(A){
            console.log("牌型为半大")
            return CT_EX_BANDA;
        }else{
            console.log("牌型为全大")
            return CT_EX_QUANDA;
        }
    }


    /* ----------------------------增加判断三同花顺 ---------start-------neng */
    //三同花顺
    var SameColorLineCardResult = struct_tagSearchCardResult();
    // console.log("检查是否进入三同花顺")
    // console.log(bCardData)
    var cbSameColorLineCardResult5 = searchSameColorLineType(bCardData, bCardCount, 5, SameColorLineCardResult);
    // console.log(SameColorLineCardResult)
    // console.log(cbSameColorLineCardResult5)
    if (cbSameColorLineCardResult5 >= 2) {
        //console.log("三同花顺")
        // console.log("SameColorLineCardResult")
        // console.log(SameColorLineCardResult)
        // console.log(cbSameColorLineCardResult5)
        for (var i = 0; i < cbSameColorLineCardResult5; ++i) {
            var ctype = getCardType(SameColorLineCardResult.cbResultCard[i], SameColorLineCardResult.cbCardCount[i])[0];
            // console.log("ctype")
            // console.log(ctype)
            if (ctype == 11|| ctype == 12) {
                var cbTempData = [];
                var cbTempCount = 13;
                CopyMemory(cbTempData, bCardData);

                removeCard(SameColorLineCardResult.cbResultCard[i], SameColorLineCardResult.cbCardCount[i], cbTempData, cbTempCount);
                // console.log("cbTempData")
                // console.log(cbTempData)
                cbTempCount = cbTempData.length;
                var LineCardResult1 = struct_tagSearchCardResult();
                var cbLineCardResult51 = searchSameColorLineType(cbTempData, cbTempCount, 5, LineCardResult1);
                // console.log("cbLineCardResult51")
                // console.log(cbLineCardResult51)
                if (cbLineCardResult51 >= 1) {
                    for (var j = 0; j < cbLineCardResult51; ++j) {
                        ctype = getCardType(LineCardResult1.cbResultCard[j], LineCardResult1.cbCardCount[j])[0];
                        // console.log("ctype")
                        // console.log(ctype)
                        if (ctype == 11|| ctype == 12) {
                            var cbTempData1 = [];
                            CopyMemory(cbTempData1, cbTempData);
                           // console.log("三同花顺子3", cbTempData);
                            // console.log("LineCardResult1")
                            // console.log(LineCardResult1)
                            // console.log("cbTempData1")
                            // console.log(cbTempData1)
                            // console.log("cbTempCount")
                            // console.log(cbTempCount)
                            removeCard(LineCardResult1.cbResultCard[j], LineCardResult1.cbCardCount[j], cbTempData1, cbTempData1.length);
                            cbTempCount = cbTempData1.length;
                            // console.log("cbTempData1")
                            // console.log(cbTempData1)
                            // console.log("isLinkCard(cbTempData1, cbTempCount)")
                            // console.log(isLinkCard(cbTempData1, cbTempCount))
                            if (isLinkCard(cbTempData1, cbTempCount) && isSameColorCard(cbTempData1,cbTempCount)) {
                                CopyMemory(bHandCardData, SameColorLineCardResult.cbResultCard[i], 0, 0, 5);
                                CopyMemory(bHandCardData, LineCardResult1.cbResultCard[j], 5, 0, 5);
                                sortCardList(cbTempData1, cbTempCount, enAscend);
                                CopyMemory(bHandCardData, cbTempData1, 10, 0, 3);  
                                // console.log("返回三同花顺")                              
                                return CT_EX_SANTONGHUASHUN;
                            }
                        }
                    }
                }
            }
        }
    }
    /* ----------------------------增加判断三同花顺 ---------end-------neng */

    //三顺子
    var LineCardResult = struct_tagSearchCardResult();
    // console.log("检查是否进入三顺子")
    // console.log(bCardData)
    var cbLineCardResult5 = searchLineCardType(bCardData, bCardCount, 5, LineCardResult);
    if (cbLineCardResult5 >= 2) {
        // console.log("三顺子")
        // console.log("LineCardResult")
        // console.log(LineCardResult)
        // console.log(cbLineCardResult5)
        for (var i = 0; i < cbLineCardResult5; ++i) {
            var ctype = getCardType(LineCardResult.cbResultCard[i], LineCardResult.cbCardCount[i])[0];
            // console.log("ctype")
            // console.log(ctype)
            if (ctype == 5 || ctype == 6|| ctype == 7|| ctype == 11|| ctype == 12) {
                var cbTempData = [];
                var cbTempCount = 13;
                CopyMemory(cbTempData, bCardData);

                removeCard(LineCardResult.cbResultCard[i], LineCardResult.cbCardCount[i], cbTempData, cbTempCount);
                // console.log("cbTempData")
                // console.log(cbTempData)
                cbTempCount = cbTempData.length;
                var LineCardResult1 = struct_tagSearchCardResult();
                var cbLineCardResult51 = searchLineCardType(cbTempData, cbTempCount, 5, LineCardResult1);
                // console.log("cbLineCardResult51")
                // console.log(cbLineCardResult51)
                if (cbLineCardResult51 >= 1) {
                    for (var j = 0; j < cbLineCardResult51; ++j) {
                        ctype = getCardType(LineCardResult1.cbResultCard[j], LineCardResult1.cbCardCount[j])[0];
                        // console.log("ctype")
                        // console.log(ctype)
                        if (ctype == 5 || ctype == 6|| ctype == 7|| ctype == 11|| ctype == 12) {
                            var cbTempData1 = [];
                            CopyMemory(cbTempData1, cbTempData);
                            // console.log("三顺子3", cbTempData);
                            // console.log("LineCardResult1")
                            // console.log(LineCardResult1)
                            // console.log("cbTempData1")
                            // console.log(cbTempData1)
                            // console.log("cbTempCount")
                            // console.log(cbTempCount)
                            removeCard(LineCardResult1.cbResultCard[j], LineCardResult1.cbCardCount[j], cbTempData1, cbTempData1.length);
                            cbTempCount = cbTempData1.length;
                            // console.log("cbTempData1")
                            // console.log(cbTempData1)
                            // console.log("isLinkCard(cbTempData1, cbTempCount)")
                            // console.log(isLinkCard(cbTempData1, cbTempCount))
                            if (isLinkCard(cbTempData1, cbTempCount)) {
                                CopyMemory(bHandCardData, LineCardResult.cbResultCard[i], 0, 0, 5);
                                CopyMemory(bHandCardData, LineCardResult1.cbResultCard[j], 5, 0, 5);
                                sortCardList(cbTempData1, cbTempCount, enAscend);
                                CopyMemory(bHandCardData, cbTempData1, 10, 0, 3);                                
                                return CT_EX_SANSHUNZI;
                            }
                        }
                    }
                }
            }
        }
    }

    //三同花
    var SameColorResult = struct_tagSearchCardResult();
    var cbSameColorResult5 = searchSameColorType(bCardData, bCardCount, 5, SameColorResult);
    if (cbSameColorResult5 >= 2) {
        // console.log("进入三同花")
        // console.log("SameColorResult")
        // console.log(SameColorResult)
        // console.log("SameColorResult")
        
        if (isSameColorCard(SameColorResult.cbResultCard[0], SameColorResult.cbCardCount[0])) {
            var cbTempData = [];
            var cbTempCount = 13;
            CopyMemory(cbTempData, bCardData);

            //后墩扑克
            removeCard(SameColorResult.cbResultCard[0], SameColorResult.cbCardCount[0], cbTempData, cbTempCount);
            cbTempCount -= SameColorResult.cbCardCount[0];
            // console.log("后道")
            // console.log("cbTempData")
            // console.log(cbTempData)
            // console.log(SameColorResult)

            var SameColorResult1 = struct_tagSearchCardResult();
            var cbSameColorResult51 = searchSameColorType(cbTempData, cbTempCount, 5, SameColorResult1);
            // console.log("cbSameColorResult51")
            // console.log(cbSameColorResult51)
            if (cbSameColorResult51 >= 1) {
                if (isSameColorCard(SameColorResult1.cbResultCard[0], SameColorResult1.cbCardCount[0])) {
                    var cbTempData1 = [];
                    CopyMemory(cbTempData1, cbTempData);

                    //中墩扑克
                    removeCard(SameColorResult1.cbResultCard[0], SameColorResult1.cbCardCount[0], cbTempData1, cbTempCount);
                    cbTempCount -= SameColorResult1.cbCardCount[0];
                    // console.log("前道")
                    // console.log("cbTempData")
                    // console.log(cbTempData)
                    // console.log(SameColorResult)
                    // console.log("SameColorResult")
                    // console.log(SameColorResult)
                    // console.log("cbTempData1")
                    // console.log(cbTempData1)
                    if (isSameColorCard(cbTempData1, cbTempCount)) {
                                CopyMemory(bHandCardData, SameColorResult.cbResultCard[0], 0, 0, 5);
                                CopyMemory(bHandCardData, SameColorResult1.cbResultCard[0], 5, 0, 5);
                                sortCardList(cbTempData1, cbTempCount, enAscend);
                                CopyMemory(bHandCardData, cbTempData1, 10, 0, 3);                           
                        return CT_EX_SANTONGHUA;
                    }
                }
            }
        }
    }

    //四套三条
    if (AnalyseData.bThreeCount == 4) {
        return CT_EX_SITAOSANTIAO;
    }

    

    //非特殊牌
    return CT_EX_INVALID;
}

function getAllSpecialType(bHandCardData, bCardCount,Type) {
    // console.log("特殊牌型")
    // console.log(bHandCardData)
    // console.log(bCardCount)

    ASSERT(bCardCount == HAND_CARD_COUNT);
    if (bCardCount != HAND_CARD_COUNT)
        return CT_EX_INVALID;

    //排列扑克
    var bCardData = [];
    CopyMemory(bCardData, bHandCardData);
    //排序扑克
    sortCardList(bCardData, bCardCount, enDescend);
    // console.log("排列后的扑克")
    // console.log(bCardData)

    //设置结果
    var AnalyseData = struct_tagAnalyseData();

    //变量定义
    var bSameCount = 1;
    var bCardValueTemp = 0;
    var bFirstCardIndex = 0;    //记录下标

    var bLogicValue = getCardLogicValue(bCardData[0]);
    var bCardColor = getCardColor(bCardData[0]);
    //////////////////////////////////////////////////////////////////////////
    //扑克分析
    for (var i = 1; i < bCardCount; i++) {
        //获取扑克
        bCardValueTemp = getCardLogicValue(bCardData[i]);
        if (bCardValueTemp == bLogicValue) {
            bSameCount++;
        }

        //保存结果
        if ((bCardValueTemp != bLogicValue) || (i == (bCardCount - 1))) {
            switch (bSameCount) {
                case 1:     //一张
                    break;
                case 2: {//两张
                    AnalyseData.bTwoFirst[AnalyseData.bTwoCount] = bFirstCardIndex;
                    AnalyseData.bTwoCount++;
                    break;
                }
                case 3: {//三张
                    AnalyseData.bThreeFirst[AnalyseData.bThreeCount] = bFirstCardIndex;
                    AnalyseData.bThreeCount++;
                    break;
                }
                case 4: {//四张
                    AnalyseData.bFourFirst[AnalyseData.bFourCount] = bFirstCardIndex;
                    AnalyseData.bFourCount++;
                    break;
                }
                case 5: {//四张
                    AnalyseData.bFiveFirst[AnalyseData.bFiveCount] = bFirstCardIndex;
                    AnalyseData.bFiveCount++;
                    break;
                }                
            }
        }

        //设置变量
        if (bCardValueTemp != bLogicValue) {
            if (bSameCount == 1) {
                if (i != bCardCount - 1) {
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = bFirstCardIndex;
                    AnalyseData.bOneCount++;
                } else {
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = bFirstCardIndex;
                    AnalyseData.bOneCount++;
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = i;
                    AnalyseData.bOneCount++;
                }
            } else {
                if (i == bCardCount - 1) {
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = i;
                    AnalyseData.bOneCount++;
                }
            }
            bSameCount = 1;
            bLogicValue = bCardValueTemp;
            bFirstCardIndex = i;
        }
    }

    //////////////////////////////////////////////////////////////////////////
    // //至尊青龙
    // if (isStraightDragon(bCardData, bCardCount) == true) {
    //     return CT_EX_ZHIZUNQINGLONG;
    // }

       /* 三分天下要放在六对半前面 ------------neng*/

    //三分天下
    // if (AnalyseData.bFourCount == 3) {
    //     return CT_EX_SANFENGTIANXIA;
    // }

    //一条龙
    if ((isLinkCard(bCardData, bCardCount) == true)) {
        return CT_EX_YITIAOLONG;
    }
     

    switch(Type){
        case 0:
               //全黑全红
                var quanhei=0;
                var quanhong=0;
                for(var jj=0;jj<bCardCount;jj++){
                    var color=getCardColor(bCardData[jj]);
                    //console.log(color)
                    if(color==1||color==3){
                        quanhei++;
                    }else if(color==0||color==2||color==18){
                        quanhong++;
                    }
                }
                if(quanhei==13){
                    return CT_EX_QUAN_HEI;
                }else if(quanhei==12){
                    return CT_EX_QUAN_HEI_YIDIANHONG;
                }
                if(quanhong==13){
                    return CT_EX_QUAN_HONG;
                }else if(quanhong==12){
                    return CT_EX_QUAN_HONG_YIDIANHEI;
                }        
                 
            break;
        case 1:
                /* 增加全大，全小，半大，半小特殊牌 ------- */

                    var A = false;  //判断整幅牌是否有A
                    var small=false;  //判断是否只能小牌
                    var big = false;  //判断是否只能大牌
                    // console.log("bCardData")
                    // console.log(bCardData)
                    for(var nn=0;nn<bCardCount;nn++){
                        var cardLogicValue=getCardLogicValue(bCardData[nn]);
                        if(cardLogicValue == 11 || cardLogicValue == 12 || cardLogicValue == 13){
                            big = true;
                        }
                        if(cardLogicValue == 2 || cardLogicValue ==3 || cardLogicValue ==4 || cardLogicValue ==5){
                            small = true;
                        }
                        if(cardLogicValue == 14){
                            A = true;
                        }
                    }
                    if(small && !big){
                        if(A){
                            console.log("牌型为半小")
                            return CT_EX_BANXIAO;
                        }else{
                            console.log("牌型为全小")
                            return CT_EX_QUANXIAO;
                        }
                    }
                    if(!small && big){
                        if(A){
                            console.log("牌型为半大")
                            return CT_EX_BANDA;
                        }else{
                            console.log("牌型为全大")
                            return CT_EX_QUANDA;
                        }
                    }

             break;
        case 2:
                                //四套三条
                    if (AnalyseData.bThreeCount == 4) {
                        return CT_EX_SITAOSANTIAO;
                    }

                     // 三葫芦--两葫芦+三条
                    if(AnalyseData.bTwoCount==2 && AnalyseData.bThreeCount==3){
                       return  CT_EX_SAN_HU_LU;
                    }

                    //特殊六对半
                    if ((AnalyseData.bTwoCount+AnalyseData.bThreeCount+AnalyseData.bFourCount*2+AnalyseData.bFiveCount*2)== 6) {
                        // if(AnalyseData.bFiveCount>0)return CT_EX_LIUDUIBAN_WUTONG;
                        // if(AnalyseData.bFourCount>0)return CT_EX_LIUDUIBAN_TIEZHI;
                        if(AnalyseData.bThreeCount>0)    return CT_EX_WUDUISANTIAO;
                    }


             break;

          case 3:  
           //六对半
                    if ((AnalyseData.bTwoCount+AnalyseData.bThreeCount+AnalyseData.bFourCount*2+AnalyseData.bFiveCount*2)== 6) {
                         return CT_EX_LIUDUIBAN;
                    }
            
                break;

           case 4:
                       /* ----------------------------增加判断三同花顺 ---------start-------neng */
                        //三同花顺
                        var SameColorLineCardResult = struct_tagSearchCardResult();
                        // console.log("检查是否进入三同花顺")
                        // console.log(bCardData)
                        var cbSameColorLineCardResult5 = searchSameColorLineType(bCardData, bCardCount, 5, SameColorLineCardResult);
                        // console.log(SameColorLineCardResult)
                        // console.log(cbSameColorLineCardResult5)
                        if (cbSameColorLineCardResult5 >= 2) {
                            console.log("三同花顺")
                            // console.log("SameColorLineCardResult")
                            // console.log(SameColorLineCardResult)
                            // console.log(cbSameColorLineCardResult5)
                            for (var i = 0; i < cbSameColorLineCardResult5; ++i) {
                                var ctype = getCardType(SameColorLineCardResult.cbResultCard[i], SameColorLineCardResult.cbCardCount[i])[0];
                                // console.log("ctype")
                                // console.log(ctype)
                                if (ctype == 11|| ctype == 12) {
                                    var cbTempData = [];
                                    var cbTempCount = 13;
                                    CopyMemory(cbTempData, bCardData);

                                    removeCard(SameColorLineCardResult.cbResultCard[i], SameColorLineCardResult.cbCardCount[i], cbTempData, cbTempCount);
                                    // console.log("cbTempData")
                                    // console.log(cbTempData)
                                    cbTempCount = cbTempData.length;
                                    var LineCardResult1 = struct_tagSearchCardResult();
                                    var cbLineCardResult51 = searchSameColorLineType(cbTempData, cbTempCount, 5, LineCardResult1);
                                    // console.log("cbLineCardResult51")
                                    // console.log(cbLineCardResult51)
                                    if (cbLineCardResult51 >= 1) {
                                        for (var j = 0; j < cbLineCardResult51; ++j) {
                                            ctype = getCardType(LineCardResult1.cbResultCard[j], LineCardResult1.cbCardCount[j])[0];
                                            // console.log("ctype")
                                            // console.log(ctype)
                                            if (ctype == 11|| ctype == 12) {
                                                var cbTempData1 = [];
                                                CopyMemory(cbTempData1, cbTempData);
                                                console.log("三同花顺子3", cbTempData);
                                                // console.log("LineCardResult1")
                                                // console.log(LineCardResult1)
                                                // console.log("cbTempData1")
                                                // console.log(cbTempData1)
                                                // console.log("cbTempCount")
                                                // console.log(cbTempCount)
                                                removeCard(LineCardResult1.cbResultCard[j], LineCardResult1.cbCardCount[j], cbTempData1, cbTempData1.length);
                                                cbTempCount = cbTempData1.length;
                                                // console.log("cbTempData1")
                                                // console.log(cbTempData1)
                                                // console.log("isLinkCard(cbTempData1, cbTempCount)")
                                                // console.log(isLinkCard(cbTempData1, cbTempCount))
                                                if (isLinkCard(cbTempData1, cbTempCount) && isSameColorCard(cbTempData1,cbTempCount)) {
                                                    CopyMemory(bHandCardData, SameColorLineCardResult.cbResultCard[i], 0, 0, 5);
                                                    CopyMemory(bHandCardData, LineCardResult1.cbResultCard[j], 5, 0, 5);
                                                    sortCardList(cbTempData1, cbTempCount, enAscend);
                                                    CopyMemory(bHandCardData, cbTempData1, 10, 0, 3);  
                                                    // console.log("返回三同花顺")                              
                                                    return CT_EX_SANTONGHUASHUN;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        /* ----------------------------增加判断三同花顺 ---------end-------neng */



           break;

           case 5:
                   //三顺子
                        var LineCardResult = struct_tagSearchCardResult();
                        // console.log("检查是否进入三顺子")
                        // console.log(bCardData)
                        var cbLineCardResult5 = searchLineCardType(bCardData, bCardCount, 5, LineCardResult);
                        if (cbLineCardResult5 >= 2) {
                            // console.log("三顺子")
                            // console.log("LineCardResult")
                            // console.log(LineCardResult)
                            // console.log(cbLineCardResult5)
                            for (var i = 0; i < cbLineCardResult5; ++i) {
                                var ctype = getCardType(LineCardResult.cbResultCard[i], LineCardResult.cbCardCount[i])[0];
                                // console.log("ctype")
                                // console.log(ctype)
                                if (ctype == 5 || ctype == 6|| ctype == 7|| ctype == 11|| ctype == 12) {
                                    var cbTempData = [];
                                    var cbTempCount = 13;
                                    CopyMemory(cbTempData, bCardData);

                                    removeCard(LineCardResult.cbResultCard[i], LineCardResult.cbCardCount[i], cbTempData, cbTempCount);
                                    // console.log("cbTempData")
                                    // console.log(cbTempData)
                                    cbTempCount = cbTempData.length;
                                    var LineCardResult1 = struct_tagSearchCardResult();
                                    var cbLineCardResult51 = searchLineCardType(cbTempData, cbTempCount, 5, LineCardResult1);
                                    // console.log("cbLineCardResult51")
                                    // console.log(cbLineCardResult51)
                                    if (cbLineCardResult51 >= 1) {
                                        for (var j = 0; j < cbLineCardResult51; ++j) {
                                            ctype = getCardType(LineCardResult1.cbResultCard[j], LineCardResult1.cbCardCount[j])[0];
                                            // console.log("ctype")
                                            // console.log(ctype)
                                            if (ctype == 5 || ctype == 6|| ctype == 7|| ctype == 11|| ctype == 12) {
                                                var cbTempData1 = [];
                                                CopyMemory(cbTempData1, cbTempData);
                                                // console.log("三顺子3", cbTempData);
                                                // console.log("LineCardResult1")
                                                // console.log(LineCardResult1)
                                                // console.log("cbTempData1")
                                                // console.log(cbTempData1)
                                                // console.log("cbTempCount")
                                                // console.log(cbTempCount)
                                                removeCard(LineCardResult1.cbResultCard[j], LineCardResult1.cbCardCount[j], cbTempData1, cbTempData1.length);
                                                cbTempCount = cbTempData1.length;
                                                // console.log("cbTempData1")
                                                // console.log(cbTempData1)
                                                // console.log("isLinkCard(cbTempData1, cbTempCount)")
                                                // console.log(isLinkCard(cbTempData1, cbTempCount))
                                                if (isLinkCard(cbTempData1, cbTempCount)) {
                                                    CopyMemory(bHandCardData, LineCardResult.cbResultCard[i], 0, 0, 5);
                                                    CopyMemory(bHandCardData, LineCardResult1.cbResultCard[j], 5, 0, 5);
                                                    sortCardList(cbTempData1, cbTempCount, enAscend);
                                                    CopyMemory(bHandCardData, cbTempData1, 10, 0, 3);                                
                                                    return CT_EX_SANSHUNZI;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                 break;

         case 6: 
                  //三同花
                var SameColorResult = struct_tagSearchCardResult();
                var cbSameColorResult5 = searchSameColorType(bCardData, bCardCount, 5, SameColorResult);
                if (cbSameColorResult5 >= 2) {
                    // console.log("进入三同花")
                    // console.log("SameColorResult")
                    // console.log(SameColorResult)
                    // console.log("SameColorResult")
                    
                    if (isSameColorCard(SameColorResult.cbResultCard[0], SameColorResult.cbCardCount[0])) {
                        var cbTempData = [];
                        var cbTempCount = 13;
                        CopyMemory(cbTempData, bCardData);

                        //后墩扑克
                        removeCard(SameColorResult.cbResultCard[0], SameColorResult.cbCardCount[0], cbTempData, cbTempCount);
                        cbTempCount -= SameColorResult.cbCardCount[0];
                        // console.log("后道")
                        // console.log("cbTempData")
                        // console.log(cbTempData)
                        // console.log(SameColorResult)

                        var SameColorResult1 = struct_tagSearchCardResult();
                        var cbSameColorResult51 = searchSameColorType(cbTempData, cbTempCount, 5, SameColorResult1);
                        // console.log("cbSameColorResult51")
                        // console.log(cbSameColorResult51)
                        if (cbSameColorResult51 >= 1) {
                            if (isSameColorCard(SameColorResult1.cbResultCard[0], SameColorResult1.cbCardCount[0])) {
                                var cbTempData1 = [];
                                CopyMemory(cbTempData1, cbTempData);

                                //中墩扑克
                                removeCard(SameColorResult1.cbResultCard[0], SameColorResult1.cbCardCount[0], cbTempData1, cbTempCount);
                                cbTempCount -= SameColorResult1.cbCardCount[0];
                                // console.log("前道")
                                // console.log("cbTempData")
                                // console.log(cbTempData)
                                // console.log(SameColorResult)
                                // console.log("SameColorResult")
                                // console.log(SameColorResult)
                                // console.log("cbTempData1")
                                // console.log(cbTempData1)
                                if (isSameColorCard(cbTempData1, cbTempCount)) {
                                            CopyMemory(bHandCardData, SameColorResult.cbResultCard[0], 0, 0, 5);
                                            CopyMemory(bHandCardData, SameColorResult1.cbResultCard[0], 5, 0, 5);
                                            sortCardList(cbTempData1, cbTempCount, enAscend);
                                            CopyMemory(bHandCardData, cbTempData1, 10, 0, 3);                           
                                    return CT_EX_SANTONGHUA;
                                }
                            }
                        }
                    }
                }

                break;

             
      
    }

    return CT_EX_INVALID;
}



function getSpecialCardData(bHandCardData, bHandCardCount, bSpecCardData) {
    ASSERT(bHandCardCount == HAND_CARD_COUNT);
    if (bHandCardCount != HAND_CARD_COUNT) {
        return 0;
    }

    //清空结果
    bSpecCardData = [[], [], []];

    //变量定义
    var bCardData = [];
    var bCardCount = bHandCardCount;

    //复制扑克
    CopyMemory(bCardData, bHandCardData);
    //排序扑克
    sortCardList(bCardData, bCardCount, enDescend);

    //设置结果
    AnalyseData = struct_tagAnalyseData();

    //变量定义
    var bSameCount = 1;
    var bCardValueTemp = 0;
    var bFirstCardIndex = 0;    //记录下标

    var bLogicValue = getCardLogicValue(bCardData[0]);
    var bCardColor = getCardColor(bCardData[0]);
    //扑克分析
    //////////////////////////////////////////////////////////////////////////
    for (var i = 1; i < bCardCount; i++) {
        //获取扑克
        bCardValueTemp = getCardLogicValue(bCardData[i]);
        if (bCardValueTemp == bLogicValue) {
            bSameCount++;
        }

        //保存结果
        if ((bCardValueTemp != bLogicValue) || (i == (bCardCount - 1))) {
            switch (bSameCount) {
                case 1:     //一张
                    break;
                case 2: {//两张
                    AnalyseData.bTwoFirst[AnalyseData.bTwoCount] = bFirstCardIndex;
                    AnalyseData.bTwoCount++;
                    break;
                }
                case 3: {//三张
                    AnalyseData.bThreeFirst[AnalyseData.bThreeCount] = bFirstCardIndex;
                    AnalyseData.bThreeCount++;
                    break;
                }
                case 4: {//四张
                    AnalyseData.bFourFirst[AnalyseData.bFourCount] = bFirstCardIndex;
                    AnalyseData.bFourCount++;
                    break;
                }
            }
        }

        //设置变量
        if (bCardValueTemp != bLogicValue) {
            if (bSameCount == 1) {
                if (i != bCardCount - 1) {
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = bFirstCardIndex;
                    AnalyseData.bOneCount++;
                } else {
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = bFirstCardIndex;
                    AnalyseData.bOneCount++;
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = i;
                    AnalyseData.bOneCount++;
                }
            } else {
                if (i == bCardCount - 1) {
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = i;
                    AnalyseData.bOneCount++;
                }
            }
            bSameCount = 1;
            bLogicValue = bCardValueTemp;
            bFirstCardIndex = i;
        }
    }

    //////////////////////////////////////////////////////////////////////////
    //至尊青龙
    if (isStraightDragon(bCardData, bCardCount) == true) {
        CopyMemory(bSpecCardData[2], bCardData, 0, 0, 5);
        CopyMemory(bSpecCardData[1], bCardData, 0, 5, 5);
        CopyMemory(bSpecCardData[0], bCardData, 0, 10, 3);
        return 1;
    }

    //一条龙
    if (isLinkCard(bCardData, bCardCount) == true) {
        CopyMemory(bSpecCardData[2], bCardData, 0, 0, 5);
        CopyMemory(bSpecCardData[1], bCardData, 0, 5, 5);
        CopyMemory(bSpecCardData[0], bCardData, 0, 10, 3);
        return 1;
    }

    //六对半 （e.g. AA KK QQ JJ 99 77 2）
    if (AnalyseData.bTwoCount == 6 && AnalyseData.bOneCount == 1) {
        var bTempCardData = [];
        CopyMemory(bTempCardData, bCardData);

        var bTempSegCard = [];

        //填充后墩 (AA KK 2)
        CopyMemory(bTempSegCard, bTempCardData, 0, AnalyseData.bTwoFirst[0], 2);
        CopyMemory(bTempSegCard, bTempCardData, 2, AnalyseData.bTwoFirst[1], 2);
        CopyMemory(bTempSegCard, bTempCardData, 4, AnalyseData.bOneFirst[0], 1);
        CopyMemory(bSpecCardData[2], bTempSegCard);

        //填充中墩 (QQ JJ 7)
        bTempSegCard = [];
        CopyMemory(bTempSegCard, bTempCardData, 0, AnalyseData.bTwoFirst[2], 2);
        CopyMemory(bTempSegCard, bTempCardData, 2, AnalyseData.bTwoFirst[3], 2);
        CopyMemory(bTempSegCard, bTempCardData, 4, AnalyseData.bTwoFirst[5], 1);
        CopyMemory(bSpecCardData[1], bTempSegCard);

        //填充前墩 (99 2)
        TempSegCard = [];
        CopyMemory(bTempSegCard, bTempCardData, 0, AnalyseData.bTwoFirst[4], 2);
        CopyMemory(bTempSegCard, bTempCardData, 2, AnalyseData.bTwoFirst[5] + 1, 1);
        CopyMemory(bSpecCardData[0], bTempSegCard);

        return 1;
    }

    //三顺子
    var LineCardResult = struct_tagSearchCardResult();
    var cbLineCardResult5 = searchLineCardType(bCardData, bCardCount, 5, LineCardResult);
    if (cbLineCardResult5 >= 2) {
        if (isLinkCard(LineCardResult.cbResultCard[0], LineCardResult.cbCardCount[0])) {
            var cbTempData = [];
            var cbTempCount = 13;
            CopyMemory(cbTempData, bCardData);

            //后墩扑克
            CopyMemory(bSpecCardData[2], LineCardResult.cbResultCard[0]);
            removeCard(LineCardResult.cbResultCard[0], LineCardResult.cbCardCount[0], cbTempData, cbTempCount);
            cbTempCount -= LineCardResult.cbCardCount[0];

            cbLineCardResult5 = searchLineCardType(cbTempData, cbTempCount, 5, LineCardResult);
            if (cbLineCardResult5 >= 1) {
                if (isLinkCard(LineCardResult.cbResultCard[0], LineCardResult.cbCardCount[0])) {
                    var cbTempData1 = [];
                    CopyMemory(cbTempData1, cbTempData);

                    //中墩扑克
                    CopyMemory(bSpecCardData[1], LineCardResult.cbResultCard[0]);
                    removeCard(LineCardResult.cbResultCard[0], LineCardResult.cbCardCount[0], cbTempData1, cbTempCount);
                    cbTempCount -= LineCardResult.cbCardCount[0];

                    if (isLinkCard(cbTempData1, cbTempCount)) {
                        //前墩扑克
                        CopyMemory(bSpecCardData[0], cbTempData1);
                        return 1;
                    }
                }
            }
        }
    }

    //三同花
    var SameColorResult = struct_tagSearchCardResult();
    var cbSameColorResult5 = searchSameColorType(bCardData, bCardCount, 5, SameColorResult);
    if (cbSameColorResult5 >= 2) {
        if (isSameColorCard(SameColorResult.cbResultCard[0], SameColorResult.cbCardCount[0])) {
            var cbTempData = [];
            var cbTempCount = 13;
            CopyMemory(cbTempData, bCardData);

            //后墩扑克
            CopyMemory(bSpecCardData[2], SameColorResult.cbResultCard[0]);
            removeCard(SameColorResult.cbResultCard[0], SameColorResult.cbCardCount[0], cbTempData, cbTempCount);
            cbTempCount -= SameColorResult.cbCardCount[0];

            SameColorResult = struct_tagSearchCardResult();
            cbSameColorResult5 = searchSameColorType(cbTempData, cbTempCount, 5, SameColorResult);
            if (cbSameColorResult5 >= 1) {
                if (isSameColorCard(SameColorResult.cbResultCard[0], SameColorResult.cbCardCount[0])) {
                    var cbTempData1 = [];
                    CopyMemory(cbTempData1, cbTempData);

                    //中墩扑克
                    CopyMemory(bSpecCardData[1], SameColorResult.cbResultCard[0]);
                    removeCard(SameColorResult.cbResultCard[0], SameColorResult.cbCardCount[0], cbTempData1, cbTempCount);
                    cbTempCount -= SameColorResult.cbCardCount[0];

                    if (isSameColorCard(cbTempData1, cbTempCount)) {
                        //前墩扑克
                        CopyMemory(bSpecCardData[0], cbTempData1);
                        return 1;
                    }
                }
            }
        }
    }

    return 0;
}

//获取数值,十六进制前面四位表示牌的数值
function getCardValue(bCardData) {
    return bCardData & LOGIC_MASK_VALUE;
}

//获取花色,十六进制后面四位表示牌的花色 
function getCardColor(bCardData) {
    return (bCardData & LOGIC_MASK_COLOR) >> 4;
}

//排列扑克
function sortCardList(bCardData, bCardCount, SortCardType) {
    if (SortCardType == null) {
        SortCardType = enDescend;
    }
    ASSERT(bCardCount >= 1 && bCardCount <= 13);
    if (bCardCount < 1 || bCardCount > 13)
        return;

    //转换数值
    var bLogicVolue = [];
    for (var i = 0; i < bCardCount; i++) {
        bLogicVolue[i] = getCardLogicValue(bCardData[i]);
    }

    if (enDescend == SortCardType) {
        //排序操作
        var bSorted = true;
        var bTempData = 0;
        var bLast = bCardCount - 1;
        var m_bCardCount = 1;
        do {
            bSorted = true;
            for (var i = 0; i < bLast; i++) {
                if ((bLogicVolue[i] < bLogicVolue[i + 1]) ||
                    ((bLogicVolue[i] == bLogicVolue[i + 1]) && (getCardColor(bCardData[i]) < getCardColor(bCardData[i + 1])))) {
                    //交换位置
                    bTempData = bCardData[i];
                    bCardData[i] = bCardData[i + 1];
                    bCardData[i + 1] = bTempData;
                    bTempData = bLogicVolue[i];
                    bLogicVolue[i] = bLogicVolue[i + 1];
                    bLogicVolue[i + 1] = bTempData;
                    bSorted = false;
                }
            }
            bLast--;
        } while (bSorted == false);
    } else if (enAscend == SortCardType) {
        //排序操作
        var bSorted = true;
        var bTempData = 0;
        var bLast = bCardCount - 1;
        var m_bCardCount = 1;
        do {
            bSorted = true;
            for (var i = 0; i < bLast; i++) {
                if ((bLogicVolue[i] > bLogicVolue[i + 1]) ||
                    ((bLogicVolue[i] == bLogicVolue[i + 1]) && (getCardColor(bCardData[i]) > getCardColor(bCardData[i + 1])))) {
                    //交换位置
                    bTempData = bCardData[i];
                    bCardData[i] = bCardData[i + 1];
                    bCardData[i + 1] = bTempData;
                    bTempData = bLogicVolue[i];
                    bLogicVolue[i] = bLogicVolue[i + 1];
                    bLogicVolue[i + 1] = bTempData;
                    bSorted = false;
                }
            }
            bLast--;
        } while (bSorted == false);
    } else if (enColor == SortCardType) {
        //排序操作
        var bSorted = true;
        var bTempData = 0;
        var bLast = bCardCount - 1;
        var m_bCardCount = 1;
        var bColor = [];
        for (var i = 0; i < bCardCount; i++) {
            bColor[i] = getCardColor(bCardData[i]);
        }
        do {
            bSorted = true;
            for (var i = 0; i < bLast; i++) {
                if ((bColor[i] < bColor[i + 1]) ||
                    ((bColor[i] == bColor[i + 1]) && (getCardLogicValue(bCardData[i]) < getCardLogicValue(bCardData[i + 1])))) {
                    //交换位置
                    bTempData = bCardData[i];
                    bCardData[i] = bCardData[i + 1];
                    bCardData[i + 1] = bTempData;
                    bTempData = bColor[i];
                    bColor[i] = bColor[i + 1];
                    bColor[i + 1] = bTempData;
                    bSorted = false;
                }
            }
            bLast--;
        } while (bSorted == false);
    }
}

//混乱扑克
function randCardList(bCardListData) {
    //混乱准备
    var bTotalCount = bCardListData.length;
    var bCardData = [];
    var bCardBuffer = [];
    var bBufferCount = bCardListData.length;
    CopyMemory(bCardData, bCardListData);

    //混乱扑克
    var bRandCount = 0;
    var bPosition = 0;
    do {
        bPosition = Math.floor(Math.random() * (bTotalCount - bRandCount));
        bCardBuffer[bRandCount++] = bCardData[bPosition];
        bCardData[bPosition] = bCardData[bTotalCount - bRandCount];
    } while (bRandCount < bBufferCount)

    for (var i = 0; i < bCardListData.length; ++i) {
        bCardListData[i] = bCardData[i];
    }
}

//删除扑克
function removeCard(bRemoveCard, bRemoveCount, bCardData, bCardCount) {
    //检验数据
    ASSERT(bRemoveCount <= bCardCount);

    //定义变量
    var bDeleteCount = 0;
    var bTempCardData = [];
    for (var i = 0; i < 13; ++i) {
        bTempCardData[i] = 0;
    }
    if (bCardCount > bTempCardData.length) {
        return false;
    }
    CopyMemory(bTempCardData, bCardData);

    //置零扑克
    for (var i = 0; i < bRemoveCount; i++) {
        for (var j = 0; j < bCardCount; j++) {
            if (bRemoveCard[i] == bTempCardData[j]) {
                bDeleteCount++;
                bTempCardData[j] = 0;
                break;
            }
        }
    }
    if (bDeleteCount != bRemoveCount) {
        return false;
    }

    //清理扑克
    var bCardPos = 0;
    for (var i = 0; i < bCardCount; i++) {
        if (bTempCardData[i] != 0) {
            bCardData[bCardPos++] = bTempCardData[i];
        }
    }

    bCardData.length = bCardPos;

    return true;
}

function CREATE(arr, len) {
    for (var i = 0; i < len; ++i) {
        arr[i] = [];
    }
}

//自动摆牌
function autoPutCard(bCardData, bPutCardData, bIsAndroidUser, bTest) {
    var bTempCard = CREATE_ARRAY(6, 3); //保存权值最大的六副牌型
    var iTempWeights = CREATE_ARRAY(6);  //保存权值最大的六副牌型的权值
    var bCardList = [];      //保存手牌
    var bCard = CREATE_ARRAY(3);        //临时存放牌
    var bSubscript = [];     //下标用来保存每一注使用的哪些牌
    var blBiaoJi = [];       //标记那些牌没有使用
    var iFWeights = 0;
    var iSWeights = 0;
    var iTWeights = 0;
    var bWCard = 0;

    CopyMemory(bCardList, bCardData);

    //进行全排列寻找最优牌型
    sortCardList(bCardList, 13, enAscend);

    //第一注使用的三张牌
    totalGoto:
    for (bSubscript[0] = 0; bSubscript[0] < 13; bSubscript[0]++) {
        for (bSubscript[1] = bSubscript[0] + 1; bSubscript[1] < 13; bSubscript[1]++) {
            for (bSubscript[2] = bSubscript[1] + 1; bSubscript[2] < 13; bSubscript[2]++) {
                //从大到小将牌保存到bCard[2]数组中，将已经使用的牌进行标记
                for (var i = 0; i < 3; i++) {
                    blBiaoJi[bSubscript[i]] = true;
                    bCard[2][2 - i] = bCardList[bSubscript[i]];
                }
                //第二注使用的五张牌
                for (bSubscript[3] = 0; bSubscript[3] < 13; bSubscript[3]++)
                    if (!blBiaoJi[bSubscript[3]]) for (bSubscript[4] = bSubscript[3] + 1; bSubscript[4] < 13; bSubscript[4]++)
                        if (!blBiaoJi[bSubscript[4]]) for (bSubscript[5] = bSubscript[4] + 1; bSubscript[5] < 13; bSubscript[5]++)
                            if (!blBiaoJi[bSubscript[5]]) for (bSubscript[6] = bSubscript[5] + 1; bSubscript[6] < 13; bSubscript[6]++)
                                if (!blBiaoJi[bSubscript[6]]) for (bSubscript[7] = bSubscript[6] + 1; bSubscript[7] < 13; bSubscript[7]++)
                                    if (!blBiaoJi[bSubscript[7]]) {
                                        do {

                                            //从大到小将牌保存到bCard[1]数组中，将已经使用的牌进行标记
                                            for (var i = 0; i < 5; i++) {
                                                blBiaoJi[bSubscript[3 + i]] = true;
                                                bCard[1][4 - i] = bCardList[bSubscript[3 + i]];
                                            }

                                            iFWeights = cardTypeToWeights(getCardType(bCard[2], 3)[0], 1);
                                            iSWeights = cardTypeToWeights(getCardType(bCard[1], 5)[0], 2);

                                            //比较第一注和第二注牌型权值的大小
                                            if (iFWeights > iSWeights) {
                                                break;
                                            }

                                            //将剩下元素放入bCard[0]数组当中
                                            var iCount = 0;
                                            for (var i = 0; i < 13; i++)
                                                if (!blBiaoJi[i]) {
                                                    bCard[0][iCount++] = bCardList[i];
                                                }

                                            iTWeights = cardTypeToWeights(getCardType(bCard[0], 5)[0], 3);
                                            if (iSWeights > iTWeights) {
                                                break;
                                            }

                                            var bHave = false;
                                            for (var i = 0; i < 6; i++) {
                                                //已经存在三注牌型都不小于它的组合，就放弃
                                                if (iFWeights <= iTempWeights[i][2] && iSWeights <= iTempWeights[i][1] && iTWeights <= iTempWeights[i][0]) {
                                                    bHave = true;
                                                    break;
                                                }
                                            }

                                            if (false == bHave) {

                                                //不存在就保存
                                                for (var i = 0; i < 6; i++)
                                                    if (iFWeights >= iTempWeights[i][2] && iSWeights >= iTempWeights[i][1] && iTWeights >= iTempWeights[i][0]) {
                                                        iTempWeights[i][2] = iFWeights;
                                                        iTempWeights[i][1] = iSWeights;
                                                        iTempWeights[i][0] = iTWeights;

                                                        for (var j = 0; j < 3; j++) {
                                                            CopyMemory(bTempCard[i][j], bCard[j]);
                                                        }
                                                        for (var j = i + 1; j < 6; j++) {
                                                            if (iFWeights >= iTempWeights[j][2] && iSWeights >= iTempWeights[j][1] && iTWeights >= iTempWeights[j][0]) {
                                                                iTempWeights[j][2] = 0;
                                                                iTempWeights[j][1] = 0;
                                                                iTempWeights[j][0] = 0;
                                                            }
                                                        }
                                                        if (!bIsAndroidUser) {
                                                            break totalGoto;
                                                        }
                                                        break;
                                                    }
                                            }
                                        } while (0);

                                        for (var i = 0; i < 5; i++) {
                                            blBiaoJi[bSubscript[3 + i]] = false;
                                        }
                                    }

                //清除标记
                for (i = 0; i < 3; i++) {
                    blBiaoJi[bSubscript[i]] = false;
                }
            }
        }
    }

    //将权值没法比上一种牌型组合优的去掉
    for (var i = 0; i < 6; i++) {
        for (var j = i + 1; j < 6; j++) {
            if (iTempWeights[j][0] <= iTempWeights[i][0] && iTempWeights[j][1] <= iTempWeights[i][1] && iTempWeights[j][2] <= iTempWeights[i][2]) {
                iTempWeights[j][0] = 0;
                iTempWeights[j][1] = 0;
                iTempWeights[j][2] = 0;
            }
        }
    }

    //将中间出现的空隙删除
    var iCount = 0;
    for (var i = 0; i < 6; i++) {
        if (iTempWeights[i][0] != 0) {
            for (var j = 0; j < 3; j++) {
                CopyMemory(bTempCard[iCount][j], bTempCard[i][j]);
                iTempWeights[iCount][j] = iTempWeights[i][j];
            }
            iCount++;
        }

    }

    //按权值排序
    for (var i = 0; i < 6; i++) {
        for (var j = i + 1; j < 6; j++) {
            if ((iTempWeights[j][0] + iTempWeights[j][1] + iTempWeights[j][2]) > (iTempWeights[i][0] + iTempWeights[i][1] + iTempWeights[i][2]) ||
                ((iTempWeights[j][0] + iTempWeights[j][1] + iTempWeights[j][2]) == (iTempWeights[i][0] + iTempWeights[i][1] + iTempWeights[i][2]) &&
                    (iTempWeights[j][0] > iTempWeights[i][0] || (iTempWeights[j][0] == iTempWeights[i][0] && iTempWeights[j][1] > iTempWeights[i][1])))) {
                for (var k = 0; k < 3; k++) {
                    var iTemp;

                    iTemp = iTempWeights[i][k];
                    iTempWeights[i][k] = iTempWeights[j][k];
                    iTempWeights[j][k] = iTemp;

                    CopyMemory(bCard[k], bTempCard[i][k]);
                    CopyMemory(bTempCard[i][k], bTempCard[j][k]);
                    CopyMemory(bTempCard[j][k], bCard[k]);
                }
            }
        }
    }

    //随机选择一副权值大的牌打出
    var iRandom = Math.floor(Math.random() * 100);
    var iCnt = 0;

    //牌组填充
    CopyMemory(bPutCardData, bTempCard[iCnt][2], 0, 0, 3);
    CopyMemory(bPutCardData, bTempCard[iCnt][1], 3, 0, 5);
    CopyMemory(bPutCardData, bTempCard[iCnt][0], 8, 0, 5);


    var v1 = bPutCardData.slice(3);
    var v2 = bPutCardData.slice(8);
    optimizationCombo(v1, v2, 5, 5);
    bPutCardData = bPutCardData.slice(0, 3);
    bPutCardData = bPutCardData.concat(v1.slice(0,5));
    bPutCardData = bPutCardData.concat(v2);
    optimizationCombo(bPutCardData, v2, 3, 5);
    bPutCardData = bPutCardData.slice(0, 8);
    bPutCardData = bPutCardData.concat(v2);
    v1 = bPutCardData.slice(3);
    optimizationCombo(bPutCardData, v1, 3, 5);
    bPutCardData = bPutCardData.slice(0,3);
    bPutCardData = bPutCardData.concat(v1);

    return;
}

//逻辑数值
function getCardLogicValue(bCardData) {
    //扑克属性
    var bCardValue = getCardValue(bCardData);
    //转换数值
    return (bCardValue == 1) ? (bCardValue + 13) : bCardValue;
}

function change16(arr){
    var arrTo=[];
    for(var i=0;i<arr.length;i++){
        arrTo.push(arr[i].toString(16));
    }
    return arrTo;
}
function cancelDanPai(bHandCardData,bCardCount,dangCard,replacedCard){
       ASSERT(bCardCount == 5);
       for(let i=0;i< bCardCount;i++){
          if(bHandCardData[i]==dangCard){
                bHandCardData[i]=replacedCard;
                break;
            }
        }
        sortCardList(bHandCardData,bCardCount,enDescend);
       return bHandCardData;

}
function useDangPai(bHandCardData, bCardCount, Card) {
    ASSERT(bCardCount == 5);

    //var bHandCardData= replaceForA4(bHandCardOrigin,bCardCount)
    var bCardData=[];
    CopyMemory(bCardData,bHandCardData);

    var originSameColor=0;
    var colorDifIndex=[];
    for(let i=0;i<bCardData.length;i++){
        if(getCardColor(bCardData[i])==getCardColor(Card))
            originSameColor++;
        else
            colorDifIndex.push(i);
    }

    if(originSameColor==4 && colorDifIndex.length==1){
         
        var replacedCard=bCardData[colorDifIndex[0]];
         bCardData[colorDifIndex[0]]=Card;
         
         sortCardList(bCardData, 5, enDescend);
         if(isLinkCard(bCardData,5)){

            return [bCardData,replacedCard];
         }

    }
    var AnalyseData = struct_tagAnalyseData();
    analyseCard(bCardData, bCardCount, AnalyseData);
    //分析扑克
    var AnalyseResult = struct_tagAnalyseResult();
    analysebCardData(bCardData, bCardCount, AnalyseResult);

   if(AnalyseData.bSameColor){
               if(getCardColor(bCardData[0])==getCardColor(Card)){
                       if(isLinkCard(bCardData,5)){
                            if(getCardLogicValue(bCardData[0])==getCardLogicValue(Card)-1){
                                var replacedCard=bCardData[4];
                                bCardData[4]=Card;
                                sortCardList(bCardData, bCardCount, enDescend);  
                                   return [bCardData,replacedCard];
                                }
                                
                        }else{
                             bCardData.push(Card);
                             sortCardList(bCardData,6,enDescend);
                                if(isLinkCard(bCardData,6)){
                                    var replacedCard=bCardData[5];
                                    bCardData.pop();
                                    sortCardList(bCardData, bCardCount, enDescend);  
                                    return [bCardData,replacedCard];
                                }else{
                                        if(isLinkCard(bCardData.slice(0,5),5)){
                                            return [bCardData.slice(0,5),bCardData[5]];
                                            }
                                        if(isLinkCard(bCardData.slice(1),5)) {
                                                return [bCardData.slice(1),bCardData[0]];
                                        }
                                     
                                    }
                            }
                }
   }else{
                if(AnalyseData.bThreeCount==1){
                    if(getCardLogicValue(bCardData[AnalyseData.bThreeFirst[0]])==getCardLogicValue(Card)){
                                
                               var replacedCard;
                               if(AnalyseData.bThreeFirst[0]==2){     //三张牌 排在尾部
                                    replacedCard=bCardData[1];
                                    bCardData[1]=Card;
                                }
                                else{
                                    replacedCard=bCardData[4];
                                    bCardData[4]=Card;
                                }
                                sortCardList(bCardData, bCardCount, enDescend);
                                return [bCardData,replacedCard];
                        }
                      
                }
           
    }

}

function changeZhongWei(WeiCards,zhongCards){
    if(compareCard(WeiCards,zhongCards,5,5,true)==1){
       
        var tempArr=[];
        CopyMemory(tempArr,zhongCards);
        CopyMemory(zhongCards,WeiCards);
        CopyMemory(WeiCards,tempArr);
    }
 }
//对比扑克
function compareCard(bInFirstList, bInNextList, bFirstCount, bNextCount, bComperWithOther) {
    console.log("对比扑克牌")
    console.log(bInFirstList)
    console.log(bInNextList)
    //console.log(change16(bInFirstList))
    //console.log(change16(bInNextList))
    //定义变量
    var bFirstList = [];
    var bNextList = [];
    var FirstAnalyseData = struct_tagAnalyseData();
    var NextAnalyseData = struct_tagAnalyseData();
    // console.log("初始化牌的分析结构")
    // console.log(FirstAnalyseData)
    // console.log(NextAnalyseData)

    var oldInFirstList = bInFirstList.slice(0);
    var oldInNextList = bInNextList.slice(0);

    bInFirstList = convertMagicCards(oldInFirstList);
    bInNextList = convertMagicCards(oldInNextList);

    // console.log("癞子转化后的牌为")
    // console.log("bInFirstList")
    // console.log(change16(bInFirstList))
    // console.log("bInNextList")
    // console.log(change16(bInNextList))


    //检查转化
    var ttdFst = struct_tagTransData();
    var ttdNxt = struct_tagTransData();
    // console.log("检查转化")
    // console.log(ttdFst)
    // console.log(ttdNxt)
    analyseMaxTransform(bInFirstList, bFirstCount, bFirstList, ttdFst);
    analyseMaxTransform(bInNextList, bNextCount, bNextList, ttdNxt);
    // console.log("转化后")
    // console.log(ttdFst)
    // console.log(ttdNxt)
    // console.log(change16(bInFirstList))
    // console.log(change16(bInFirstList))
    //排序牌组
    sortCardList(bFirstList, bFirstCount, enDescend);
    sortCardList(bNextList, bNextCount, enDescend);

    sortCardList(oldInFirstList, bFirstCount, enDescend);
    sortCardList(oldInNextList, bNextCount, enDescend);

    // console.log("排列牌组后")
    // console.log(bFirstList)
    // console.log(bNextList)
    // console.log(change16(oldInFirstList))
    // console.log(change16(oldInNextList))

    // console.log("分析前的牌组")
    // console.log(FirstAnalyseData)
    // console.log(NextAnalyseData)
    
    //分析牌组
    analyseCard(bFirstList, bFirstCount, FirstAnalyseData);
    analyseCard(bNextList, bNextCount, NextAnalyseData);

    // console.log("分析后的牌组")
    // console.log(FirstAnalyseData)
    // console.log(NextAnalyseData)

    //数据验证
    ASSERT(bFirstCount == (FirstAnalyseData.bOneCount + FirstAnalyseData.bTwoCount * 2 + FirstAnalyseData.bThreeCount * 3 + FirstAnalyseData.bFourCount * 4 + FirstAnalyseData.bFiveCount * 5));
    ASSERT(bNextCount = (NextAnalyseData.bOneCount + NextAnalyseData.bTwoCount * 2 + NextAnalyseData.bThreeCount * 3 + NextAnalyseData.bFourCount * 4 + NextAnalyseData.bFiveCount * 5));
    if (bFirstCount != (FirstAnalyseData.bOneCount + FirstAnalyseData.bTwoCount * 2 + FirstAnalyseData.bThreeCount * 3 + FirstAnalyseData.bFourCount * 4 + FirstAnalyseData.bFiveCount * 5)) {
        return enCRError;
    }
    if (bNextCount != (NextAnalyseData.bOneCount + NextAnalyseData.bTwoCount * 2 + NextAnalyseData.bThreeCount * 3 + NextAnalyseData.bFourCount * 4 + NextAnalyseData.bFiveCount * 5)) {
        return enCRError;
    }

    ASSERT((bFirstCount == bNextCount) || (bFirstCount != bNextCount && (3 == bFirstCount && 5 == bNextCount || 5 == bFirstCount && 3 == bNextCount)));
    if (!((bFirstCount == bNextCount) || (bFirstCount != bNextCount && (3 == bFirstCount && 5 == bNextCount || 5 == bFirstCount && 3 == bNextCount)))) return enCRError;

    ASSERT(3 == bNextCount || 5 == bNextCount);
    ASSERT(3 == bFirstCount || 5 == bFirstCount);

    //获取类型
    var cbMaxCard = 0;
    var bNextType = getCardType(bNextList, bNextCount)[0];
    var bFirstType = getCardType(bFirstList, bFirstCount)[0];
    console.log("获取类型")
    console.log(bNextType)
    console.log(bFirstType)
    //   bFirstList= oldInFirstList.slice(0);
    //   for(var i=0;i<bFirstList.length;i++){
    //       if(bFirstList[i]==0x4f){
    //           bFirstList[i]=14;
    //       }
    //   }
    // bNextList = oldInNextList.slice(0);
    //   for(var i=0;i<bNextList.length;i++){
    //       if(bNextList[i]==0x4f){
    //           bNextList[i]=14;
    //       }
    //   }    
    ASSERT(CT_INVALID != bNextType && CT_INVALID != bFirstType);
    if (CT_INVALID == bFirstType || CT_INVALID == bNextType) return enCRError;

    //同段比较
    if (bNextType == 5) {
        bNextType = 6;
    }
    if (bNextType == 11) {
        bNextType = 12;
    }
    if (bFirstType == 5) {
        bFirstType = 6;
    }
    if (bFirstType == 11) {
        bFirstType = 12;
    }
    if (true == bComperWithOther) {
        console.log("开始对比")
        console.log(bNextType)
        console.log(bFirstType)
        
        //开始对比
        if (bNextType == bFirstType) {
            switch (bFirstType) {
                case CT_SINGLE:             //单牌类型
                    {
                        for (var i = 0; i < bFirstCount; ++i) {
                            if (getCardLogicValue(bNextList[i]) > getCardLogicValue(bFirstList[i]))
                                return enCRGreater;
                            else if (getCardLogicValue(bNextList[i]) < getCardLogicValue(bFirstList[i]))
                                return enCRLess;
                        }
                        
                        for(var i = 0; i < bFirstCount; ++i){
                            if (getCardColor(bNextList[i]) > getCardColor(bFirstList[i]))
                                return enCRGreater;
                            else if (getCardColor(bNextList[i]) < getCardColor(bFirstList[i]))
                                return enCRLess;
                        }
                        return enCREqual;
                    }
                case CT_ONE_DOUBLE:         //对带一张
                    {
                        if (getCardLogicValue(bNextList[NextAnalyseData.bTwoFirst[0]]) == getCardLogicValue(bFirstList[FirstAnalyseData.bTwoFirst[0]])) {
                            if (getCardLogicValue(bNextList[NextAnalyseData.bOneFirst[0]]) > getCardLogicValue(bFirstList[FirstAnalyseData.bOneFirst[0]]))
                                return enCRGreater;
                            else if (getCardLogicValue(bNextList[NextAnalyseData.bOneFirst[0]]) < getCardLogicValue(bFirstList[FirstAnalyseData.bOneFirst[0]]))
                                return enCRLess;
                            else if(bNextCount==5){
                                for (var i = 0; i < bNextCount-2; ++i) {
                                    if (getCardLogicValue(bNextList[NextAnalyseData.bOneFirst[i]]) > getCardLogicValue(bFirstList[FirstAnalyseData.bOneFirst[i]]))
                                        return enCRGreater;
                                    else if (getCardLogicValue(bNextList[NextAnalyseData.bOneFirst[i]]) < getCardLogicValue(bFirstList[FirstAnalyseData.bOneFirst[i]]))
                                        return enCRLess;
                                }
                                
                                for (var i = 0; i < bNextCount-2; ++i) {
                                    if (getCardColor(bNextList[NextAnalyseData.bOneFirst[i]]) > getCardColor(bFirstList[FirstAnalyseData.bOneFirst[i]]))
                                        return enCRGreater;
                                    else if (getCardColor(bNextList[NextAnalyseData.bOneFirst[i]]) < getCardColor(bFirstList[FirstAnalyseData.bOneFirst[i]]))
                                        return enCRLess;
                                }                                
                            }
                            else{
                                  if (getCardColor(bNextList[NextAnalyseData.bOneFirst[0]]) < getCardColor(bFirstList[FirstAnalyseData.bOneFirst[0]]))
                                      return enCRLess;
                                   else if(getCardColor(bNextList[NextAnalyseData.bOneFirst[0]]) > getCardColor(bFirstList[FirstAnalyseData.bOneFirst[0]]))
                                      return enCRGreater;

                            }
                                return enCREqual;
                        }
                        else {
                            if (getCardLogicValue(bNextList[NextAnalyseData.bTwoFirst[0]]) > getCardLogicValue(bFirstList[FirstAnalyseData.bTwoFirst[0]]))
                                return enCRGreater;
                            else
                                return enCRLess;
                        }
                    }
                case CT_TWO_DOUBLE: //两对牌型
                    {
                        if (getCardLogicValue(bNextList[NextAnalyseData.bTwoFirst[0]]) == getCardLogicValue(bFirstList[FirstAnalyseData.bTwoFirst[0]])) {
                            if (getCardLogicValue(bNextList[NextAnalyseData.bTwoFirst[1]]) == getCardLogicValue(bFirstList[FirstAnalyseData.bTwoFirst[1]])) {
                                if (getCardLogicValue(bNextList[NextAnalyseData.bOneFirst[0]]) > getCardLogicValue(bFirstList[FirstAnalyseData.bOneFirst[0]]))
                                    return enCRGreater;
                                else if (getCardLogicValue(bNextList[NextAnalyseData.bOneFirst[0]]) < getCardLogicValue(bFirstList[FirstAnalyseData.bOneFirst[0]]))
                                    return enCRLess;
                                else{
                                        if (getCardColor(bNextList[NextAnalyseData.bOneFirst[0]]) < getCardColor(bFirstList[FirstAnalyseData.bOneFirst[0]]))
                                        return enCRLess;
                                    else if(getCardColor(bNextList[NextAnalyseData.bOneFirst[0]]) > getCardColor(bFirstList[FirstAnalyseData.bOneFirst[0]]))
                                        return enCRGreater;
                                }
                                    return enCREqual;
                            }
                            else {
                                if (getCardLogicValue(bNextList[NextAnalyseData.bTwoFirst[1]]) > getCardLogicValue(bFirstList[FirstAnalyseData.bTwoFirst[1]]))
                                    return enCRGreater;
                                else
                                    return enCRLess;
                            }
                        }
                        else {
                            if (getCardLogicValue(bNextList[NextAnalyseData.bTwoFirst[0]]) > getCardLogicValue(bFirstList[FirstAnalyseData.bTwoFirst[0]]))
                                return enCRGreater;
                            else
                                return enCRLess;
                        }
                    }
                case CT_THREE:                      //三张牌型
                    {
                         console.log("三张牌型一样")
                        // console.log("NextAnalyseData.bThreeFirst[0]")
                        // console.log(NextAnalyseData.bThreeFirst[0])   //2
                        // console.log("bNextList[NextAnalyseData.bThreeFirst[0]]")
                        // console.log(bNextList[NextAnalyseData.bThreeFirst[0]])  //52

                        // console.log("FirstAnalyseData.bThreeFirst[0]")
                        // console.log(FirstAnalyseData.bThreeFirst[0])   //1
                        // console.log("bFirstList[FirstAnalyseData.bThreeFirst[0]]")
                        // console.log(bFirstList[FirstAnalyseData.bThreeFirst[0]])  //52
                        // console.log(bNextList)
                        // console.log(change16(bNextList))
                        // console.log(bFirstList)
                        // console.log(change16(bFirstList))
                        

                        // console.log(getCardLogicValue(bNextList[NextAnalyseData.bThreeFirst[0]]))
                        // console.log(getCardLogicValue(bFirstList[FirstAnalyseData.bThreeFirst[0]]))



                        if (getCardLogicValue(bNextList[NextAnalyseData.bThreeFirst[0]]) > getCardLogicValue(bFirstList[FirstAnalyseData.bThreeFirst[0]]))
                            return enCRGreater;
                        else if (getCardLogicValue(bNextList[NextAnalyseData.bThreeFirst[0]]) < getCardLogicValue(bFirstList[FirstAnalyseData.bThreeFirst[0]]))
                            return enCRLess;
                        // else
                        //     return enCREqual;
                        else{
                            var pai1 =[];
                            var pai2 =[];
                            pai1.push(bFirstList[FirstAnalyseData.bThreeFirst[0]])
                            pai1.push(bFirstList[FirstAnalyseData.bOneFirst[0]])
                            pai1.push(bFirstList[FirstAnalyseData.bOneFirst[1]])
                            pai2.push(bNextList[NextAnalyseData.bThreeFirst[0]])
                            pai2.push(bNextList[NextAnalyseData.bOneFirst[0]])
                            pai2.push(bNextList[NextAnalyseData.bOneFirst[1]])
                            var res = compareCard(pai1, pai2, pai1.length, pai2.length, true);
                            return res;
                        }


                    }
                case CT_FIVE_THREE_DEOUBLE:         //三条一对
                    {
                        if (getCardLogicValue(bNextList[NextAnalyseData.bThreeFirst[0]]) == getCardLogicValue(bFirstList[FirstAnalyseData.bThreeFirst[0]])) {
                            if (getCardLogicValue(bNextList[NextAnalyseData.bTwoFirst[0]]) > getCardLogicValue(bFirstList[FirstAnalyseData.bTwoFirst[0]]))
                                return enCRGreater;
                            else if (getCardLogicValue(bNextList[NextAnalyseData.bTwoFirst[0]]) < getCardLogicValue(bFirstList[FirstAnalyseData.bTwoFirst[0]]))
                                return enCRLess;
                            else
                                return enCREqual;
                        }
                        else {
                            if (getCardLogicValue(bNextList[NextAnalyseData.bThreeFirst[0]]) > getCardLogicValue(bFirstList[FirstAnalyseData.bThreeFirst[0]]))
                                return enCRGreater;
                            else
                                return enCRLess;
                        }
                    }
                case CT_FIVE_MIXED_FLUSH_FIRST_A:   //A在前顺子
                {
                    if (getCardColor(bNextList[0]) > getCardColor(bFirstList[0]))
                    return enCRGreater;
                   else if (getCardColor(bNextList[0]) < getCardColor(bFirstList[0]))
                      return enCRLess;
                    
                      return enCREqual;
                }
                case CT_FIVE_MIXED_FLUSH_BACK_A:    //A在后顺子
                    {
                        //比较最大的一张牌

                        if (getCardColor(bNextList[0]) > getCardColor(bFirstList[0]))
                                return enCRGreater;
                        else if (getCardColor(bNextList[0]) < getCardColor(bFirstList[0]))
                                return enCRLess;
                        
                         return enCREqual;
                    }
                case CT_FIVE_MIXED_FLUSH_NO_A:      //没A杂顺
                    {
                        //比较数值
                        for (var i = 0; i < 5; ++i) {
                            if (getCardLogicValue(bNextList[i]) > getCardLogicValue(bFirstList[i]))
                                return enCRGreater;
                            else if (getCardLogicValue(bNextList[i]) < getCardLogicValue(bFirstList[i]))
                                return enCRLess;
                        }
                       
                        //比较花色
                        for (var i = 0; i < 5; i++) {
                            if (getCardColor(bNextList[i]) > getCardColor(bFirstList[i]))
                                return enCRGreater;
                            else if (getCardColor(bNextList[i]) < getCardColor(bFirstList[i]))
                                return enCRLess;
                        }

                        return enCREqual;
                        
                    }
                case CT_FIVE_FLUSH:                 //同花五牌
                    {
                        //去掉同花进行比较
                         console.log("同花五牌")
                        // console.log(oldInFirstList)
                        // console.log(oldInNextList)
                        // console.log(bFirstList)
                        // console.log(bNextList)
                     
                        // console.log("bFirstList[FirstAnalyseData.bThreeFirst]")
                        // console.log(bFirstList[FirstAnalyseData.bThreeFirst[0]])
                        // console.log("bNextList[NextAnalyseData.bThreeFirst]]")
                        // console.log(bNextList[NextAnalyseData.bThreeFirst[0]])
                        
                        /* ------------------------------------------多一色的模式中，同花的时候有三条的情况出现 -------start----------- */
                        /*if( bFirstList[FirstAnalyseData.bThreeFirst[0]] || bNextList[NextAnalyseData.bThreeFirst[0]] ){
                            if (bFirstList[FirstAnalyseData.bThreeFirst[0]] && !bNextList[NextAnalyseData.bThreeFirst[0]]){
                                console.log("进入1111")
                                return enCRLess;
                            } else if (!bFirstList[FirstAnalyseData.bThreeFirst[0]] && bNextList[NextAnalyseData.bThreeFirst[0]]){
                                console.log("进入2222")
                                return enCRGreater;
                            } else if (bFirstList[FirstAnalyseData.bThreeFirst[0]] && bNextList[NextAnalyseData.bThreeFirst[0]]){
                                var pai1 =[];
                                var pai2 =[];
                                pai1.push(bFirstList[FirstAnalyseData.bThreeFirst[0]]);
                                pai1.push(bFirstList[FirstAnalyseData.bThreeFirst[0]]);
                                pai1.push(bFirstList[FirstAnalyseData.bOneFirst[0]]);
                                pai2.push(bNextList[NextAnalyseData.bThreeFirst[0]]);
                                pai2.push(bNextList[NextAnalyseData.bThreeFirst[0]]);
                                pai2.push(bNextList[NextAnalyseData.bOneFirst[0]]);
                                var res = compareCard(pai1, pai2, pai1.length, pai2.length, true);
                                return res;
                            }
                        }
                        /* -----------------------------------------------------------------------------------------end---------------------- */
                        
                        /*for (var i = 0; i < oldInNextList.length; ++i) {
                            var v1 = oldInNextList[i] & 0xf;
                            if (v1 == 14) {
                                v1 = 15;
                            }else if (v1 == 1) {
                                v1 = 14;
                            }
                            var v2 = oldInFirstList[i] & 0xf;
                            if (v2 == 14) {
                                v2 = 15;
                            }else if (v2 == 1) {
                                v2 = 14;
                            }
                            if (i == 0) {
                                if (v1 != 15 && v2 != 15) {
                                    break;
                                }
                            }
                            if (v1 > v2) {
                                console.log("v1>v2了")
                                return enCRGreater;;
                            }else if(v1<v2){
                                console.log("v1<v2了")
                                
                                return enCRLess;
                            }else{
                                if(i==oldInNextList.length){
                                    return enCREqual;
                                }
                            }
                            
                        }

                        var tmpNext = bNextList.slice(0);
                        var tmpFirst = bFirstList.slice(0);
                        tmpNext[0] = tmpNext[0]&0xf0f;
                        tmpNext[1] = tmpNext[1]&0xf0f;
                        tmpNext[1] = tmpNext[1]|0x10;
                        tmpFirst[0] = tmpFirst[0]&0xf0f;
                        tmpFirst[1] = tmpFirst[1]&0xf0f;
                        tmpFirst[1] = tmpFirst[1]|0x10;
                        var res = compareCard(tmpFirst, tmpNext, tmpFirst.length, tmpNext.length, true);
                        // if (res == 0) {
                        //     //比较花色
                        //     for (var i = 0; i < 5; i++) {
                        //         if (getCardColor(bNextList[i]) > getCardColor(bFirstList[i]))
                        //             return enCRGreater;
                        //         else if (getCardColor(bNextList[i]) < getCardColor(bFirstList[i]))
                        //             return enCRLess;
                        //     }
                        // }else{
                            return res;*/
                        // }

                        for (var i = 0; i < bFirstCount; ++i) {
                            if (getCardLogicValue(bNextList[i]) > getCardLogicValue(bFirstList[i]))
                                return enCRGreater;
                            else if (getCardLogicValue(bNextList[i]) < getCardLogicValue(bFirstList[i]))
                                return enCRLess;
                        }
                        
                       
                        //  if (getCardColor(bNextList[0]) > getCardColor(bFirstList[0]))
                        //         return enCRGreater;
                        // else if (getCardColor(bNextList[0]) < getCardColor(bFirstList[0]))
                        //         return enCRLess;
                        return enCREqual;
                    }
                case CT_FIVE_FOUR_ONE:              //四带一张
                    {
                       if (getCardLogicValue(bNextList[NextAnalyseData.bFourFirst[0]]) > getCardLogicValue(bFirstList[FirstAnalyseData.bFourFirst[0]]))
                            return enCRGreater;
                        else if(getCardLogicValue(bNextList[NextAnalyseData.bFourFirst[0]]) == getCardLogicValue(bFirstList[FirstAnalyseData.bFourFirst[0]])){

                            if(getCardLogicValue(bNextList[NextAnalyseData.bOneFirst[0]])>getCardLogicValue(bFirstList[FirstAnalyseData.bOneFirst[0]]))
                                 return enCRGreater;
                            else if(getCardLogicValue(bNextList[NextAnalyseData.bOneFirst[0]])==getCardLogicValue(bFirstList[FirstAnalyseData.bOneFirst[0]])){
                                 
                                    if(getCardColor(bNextList[NextAnalyseData.bOneFirst[0]]) > getCardColor(bFirstList[FirstAnalyseData.bOneFirst[0]]))
                                        return enCRGreater;
                                     else if(getCardColor(bNextList[NextAnalyseData.bOneFirst[0]]) == getCardColor(bFirstList[FirstAnalyseData.bOneFirst[0]]))
                                        return enCRLess;
                                
                                    return enCREqual;
                            }
                            else
                               return enCRLess;

                           
                        }
                        else
                            return enCRLess;
                    }
                case CT_FIVE_STRAIGHT_FLUSH_FIRST_A://A在前同花顺
                    {
                        //比较数值
                        for (var i = 0; i < 5; ++i) {
                            if (getCardLogicValue(bNextList[i]) > getCardLogicValue(bFirstList[i]))
                                return enCRGreater;
                            else if (getCardLogicValue(bNextList[i]) < getCardLogicValue(bFirstList[i]))
                                return enCRLess;
                        }

                        //比较花色
                        // for (var i = 0; i < 5; i++) {
                        //     if (getCardColor(bNextList[i]) > getCardColor(bFirstList[i]))
                        //         return enCRGreater;
                        //     else if (getCardColor(bNextList[i]) < getCardColor(bFirstList[i]))
                        //         return enCRLess;
                        // }

                        if (getCardColor(bNextList[0]) > getCardColor(bFirstList[0]))
                                return enCRGreater;
                          else if (getCardColor(bNextList[0]) < getCardColor(bFirstList[0]))
                                return enCRLess;
                          return enCREqual;

                    }
                case CT_FIVE_STRAIGHT_FLUSH:        //同花顺牌
                    {
                        //比较数值
                        for (var i = 0; i < 5; ++i) {
                            if (getCardLogicValue(bNextList[i]) > getCardLogicValue(bFirstList[i]))
                                return enCRGreater;
                            else if (getCardLogicValue(bNextList[i]) < getCardLogicValue(bFirstList[i]))
                                return enCRLess;
                        }

                        //比较花色
                        // for (var i = 0; i < 5; i++) {
                        //     if (getCardColor(bNextList[i]) > getCardColor(bFirstList[i]))
                        //         return enCRGreater;
                        //     else if (getCardColor(bNextList[i]) < getCardColor(bFirstList[i]))
                        //         return enCRLess;
                        // }

                          if (getCardColor(bNextList[0]) > getCardColor(bFirstList[0]))
                                return enCRGreater;
                          else if (getCardColor(bNextList[0]) < getCardColor(bFirstList[0]))
                                return enCRLess;
                        return enCREqual;
                    }
                case CT_FIVE:
                    {
                        if (getCardLogicValue(bNextList[0]) > getCardLogicValue(bFirstList[0])) {
                            return enCRGreater;
                        }else if (getCardLogicValue(bNextList[0]) < getCardLogicValue(bFirstList[0])) {
                            return enCRLess;
                        }else {
                            return enCREqual;
                        }
                    }
                default:
                    return enCRError;
            }
        }
        else {
            if (bNextType > bFirstType)
                return enCRGreater;
            else
                return enCRLess;
        }
    }
    else {
        ASSERT(bFirstType == CT_SINGLE || bFirstType == CT_ONE_DOUBLE || bFirstType == CT_THREE);
        if (bFirstType != CT_SINGLE && bFirstType != CT_ONE_DOUBLE && bFirstType != CT_THREE)
            return enCRError;
        //开始对比
        if (bNextType == bFirstType) {
            switch (bFirstType) {
                case CT_SINGLE:             //单牌类型
                    {
                        for (var i = 0; i < bFirstCount; ++i) {
                            if (getCardLogicValue(bNextList[i]) > getCardLogicValue(bFirstList[i]))
                                return enCRGreater;
                            else if (getCardLogicValue(bNextList[i]) < getCardLogicValue(bFirstList[i]))
                                return enCRLess;
                        }

                        if (bNextCount > bFirstCount)
                            return enCRGreater;
                        else
                            return enCRLess;
                    }
                case CT_ONE_DOUBLE:         //对带一张
                    {
                        if (getCardLogicValue(bNextList[NextAnalyseData.bTwoFirst[0]]) == getCardLogicValue(bFirstList[FirstAnalyseData.bTwoFirst[0]])) {
                            if (getCardLogicValue(bNextList[NextAnalyseData.bOneFirst[0]]) > getCardLogicValue(bFirstList[FirstAnalyseData.bOneFirst[0]]))
                                return enCRGreater;
                            else if (getCardLogicValue(bNextList[NextAnalyseData.bOneFirst[0]]) < getCardLogicValue(bFirstList[FirstAnalyseData.bOneFirst[0]]))
                                return enCRLess;
                            else {
                                if (bNextCount > bFirstCount)
                                    return enCRGreater;
                                else
                                    return enCRLess;
                            }
                        }
                        else {
                            if (getCardLogicValue(bNextList[NextAnalyseData.bTwoFirst[0]]) > getCardLogicValue(bFirstList[FirstAnalyseData.bTwoFirst[0]]))
                                return enCRGreater;
                            else
                                return enCRLess;
                        }
                    }
                case CT_THREE:              //三张牌型
                    {
                        if (getCardLogicValue(bNextList[NextAnalyseData.bThreeFirst[0]]) > getCardLogicValue(bFirstList[FirstAnalyseData.bThreeFirst[0]]))
                            return enCRGreater;
                        else if (getCardLogicValue(bNextList[NextAnalyseData.bThreeFirst[0]]) < getCardLogicValue(bFirstList[FirstAnalyseData.bThreeFirst[0]]))
                            return enCRLess;
                        else {
                            if (bNextCount > bFirstCount)
                                return enCRGreater;
                            else
                                return enCRLess;
                        }
                    }
                default:
                    return enCRError;
            }
        }
        else {
            if (bNextType > bFirstType)
                return enCRGreater;
            else
                return enCRLess;
        }
    }

    // return enCRError;
}

//检查龙牌
function isStraightDragon(cbCardData, bCardCount) {
    //校验数据
    ASSERT(bCardCount > 0 && bCardCount <= 13);
    if (bCardCount <= 0 || bCardCount > 13) {
        return false;
    }

    var b1 = isLinkCard(cbCardData, bCardCount);
    var b2 = isSameColorCard(cbCardData, bCardCount);
    if (b1 == false || b2 == false) {
        return false;
    }

    return true;
}

//是否顺子
function isLinkCard(cbCardData, cbCardCount) {
    ASSERT(cbCardCount > 0);
    if (cbCardCount <= 0) {
        return false;
    }

    var bRet = true;
    var cbCardBuffer = [];
    CopyMemory(cbCardBuffer, cbCardData);
    if(cbCardCount == 3){
        var arr = [];
        arr[0] = cbCardData[0]&0xf;
        arr[1] = cbCardData[1]&0xf;
        arr[2] = cbCardData[2]&0xf;
        arr.sort(function (a, b) {
            return parseInt(a) - parseInt(b);
        });
        if (arr[0] + 1 == arr[1] && arr[1] + 1 == arr[2]) {
            return true;
        }
        if (arr[0] == 1 && arr[1] == 12 && arr[2] == 13) {
          return true;
        }
    }

    //降序排列
    sortCardList(cbCardBuffer, cbCardCount, enDescend);

    var cbFirstCard = getCardLogicValue(cbCardBuffer[0]);
    for (var i = 1; i < cbCardCount; i++) {
        var cbNextCard = getCardLogicValue(cbCardBuffer[i]);
        if (cbFirstCard != cbNextCard + i) {
            bRet = false;
        }
    }

    return bRet;
}

//是否同花
function isSameColorCard(cbCardData, cbCardCount) {
    ASSERT(cbCardCount > 0);
    if (cbCardCount <= 0) {
        return false;
    }

    var bRet = true;

    var cbFirstCard = getCardColor(cbCardData[0]);
    for (var i = 1; i < cbCardCount; i++) {
        var cbNextCard = getCardColor(cbCardData[i]);
        if (cbNextCard != cbFirstCard) {
            bRet = false;
        }
    }

    return bRet;
}

//获取对数
function getDoubleCount(cbFrontCard, cbMidCard, cbBackCard) {
    var AanlyseFront = struct_tagAnalyseData();
    var AnalyseMid = struct_tagAnalyseData();
    var AnalyeBack = struct_tagAnalyseData();

    analyseCard(cbFrontCard, 3, AanlyseFront);
    analyseCard(cbMidCard, 5, AnalyseMid);
    analyseCard(cbBackCard, 5, AnalyeBack);

    if ((AanlyseFront.bTwoCount == 1) && (AnalyseMid.bTwoCount == 2) && (AnalyeBack.bTwoCount == 2)) {
        if ((getCardLogicValue(cbFrontCard[AanlyseFront.bOneFirst[0]]) == getCardLogicValue(cbMidCard[AnalyseMid.bOneFirst[0]])) ||
            (getCardLogicValue(cbMidCard[AnalyseMid.bOneFirst[0]]) == getCardLogicValue(cbBackCard[AnalyeBack.bOneFirst[0]])) ||
            (getCardLogicValue(cbFrontCard[AanlyseFront.bOneFirst[0]]) == getCardLogicValue(cbBackCard[AnalyeBack.bOneFirst[0]])))
            return 6;
    }

    return AanlyseFront.bTwoCount + AnalyseMid.bTwoCount + AnalyeBack.bTwoCount;
}

//分析扑克
function analyseCard(bCardDataList, bCardCount, AnalyseData) {
    ASSERT(3 == bCardCount || 5 == bCardCount);
   // console.log("开始分析扑克")
    
    //排列扑克
    var bCardData = [];
    CopyMemory(bCardData, bCardDataList);
    sortCardList(bCardData, bCardCount, enDescend);

    // console.log("排列后")
    // console.log(bCardDataList)
    // console.log(bCardData)
    
    //变量定义
    var bSameCount = 1;
    var bCardValueTemp = 0;
    var bSameColorCount = 1;
    var bFirstCardIndex = 0;   //记录下标

    var bLogicValue = getCardLogicValue(bCardData[0]);
    var bCardColor = getCardColor(bCardData[0]);
    // console.log(bLogicValue)
    // console.log(bCardColor)

    //扑克分析
    for (var i = 1; i < bCardCount; i++) {
        //获取扑克
        bCardValueTemp = getCardLogicValue(bCardData[i]);
        // console.log("bCardValueTemp"+i)
        // console.log(bCardValueTemp)
        if (bCardValueTemp == bLogicValue) bSameCount++;

        //保存结果
        if ((bCardValueTemp != bLogicValue) || (i == (bCardCount - 1)) || bCardData[i] == 0) {
            switch (bSameCount) {
                case 1:     //一张
                    break;
                case 2:     //两张
                    {
                        AnalyseData.bTwoFirst[AnalyseData.bTwoCount] = bFirstCardIndex;
                        AnalyseData.bTwoCount++;
                        break;
                    }
                case 3:     //三张
                    {
                        AnalyseData.bThreeFirst[AnalyseData.bThreeCount] = bFirstCardIndex;
                        AnalyseData.bThreeCount++;
                        break;
                    }
                case 4:     //四张
                    {
                        AnalyseData.bFourFirst[AnalyseData.bFourCount] = bFirstCardIndex;
                        AnalyseData.bFourCount++;
                        break;
                    }
                case 5:     //五张
                {
                    AnalyseData.bFiveFirst[AnalyseData.bFiveCount] = bFirstCardIndex;
                    AnalyseData.bFiveCount++;
                    break;
                }
                default:
                    //MyMsgBox(_T("AnalyseCard：错误扑克！: %d") , bSameCount) ;
                    break;
            }
        }

        //王牌自动转化同花
        if (bCardData[i] == 0) {
            bSameColorCount += bCardCount - i;
            break;
        }

        //设置变量
        if (bCardValueTemp != bLogicValue) {
            if (bSameCount == 1) {
                if (i != bCardCount - 1) {
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = bFirstCardIndex;
                    AnalyseData.bOneCount++;
                }
                else {
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = bFirstCardIndex;
                    AnalyseData.bOneCount++;
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = i;
                    AnalyseData.bOneCount++;
                }
            }
            else {
                if (i == bCardCount - 1) {
                    AnalyseData.bOneFirst[AnalyseData.bOneCount] = i;
                    AnalyseData.bOneCount++;
                }
            }
            bSameCount = 1;
            bLogicValue = bCardValueTemp;
            bFirstCardIndex = i;

        }
        if (getCardColor(bCardData[i]) != bCardColor) bSameColorCount = 1;
        else ++bSameColorCount;
    }

    //是否同花
    AnalyseData.bSameColor = (5 == bSameColorCount) ? true : false;

    return;
}

//分析扑克
function analysebCardData(cbCardData, cbCardCount, AnalyseResult) {
    //扑克分析
    for (var i = 0; i < cbCardCount; i++) {
        //变量定义
        var cbSameCount = 1;
        var cbLogicValue = getCardLogicValue(cbCardData[i]);

        //搜索同牌
        for (var j = i + 1; j < cbCardCount; j++) {
            //获取扑克
            if (getCardLogicValue(cbCardData[j]) != cbLogicValue) break;

            //设置变量
            cbSameCount++;
        }

        //设置结果
        var cbIndex = AnalyseResult.cbBlockCount[cbSameCount - 1]++;
        for (var j = 0; j < cbSameCount; j++) {
            var v1 = AnalyseResult.cbCardData;
            v1 = v1[cbSameCount - 1];
            if (v1 == null) {
                console.log(v1, cbSameCount, AnalyseResult.cbCardData);
            }
            v1 = v1[cbIndex * cbSameCount + j];
            v1 = cbCardData[i + j];
            AnalyseResult.cbCardData[cbSameCount - 1][cbIndex * cbSameCount + j] = cbCardData[i + j];
        }

        //设置索引
        i += (cbSameCount - 1);
    }

    return;
}

//分析分布
function analysebDistributing(cbCardData, cbCardCount, Distributing) {
    //设置变量
    for (var i = 0; i < cbCardCount; i++) {
        if (cbCardData[i] == 0) continue;

        //获取属性
        var cbCardColor = getCardColor(cbCardData[i]);
        var cbCardValue = getCardValue(cbCardData[i]);

        //分布信息
        Distributing.cbCardCount++;
        Distributing.cbDistributing[cbCardValue - 1][cbIndexCount]++;
        Distributing.cbDistributing[cbCardValue - 1][cbCardColor]++;
    }

    return;
}
//分析分布
function analysebDistributingA(cbCardData, cbCardCount, Distributing) {
    //设置变量
    for (var i = 0; i < cbCardCount; i++) {
        if (cbCardData[i] == 0) continue;

        //获取属性
        var cbCardColor = getCardColor(cbCardData[i]);
        var cbCardValue = getCardValue(cbCardData[i]);

        //分布信息
        if(cbCardValue==1){
            Distributing.cbCardCount++;
            Distributing.cbDistributing[cbCardValue - 1][cbIndexCount]++;
            Distributing.cbDistributing[cbCardValue - 1][cbCardColor]++;
        }
    }

    return;
}
/****************************************************
*函数名：AnalyseMaxTransform 
*功能：  根据牌型和王牌数目对牌进行最大转换 JJ
*参数：     cbCardData         牌数组         IN
         cbCardCount        牌数目         IN
         bTransCardData     转化后牌数组  OUT
         TransData          转化信息        OUT
*返回值：0                  不转化
         other              转化后的牌型
****************************************************/
function analyseMaxTransform(cbCardData, cbCardCount, bTransCardData, TransData) {
    ASSERT(cbCardCount == 3 || cbCardCount == 5);

    //变量声明
    var bTempCardData = [];        //保存清空王后的数组
    var bKcount = 0;                   //王数目

    //初始化
    CopyMemory(bTransCardData, cbCardData);
    CopyMemory(bTempCardData, cbCardData);

    //将王牌置0并统计  
    for (var i = 0; i < cbCardCount; i++) {
        if (bTempCardData[i] == 0x41 || bTempCardData[i] == 0x42) {
            TransData.bHaveKing += ((bTempCardData[i] == 0x41) ? 1 : 2);
            bTempCardData[i] = 0;
            bKcount++;
        }
    }
    TransData.bKingCount = bKcount;

    //无王返回
    if (bKcount == 0)
        return 0;

    //有王则分析牌数组
    sortCardList(bTempCardData, cbCardCount, enDescend);
    var tad = struct_tagAnalyseData();
    analyseCard(bTempCardData, cbCardCount, tad);

    //炸弹直接返回
    /*if (tad.bFourCount == 1)
    return 0;*/

    //潜质判断  (从大到小依次计算)

    //五同
    if (5 == cbCardCount && 1 == tad.bFiveCount) {
        transformCard(bTempCardData, cbCardCount, bKcount, CT_FIVE, tad, bTransCardData, TransData);
        return CT_FIVE;
    }

    //同花顺 (5张牌 且 同花 且 全单牌)
    if (5 == cbCardCount && tad.bSameColor && 0 == (tad.bTwoCount + tad.bThreeCount + tad.bFourCount)) {
        //A当1用，有A 且 第二大数字小于等于5, 最小顺子A2345
        if (14 == getCardLogicValue(bTempCardData[0]) && 5 >= getCardLogicValue(bTempCardData[1])) {
            transformCard(bTempCardData, cbCardCount, bKcount, CT_FIVE_STRAIGHT_FLUSH_FIRST_A, tad, bTransCardData, TransData);
            return CT_FIVE_STRAIGHT_FLUSH_FIRST_A;
        }

        //最大牌减去最小牌小于等于4
        if (4 >= getCardLogicValue(bTempCardData[0]) - getCardLogicValue(bTempCardData[5 - bKcount - 1])) {
            transformCard(bTempCardData, cbCardCount, bKcount, CT_FIVE_STRAIGHT_FLUSH, tad, bTransCardData, TransData);
            return CT_FIVE_STRAIGHT_FLUSH;
        }
    }

    //炸弹    (5张牌 且 单王3张数目等于一或者双王2张数目或者3张数目等于一)
    if (5 == cbCardCount && ((1 == bKcount && 1 == tad.bThreeCount) || (2 == bKcount && (1 == tad.bThreeCount || 1 == tad.bTwoCount)))) {
        transformCard(bTempCardData, cbCardCount, bKcount, CT_FIVE_FOUR_ONE, tad, bTransCardData, TransData);
        return CT_FIVE_FOUR_ONE;
    }

    //葫芦  (5张牌 且 单王2张数目等于2）
    if (5 == cbCardCount && 1 == bKcount && 2 == tad.bTwoCount) {
        transformCard(bTempCardData, cbCardCount, bKcount, CT_FIVE_THREE_DEOUBLE, tad, bTransCardData, TransData);
        return CT_FIVE_THREE_DEOUBLE;
    }

    //同花  (5张牌 且 全部同花）
    if (5 == cbCardCount && tad.bSameColor) {
        transformCard(bTempCardData, cbCardCount, bKcount, CT_FIVE_FLUSH, tad, bTransCardData, TransData);
        return CT_FIVE_FLUSH;
    }

    //顺子    (5张牌 且 非同花 且 全单牌)
    if (5 == cbCardCount && !tad.bSameColor && 0 == (tad.bTwoCount + tad.bThreeCount + tad.bFourCount)) {
        //A当1用，有A 且 第二大数字小于等于5, 最小顺子A2345
        if (14 == getCardLogicValue(bTempCardData[0]) && 5 >= getCardLogicValue(bTempCardData[1])) {
            transformCard(bTempCardData, cbCardCount, bKcount, CT_FIVE_MIXED_FLUSH_FIRST_A, tad, bTransCardData, TransData);
            return CT_FIVE_MIXED_FLUSH_FIRST_A;
        }

        //最大牌减去最小牌小于等于4
        if (4 >= getCardLogicValue(bTempCardData[0]) - getCardLogicValue(bTempCardData[5 - bKcount - 1])) {
            transformCard(bTempCardData, cbCardCount, bKcount, CT_FIVE_MIXED_FLUSH_NO_A, tad, bTransCardData, TransData);
            return CT_FIVE_MIXED_FLUSH_NO_A;
        }
    }

    //三条  (3或5张牌 且 单王2张数目等于1或双王全单牌)
    if ((1 == bKcount && 1 == tad.bTwoCount) || (2 == bKcount && 0 == (tad.bTwoCount + tad.bThreeCount + tad.bFourCount))) {
        transformCard(bTempCardData, cbCardCount, bKcount, CT_THREE, tad, bTransCardData, TransData);
        return CT_THREE;
    }

    //两对  (不存在)

    //一对  (3或5张牌 且单王全单牌)
    if (1 == bKcount && 0 == (tad.bTwoCount + tad.bThreeCount + tad.bFourCount)) {
        transformCard(bTempCardData, cbCardCount, bKcount, CT_ONE_DOUBLE, tad, bTransCardData, TransData);
        return CT_ONE_DOUBLE;
    }

    //这里正常来说是不可能到的，到了只能说有Bug。。。
    return CT_SINGLE;
}

/****************************************************
*函数名：TransformCard 
*功能：  用于对已确定潜质牌型的牌进行转换,只能由AnalyseMaxTransform函数使用 JJ
*参数：     cbNkCardData       除去王的牌组  IN
         cbCardCount        牌数目(3or5)           IN
         bKCount            王数目(1or2)           IN
         bCardType          牌潜质类型(即转化方向)  IN
         tad                牌型信息                IN
         bTransCardData     转化后牌数组(升序排列)    OUT
         TransData          转化信息                INOUT
*返回值：无(本函数不检查数据，数据检查由本函数唯一调用
            者AnalyseMaxTransform进行)
****************************************************/
function transformCard(cbNkCardData, bCardCount, bKCount, bCardType, tad, bTransCardData, TransData) {
    ASSERT((3 == bCardCount || 5 == bCardCount) && (1 == bKCount || 2 == bKCount));

    //变量定义
    var cardList = [];           //记录转化后牌数组      
    var bTempCardData = [];

    //初始化
    CopyMemory(bTempCardData, cbNkCardData);
    for (var i = 0; i < bCardCount - bKCount; i++) {
        cardList.push(bTempCardData[i]);
    }

    //转化开始
    switch (bCardType) {
        //顺子的转化算法是从非王最小牌开始,往上增直到非王最大牌发现有空缺先填空缺，没有空缺则根据是否到终点填充两头
        case CT_FIVE_STRAIGHT_FLUSH_FIRST_A:
        case CT_FIVE_STRAIGHT_FLUSH:
        case CT_FIVE_MIXED_FLUSH_FIRST_A:
        case CT_FIVE_MIXED_FLUSH_NO_A:
            {
                //数据校验
                ASSERT(5 == bCardCount);

                //升序排列          (仅顺子使用升序排列)
                sortCardList(bTempCardData, 5 - bKCount, enAscend);

                //清空链表
                cardList = [];

                //定义变量
                var bLogicHeadCard = 0;        //最小牌的逻辑值
                var bTempCount = 0;            //转化进行到的位置
                var bCardColor = getCardColor(bTempCardData[0]);

                //填充首部
                if (bCardType == CT_FIVE_STRAIGHT_FLUSH_FIRST_A || bCardType == CT_FIVE_MIXED_FLUSH_FIRST_A) {
                    bLogicHeadCard = 1;
                    cardList.push(bTempCardData[5 - bKCount - 1]);
                    bTempCount = 0;
                }
                else {
                    bLogicHeadCard = getCardLogicValue(bTempCardData[0]);
                    cardList.push(bTempCardData[0]);
                    bTempCount = 1;
                }

                //填充剩余
                for (var i = 1; i < 5; i++) {
                    if (getCardLogicValue(bTempCardData[bTempCount]) != bLogicHeadCard + i) {
                        var transCard = 0;
                        if (bCardType == CT_FIVE_STRAIGHT_FLUSH_FIRST_A || bCardType == CT_FIVE_STRAIGHT_FLUSH)
                            transCard = (bCardColor << 4) + bLogicHeadCard + i;
                        else
                            transCard = 0x30 + bLogicHeadCard + i;
                        cardList.push(transCard);
                        TransData.transList.push(transCard);
                    }
                    else {
                        cardList.push(bTempCardData[bTempCount]);
                        bTempCount++;
                    }
                    if (bTempCount == 5 - bKCount)
                        break;
                }

                //剩余王牌
                if (cardList.length != 5) {
                    while (cardList.length < 5) {
                        var bLastCard = cardList[cardList.length - 1];
                        var bFirstCard = cardList[0];
                        var transCard = 0;
                        var bMaxEnd = (getCardLogicValue(bLastCard) == 14);
                        var bExValue = getCardLogicValue(bMaxEnd ? bFirstCard : bLastCard) + (bMaxEnd ? -1 : 1);
                        if (bExValue == 14) bExValue = 1;

                        if (bCardType == CT_FIVE_STRAIGHT_FLUSH_FIRST_A || bCardType == CT_FIVE_STRAIGHT_FLUSH)
                            transCard = (bCardColor << 4) + bExValue;
                        else
                            transCard = 0x30 + bExValue;

                        if (bMaxEnd)
                            cardList.unshift(transCard);
                        else
                            cardList.push(transCard);
                        TransData.transList.push(transCard);
                    }
                }

                break;
            }
        //炸弹的转化算法是直接找到3张的或者2张的，王变成同值的黑桃牌
        case CT_FIVE_FOUR_ONE:
            {
                //数据校验
                ASSERT(5 == bCardCount);

                //王牌转化
                if (bKCount == 1) {
                    var transCard = 0x30 + getCardValue(bTempCardData[tad.bThreeFirst[0]]);
                    cardList.push(transCard);
                    TransData.transList.push(transCard);
                }
                else {
                    if (tad.bThreeCount == 1) {
                        var transCard = 0x30 + getCardValue(bTempCardData[tad.bThreeFirst[0]]);
                        cardList.push(transCard);
                        TransData.transList.push(transCard);

                        if (getCardLogicValue(bTempCardData[tad.bThreeFirst[0]]) == 14)
                            transCard = 0x3D;
                        else
                            transCard = 0x31;
                        cardList.push(transCard);
                        TransData.transList.push(transCard);
                    }
                    else {
                        var transCard = 0x30 + getCardValue(bTempCardData[tad.bTwoFirst[0]]);
                        cardList.push(transCard);
                        cardList.push(transCard);
                        TransData.transList.push(transCard);
                        TransData.transList.push(transCard);
                    }
                }

                break;
            }
        //葫芦的转化算法是直接找到2对2张中大的，王变成同值的黑桃牌
        case CT_FIVE_THREE_DEOUBLE:
            {
                //数据校验
                ASSERT(5 == bCardCount && bKCount == 1);

                //王牌转化
                var transCard = 0x30 + getCardValue(bTempCardData[tad.bTwoFirst[0]]);
                cardList.push(transCard);
                TransData.transList.push(transCard);
                break;
            }
        //同花的转化算法是王变成同花
        case CT_FIVE_FLUSH:
            {
                //数据校验
                ASSERT(5 == bCardCount);

                var bCardColor = getCardColor(bTempCardData[0]);

                //王牌转化
                while (cardList.length < 5) {
                    var transCard = (bCardColor << 4) + 0x01;
                    cardList.push(transCard);
                    TransData.transList.push(transCard);
                }
                break;
            }
        //三条的转化算法是直接找到2张的或者单牌最大的，王变成同值的黑桃牌
        case CT_THREE:
            {
                //王牌转化
                if (tad.bTwoCount == 1) {
                    var transCard = 0x30 + getCardValue(bTempCardData[tad.bTwoFirst[0]]);
                    cardList.push(transCard);
                    TransData.transList.push(transCard);
                }
                else {
                    while (cardList.length < bCardCount) {
                        var transCard = 0x30 + getCardValue(bTempCardData[0]);
                        cardList.push(transCard);
                        TransData.transList.push(transCard);
                    }
                }
                break;
            }
        //一对的转化算法是直接找到单牌最大的，王变成同值的黑桃牌
        case CT_ONE_DOUBLE:
            {
                //数据校验
                ASSERT(1 == bKCount);

                //王牌转化
                var transCard = 0x30 + getCardValue(bTempCardData[0]);
                cardList.push(transCard);
                TransData.transList.push(transCard);

                break;
            }
        default:
            {
                //MyMsgBox(_T("CGameLogic::TransFormCard [%d]"), bCardType);
                break;
            }
    }
    //填充信息
    ASSERT(cardList.length == 5 || cardList.length == 3);
    for (var i = 0; i < bCardCount; i++) {
        bTransCardData[i] = cardList[FindIndex(cardList, i)];
    }

    return;
}

function Find(arr, value) {
    for (var i = 0; i < arr.length; ++i) {
        if (arr[i] == value) {
            return value;
        }
    }
}

function FindIndex(arr, value) {
    for (var i = 0; i < arr.length; ++i) {
        if (arr[i] == value) {
            return i;
        }
    }
}

/****************************************************
*函数名：CompareOneCardEx 
*功能：  单张比较，先比牌值，牌值相同则比较花色 (方<梅<红<黑)
*参数：     
bFirstCard          牌一          IN
bNextCard           牌二          IN
*返回值：
true                后大于前
false               前大于后
****************************************************/
function compareOneCardEx(bFirstCard, bNextCard, ttdFst, ttdNxt) {
    //牌值比较
    if (getCardLogicValue(bFirstCard) != getCardLogicValue(bNextCard)) {
        return getCardLogicValue(bFirstCard) < getCardLogicValue(bNextCard);
    }

    //转化比较  (由王转化来的牌比普通同值牌大，大王转化来的大于小王转化来的)
    var bFromTransFst = (Find(ttdFst.transList, bFirstCard) != null);
    var bFromTransNxt = (Find(ttdNxt.transList, bNextCard) != null);
    if (bFromTransFst != bFromTransNxt) {
        return !bFromTransFst;
    }
    else {
        if (bFromTransFst) {//比较大小王
            ASSERT((ttdFst.bHaveKing == 0) == (ttdNxt.bHaveKing == 0));
            return (ttdFst.bHaveKing < ttdNxt.bHaveKing);
        }
        else {//比较花色
            // return (getCardColor(bFirstCard) < getCardColor(bNextCard));
            return enCREqual;
        }
    }

    // return false;
}

/****************************************************
*函数名：GetMaxCardData 
*功能：  从得定牌组中抽取出最大牌型的牌   JJ
*参数：     
cbCardData          原牌(3< <=13)     IN
cbCardCount         原牌数目                IN
cbMaxCardData       取出的最大牌(<=5) OUT
bMaxCardCount       取出牌数目(1<= <=5)  OUT
*返回值：最大类型 (用于单元测试做校验,实际无用,不能做为可靠数据)
****************************************************/
function getMaxCardData(cbCardData, cbCardCount, bMaxCardData, bMaxCardCount, bNeedCCount) {
    //校验数据
    ASSERT(cbCardCount <= 13 || cbCardCount > 3);

    //定义变量
    var bKCount = 0;
    var evCardList = []; //0位存王牌,1位保留,其他位按逻辑值存放
    var evColorList = []; //方梅红黑
    var bCardArray = [];
    CopyMemory(bCardArray, cbCardData);

    sortCardList(bCardArray, cbCardCount, enDescend);

    //分析扑克
    for (var i = 0; i < cbCardCount; i++) {
        //保存王牌
        if (bCardArray[i] == 0x41 || bCardArray[i] == 0x42) {
            evCardList[0].push(bCardArray[i]);
            continue;
        }

        //保存其他
        var bLogicNum = getCardLogicValue(bCardArray[i]);
        var bColor = getCardColor(bCardArray[i]);

        ASSERT(bLogicNum > 1 && bLogicNum < 15 && bColor >= 0 && bColor <= 3);
        ASSERT(Find(evCardList[bLogicNum], bCardArray[i]) == null);

        evCardList[bLogicNum].push(bCardArray[i]);
        evColorList[bColor].push(bCardArray[i]);
    }

    ASSERT(evCardList[0].length <= 2);

    //寻找同花顺
    if (bNeedCCount == 5) {
        for (var i = 0; i < 4; i++) {
            if (evColorList[i].length + evCardList[0].length >= 5)    //同花+王牌数大于等于5
            {
                var bCount = 0;
                if (evCardList[0].length >= 0 && evColorList[i].length >= 5)        //不带王
                {
                    for (var j = 0; j < evColorList[i].length - 4; j++) {
                        var bFstCard = evColorList[i][FindIndex(evColorList[i], j)];
                        var bLstCard = evColorList[i][FindIndex(evColorList[i], j + 4)];

                        if (getCardLogicValue(bFstCard) - getCardLogicValue(bLstCard) == 4) {
                            for (var k = 0; k < 5; k++)
                                bMaxCardData[k] = evColorList[i][FindIndex(evColorList[i], j + k)];
                            bMaxCardCount = 5;
                            return CT_FIVE_STRAIGHT_FLUSH;
                        }
                    }
                    if (getCardValue(evColorList[i][0]) == 1 &&                      //检查A2345顺
                        getCardValue(evColorList[i][FindIndex(evColorList[i], evColorList[i].length - 4)]) == 5) {
                        bMaxCardData[0] = evColorList[i][0];
                        for (var k = 1; k < 5; k++)
                            bMaxCardData[k] = evColorList[i][FindIndex(evColorList[i], evColorList[i].length - k)];
                        bMaxCardCount = 5;
                        return CT_FIVE_STRAIGHT_FLUSH_FIRST_A;
                    }
                }
                if (evCardList[0].length >= 1 && evColorList[i].length >= 4)        //带单王
                {
                    for (var j = 0; j < evColorList[i].length - 3; j++) {
                        var bFstCard = evColorList[i][FindIndex(evColorList[i], j)];
                        var bLstCard = evColorList[i][FindIndex(evColorList[i], j + 3)];

                        if ((getCardLogicValue(bFstCard) - getCardLogicValue(bLstCard) == 3) ||
                            (getCardLogicValue(bFstCard) - getCardLogicValue(bLstCard) == 4)) {
                            bMaxCardData[0] = evCardList[0][0];
                            for (var k = 0; k < 4; k++)
                                bMaxCardData[k + 1] = evColorList[i][FindIndex(evColorList[i], j + k)];
                            bMaxCardCount = 5;
                            return CT_FIVE_STRAIGHT_FLUSH;
                        }
                    }
                    if (getCardValue(evColorList[i][0]) == 1 &&                      //检查A2345顺
                        getCardValue(evColorList[i][FindIndex(evColorList[i], evColorList[i].length - 3)]) <= 5) {
                        bMaxCardData[0] = evCardList[0][0];
                        bMaxCardData[1] = evColorList[i][0];
                        for (var k = 1; k < 4; k++)
                            bMaxCardData[k + 1] = evColorList[i][FindIndex(evColorList[i], evColorList[i].length - k)];
                        bMaxCardCount = 5;
                        return CT_FIVE_STRAIGHT_FLUSH_FIRST_A;
                    }
                }
                if (evCardList[0].length == 2 && evColorList[i].length >= 3)        //带双王
                {
                    for (var j = 0; j < evColorList[i].length - 2; j++) {
                        var bFstCard = evColorList[i][FindIndex(evColorList[i], j)];
                        var bLstCard = evColorList[i][FindIndex(evColorList[i], j + 2)];

                        if ((getCardLogicValue(bFstCard) - getCardLogicValue(bLstCard) == 2) ||
                            (getCardLogicValue(bFstCard) - getCardLogicValue(bLstCard) == 3) ||
                            (getCardLogicValue(bFstCard) - getCardLogicValue(bLstCard) == 4)) {
                            bMaxCardData[0] = evCardList[0][0];
                            bMaxCardData[1] = evCardList[0][evCardList.length - 1];
                            for (var k = 0; k < 3; k++)
                                bMaxCardData[k + 2] = evColorList[i][FindIndex(evColorList[i], j + k)];
                            bMaxCardCount = 5;
                            return CT_FIVE_STRAIGHT_FLUSH;
                        }
                    }
                    if (getCardValue(evColorList[i][0]) == 1 &&                      //检查A2345顺
                        getCardValue(evColorList[i][FindIndex(evColorList[i], evColorList[i].length - 2)]) <= 5) {
                        bMaxCardData[0] = evCardList[0][0];
                        bMaxCardData[1] = evCardList[0][evCardList.length - 1];
                        bMaxCardData[2] = evColorList[i][0];
                        for (var k = 1; k < 3; k++)
                            bMaxCardData[k + 2] = evColorList[i][FindIndex(evColorList[i], evColorList[i].length - k)];
                        bMaxCardCount = 5;
                        return CT_FIVE_STRAIGHT_FLUSH_FIRST_A;
                    }
                }
            }
        }
    }

    //寻找铁支
    if (bNeedCCount == 5) {
        for (var i = 14; i > 1; i--) {
            if (evCardList[i].length + evCardList[0].length >= 4) {
                ASSERT(evCardList[i].length <= 4 && evCardList[i].length >= 2);
                var j = 0;
                for (; j < 4 - evCardList[i].length; j++) {
                    bMaxCardData[j] = evCardList[0][FindIndex(evCardList[0], j)];
                }
                for (var k = 0; k < evCardList[i].length; k++)
                    bMaxCardData[j + k] = evCardList[i][FindIndex(evCardList[i], k)];
                bMaxCardCount = 4;
                return CT_FIVE_FOUR_ONE;
            }
        }
    }

    //寻找葫芦
    if (bNeedCCount == 5) {
        for (var i = 14; i > 1; i--) {
            if (evCardList[i].length + evCardList[0].length == 3) {
                ASSERT(evCardList[i].length <= 3 && evCardList[i].length >= 1);
                //寻找一对
                var bDoubleLogicCard = 0;
                for (var k = 2; k < 15; k++) {
                    if (k == i) continue;
                    if (evCardList[k].length >= 2) {
                        bDoubleLogicCard = k;
                        break;
                    }
                }
                if (bDoubleLogicCard == 0) break;

                var j = 0;
                for (; j < 3 - evCardList[i].length; j++) {
                    bMaxCardData[j] = evCardList[0][FindIndex(evCardList[0], j)];
                }
                for (var k = 0; k < evCardList[i].length; k++)
                    bMaxCardData[j + k] = evCardList[i][FindIndex(evCardList[i], k)];
                bMaxCardData[3] = evCardList[bDoubleLogicCard][FindIndex(evCardList[bDoubleLogicCard], 0)];
                bMaxCardData[4] = evCardList[bDoubleLogicCard][FindIndex(evCardList[bDoubleLogicCard], 1)];
                bMaxCardCount = 5;
                return CT_FIVE_THREE_DEOUBLE;
            }
        }
    }

    //寻找同花
    if (bNeedCCount == 5) {
        var bPossibleCard = CREATE_ARRAY(4); //各个能组成同花的牌组
        var maxCardColorList = [];
        for (var i = 0; i < 4; i++) {
            if (evColorList[i].length + evCardList[0].length >= 5) {
                if (evColorList[i].length >= 5) {
                    for (var k = 0; k < 5; k++)
                        bPossibleCard[i][k] = evColorList[i][FindIndex(evColorList[i], k)];
                }
                else {
                    var j = 0;
                    for (; j < 5 - evColorList[i].length; j++) {
                        bPossibleCard[i][j] = evCardList[0][FindIndex(evCardList[0], j)];
                    }
                    for (var k = 0; k < evColorList[i].length; k++)
                        bPossibleCard[i][j + k] = evColorList[i][FindIndex(evColorList[i], k)];
                }
                maxCardColorList.push(i);
            }
        }
        if (maxCardColorList.length != 0) {
            var bMax = maxCardColorList[FindIndex(maxCardColorList, 0)];
            for (var i = 1; i < maxCardColorList.length; i++) {
                var bColor = maxCardColorList[FindIndex(maxCardColorList, i)];
                if (compareCard(bPossibleCard[bMax], bPossibleCard[bColor], 5, 5, true) == enCRGreater)
                    bMax = bColor;
            }
            CopyMemory(bMaxCardData, bPossibleCard[bMax]);
            bMaxCardCount = 5;
            return CT_FIVE_FLUSH;
        }
    }

    //寻找顺子
    if (bNeedCCount == 5) {
        for (var i = 14; i > 4; i--) {
            var bHaveCard = [];
            for (var k = 0; k < 4; k++)
                bHaveCard[k] = (evCardList[i - k].length > 0);
            bHaveCard[4] = (((i == 5) ? evCardList[14].length : evCardList[i - 4].length) > 0);
            var bCount = (bHaveCard[0] ? 1 : 0) + (bHaveCard[1] ? 1 : 0) + (bHaveCard[2] ? 1 : 0) + (bHaveCard[3] ? 1 : 0) + (bHaveCard[4] ? 1 : 0);
            if (bCount + evCardList[0].length() >= 5) {
                ASSERT(bCount >= 3 && bCount <= 5);
                var j = 0;
                for (; j < 5 - bCount; j++) {
                    bMaxCardData[j] = evCardList[0][FindIndex(evCardList[0], j)];
                }
                for (var k = 0; k < 4; k++) {
                    if (bHaveCard[k])
                        bMaxCardData[j++] = evCardList[i - k][0];
                }

                var bFirstCardNum = ((i == 5) ? 14 : i - 4);
                if (bHaveCard[4])
                    bMaxCardData[4] = evCardList[bFirstCardNum][0];

                bMaxCardCount = 5;
                return ((i == 5) ? CT_FIVE_MIXED_FLUSH_FIRST_A : CT_FIVE_MIXED_FLUSH_NO_A);
            }
        }
    }

    //寻找三条
    for (var i = 14; i > 1; i--) {
        if (evCardList[i].length + evCardList[0].length == 3) {
            ASSERT(evCardList[i].length <= 3 && evCardList[i].length >= 1);

            var j = 0;
            for (; j < 3 - evCardList[i].length; j++) {
                bMaxCardData[j] = evCardList[0][FindIndex(evCardList[0], j)];
            }
            for (var k = 0; k < evCardList[i].length; k++)
                bMaxCardData[j + k] = evCardList[i][FindIndex(evCardList[i], k)];
            bMaxCardCount = 3;
            return CT_THREE;
        }
    }

    //寻找两对
    if (bNeedCCount == 5) {
        for (var i = 14; i > 1; i--) {
            if (evCardList[i].length() + evCardList[0].length() == 2) {
                ASSERT(evCardList[i].length() <= 2 && evCardList[i].length() >= 0);

                //寻找一对
                var bDoubleLogicCard = 0;
                for (var k = 2; k < 15; k++) {
                    if (k == i) continue;
                    if (evCardList[k].length() >= 2) {
                        bDoubleLogicCard = k;
                        break;
                    }
                }
                if (bDoubleLogicCard == 0) break;

                var j = 0;
                for (; j < 2 - evCardList[i].length(); j++) {
                    bMaxCardData[j] = evCardList[0][FindIndex(evCardList[0], j)];
                }
                for (var k = 0; k < evCardList[i].length; k++)
                    bMaxCardData[j + k] = evCardList[i][FindIndex(evCardList[i], k)];

                bMaxCardData[2] = evCardList[bDoubleLogicCard][FindIndex(evCardList[bDoubleLogicCard], 0)];
                bMaxCardData[3] = evCardList[bDoubleLogicCard][FindIndex(evCardList[bDoubleLogicCard], 1)];

                bMaxCardCount = 4;
                return CT_TWO_DOUBLE;
            }
        }
    }

    //寻找对子
    for (var i = 14; i > 1; i--) {
        if (evCardList[i].length + evCardList[0].length == 2) {
            ASSERT(evCardList[i].length <= 2 && evCardList[i].length >= 0);

            var j = 0;
            for (; j < 2 - evCardList[i].length(); j++) {
                bMaxCardData[j] = evCardList[0][FindIndex(evCardList[0], j)];
            }
            for (var k = 0; k < evCardList[i].length(); k++)
                bMaxCardData[j + k] = evCardList[i][FindIndex(evCardList[i], k)];

            bMaxCardCount = 2;
            return CT_ONE_DOUBLE;
        }
    }

    //寻找散牌
    for (var i = 14; i > 1; i--) {
        if (evCardList[i].length == 1) {
            bMaxCardCount = 1;
            bMaxCardData[0] = evCardList[i][0];
            return CT_SINGLE;
        }
    }

    return CT_INVALID;
}

//构造扑克
function makeCardData(cbValueIndex, cbColorIndex) {
    return (cbColorIndex << 4) | (cbValueIndex + 1);
}

//同牌搜索
function searchSameCard(cbHandCardData, cbHandCardCount, cbSameCardCount, pSearchCardResult) {
    //设置结果
    var cbResultCount = 0;

    //构造扑克
    var cbCardData = [];
    var cbCardCount = cbHandCardCount;
    CopyMemory(cbCardData, cbHandCardData);

    //排列扑克
    sortCardList(cbCardData, cbCardCount, enAscend);

    //分析扑克
    var AnalyseResult = struct_tagAnalyseResult();
    analysebCardData(cbCardData, cbCardCount, AnalyseResult);

    var cbBlockIndex = cbSameCardCount - 1;
    do {
        for (var i = 0; i < AnalyseResult.cbBlockCount[cbBlockIndex]; i++) {
            var cbIndex = (AnalyseResult.cbBlockCount[cbBlockIndex] - i - 1) * (cbBlockIndex + 1);

            //复制扑克
            CopyMemory(pSearchCardResult.cbResultCard[cbResultCount], AnalyseResult.cbCardData[cbBlockIndex], 0, cbIndex, cbSameCardCount);
            pSearchCardResult.cbCardCount[cbResultCount] = cbSameCardCount;
            cbResultCount++;
        }
        cbBlockIndex++;
    } while (cbBlockIndex < AnalyseResult.cbBlockCount.length);

    if (pSearchCardResult)
        pSearchCardResult.cbSearchCount = cbResultCount;
    return cbResultCount;
}

function searchTakeCardType(cbHandCardData, cbHandCardCount, cbSameCount, cbTakeCardCount, pSearchCardResult) {
    var cbResultCount = 0;

    //效验
    ASSERT(cbSameCount == 3 || cbSameCount == 4);
    ASSERT(cbTakeCardCount == 2 || cbTakeCardCount == 1);
    if (cbSameCount != 3 && cbSameCount != 4)
        return cbResultCount;
    if (cbTakeCardCount != 2 && cbTakeCardCount != 1)
        return cbResultCount;
    if (cbHandCardCount < cbSameCount + cbTakeCardCount)
        return cbResultCount;

    //搜索同牌
    var SameCardResult = struct_tagSearchCardResult();
    var cbSameCardResultCount = searchSameCard(cbHandCardData, cbHandCardCount, cbSameCount, SameCardResult);

    if (cbSameCardResultCount > 0) {
        //搜索带牌
        var TakeCardResult = struct_tagSearchCardResult();
        var cbTakeCardResultCount = searchSameCard(cbHandCardData, cbHandCardCount, cbTakeCardCount, TakeCardResult);

        //可以组成带牌
        if (cbTakeCardResultCount > 0) {
            for (var i = 0; i < cbSameCardResultCount; i++) {
                for (var j = 0; j < cbTakeCardResultCount; j++) {
                    //搜索三条： AAA
                    //搜索一对：AA 33 66 99
                    //忽略组合：AAAAA、
                    //保留组合：AAA33，AAA66，AAA99
                    if (getCardLogicValue(SameCardResult.cbResultCard[i][0]) == getCardLogicValue(TakeCardResult.cbResultCard[j][0]))
                        continue;

                    //复制扑克
                    pSearchCardResult.cbCardCount[cbResultCount] = cbSameCount + cbTakeCardCount;
                    CopyMemory(pSearchCardResult.cbResultCard[cbResultCount], SameCardResult.cbResultCard[i], 0, 0, cbSameCount);
                    CopyMemory(pSearchCardResult.cbResultCard[cbResultCount], TakeCardResult.cbResultCard[j], cbSameCount, 0, cbTakeCardCount);
                    cbResultCount++;
                }
            }
        }
    }

    if (pSearchCardResult)
        pSearchCardResult.cbSearchCount = cbResultCount;
    return cbResultCount;
}

//搜索同花
function searchSameColorType(cbHandCardData, cbHandCardCount, cbSameCount, pSearchCardResult) {
    var cbResultCount = 0;

    //复制扑克
    var cbCardData = [];
    CopyMemory(cbCardData, cbHandCardData);
    sortCardList(cbCardData, cbHandCardCount, enAscend);

    //同花变量
    var cbSameCardCount = [0, 0, 0, 0, 0];
    var cbSameCardData = CREATE_ARRAY(5);

    //统计同花
    for (var i = 0; i < cbHandCardCount; i++) {
        //获取牌色
        var cbCardColor = getCardColor(cbCardData[i]);

        //原牌数目
        var cbCount = cbSameCardCount[cbCardColor];

        //追加扑克
        cbSameCardData[cbCardColor][cbCount] = cbCardData[i];
        cbSameCardCount[cbCardColor]++;
    }

    //判断是否满cbSameCount
    for (var i = 0; i < 4; i++) {
        if (cbSameCardCount[i] >= cbSameCount) {
            for (var j = 0; j <= (cbSameCardCount[i] - cbSameCount); j++) {
                pSearchCardResult.cbCardCount[cbResultCount] = cbSameCount;
                CopyMemory(pSearchCardResult.cbResultCard[cbResultCount], cbSameCardData[i], 0, j, cbSameCount);
                cbResultCount++;
            }
        }
    }



    if (pSearchCardResult)
        pSearchCardResult.cbSearchCount = cbResultCount;

    return pSearchCardResult.cbSearchCount;
}

function isInArray(arr, v) {
    if (!arr || arr.length == 0) {
        return false;
    }
    for (var i = 0; i < arr.length; ++i) {
        if (arr[i] == v) {
            return true;
        }
    }
    return false;
}

function searchLineCardType(cbHandCardData, cbHandCardCount, cbLineCount, pSearchCardResult) {
    //定义变量
    var cbResultCount = 0;
    var cbBlockCount = 1;

    //超过A
    if (cbLineCount > 14) return cbResultCount;

    //长度判断
    if (cbHandCardCount < cbLineCount) return cbResultCount;

    //构造扑克
    var cbCardData = [];
    var cbCardCount = cbHandCardCount;
    CopyMemory(cbCardData, cbHandCardData);

    //排列扑克
    sortCardList(cbCardData, cbCardCount, enAscend);

    //分析扑克
    var Distributing = struct_tagDistributing();
    analysebDistributing(cbCardData, cbCardCount, Distributing);

    //搜索顺子
    var cbTmpLinkCount = 0;
    for (var cbValueIndex = 0; cbValueIndex < 13; cbValueIndex++) {
        //继续判断
        if (Distributing.cbDistributing[cbValueIndex][cbIndexCount] < cbBlockCount) {
            if (cbTmpLinkCount < cbLineCount) {
                cbTmpLinkCount = 0;
                continue;
            }
            else cbValueIndex--;
        }
        else {
            cbTmpLinkCount++;

            //寻找最长连
            if (cbLineCount == 0) continue;
        }

        if (cbTmpLinkCount >= cbLineCount) {
            if (pSearchCardResult == null) return 1;

            ASSERT(cbResultCount < pSearchCardResult.cbCardCount.length);

            //复制扑克
            var cbCount = 0;
            for (var cbIndex = cbValueIndex + 1 - cbTmpLinkCount; cbIndex <= cbValueIndex; cbIndex++) {
                var cbTmpCount = 0;
                for (var cbColorIndex = 0; cbColorIndex < 4; cbColorIndex++) {
                    for (var cbColorCount = 0; cbColorCount < Distributing.cbDistributing[cbIndex][3 - cbColorIndex]; cbColorCount++) {
                        var tmpCard = makeCardData(cbIndex, 3 - cbColorIndex);
                        if (isInArray(cbHandCardData, tmpCard)) {
                            pSearchCardResult.cbResultCard[cbResultCount][cbCount++] = tmpCard;
                        }else {
                            pSearchCardResult.cbResultCard[cbResultCount][cbCount++] = tmpCard + 0x100;
                        }
                        if(cbIndex ==cbValueIndex + 1 - cbTmpLinkCount){
                            if(Distributing.cbDistributing[cbIndex][3 - cbColorIndex]>0) Distributing.cbDistributing[cbIndex][3 - cbColorIndex]--;
                            if(Distributing.cbDistributing[cbIndex][cbIndexCount]>0)Distributing.cbDistributing[cbIndex][cbIndexCount]--;
                        }
                        if (++cbTmpCount == cbBlockCount) break;
                    }
                    if (cbTmpCount == cbBlockCount) break;
                }
            }

            //设置变量
            pSearchCardResult.cbCardCount[cbResultCount] = cbCount;
            cbResultCount++;
            cbValueIndex = 0;
            cbTmpLinkCount = 0;
            //cbTmpLinkCount--;
            //cbValueIndex=cbValueIndex + 1 - cbTmpLinkCount;
        }
    //特殊顺子
        if (cbTmpLinkCount >= cbLineCount - 1 && cbValueIndex == 12) {
            analysebDistributingA(cbCardData, cbCardCount, Distributing);
        if (Distributing.cbDistributing[0][cbIndexCount] >= cbBlockCount || cbTmpLinkCount >= cbLineCount) {
            if (pSearchCardResult == null) return 1;

            ASSERT(cbResultCount < pSearchCardResult.cbCardCount.length);

            //复制扑克
            var cbCount = 0;
            var cbTmpCount = 0;
            for (var cbIndex = cbValueIndex - cbTmpLinkCount; cbIndex < 13; cbIndex++) {
                cbTmpCount = 0;
                for (var cbColorIndex = 0; cbColorIndex < 4; cbColorIndex++) {
                    for (var cbColorCount = 0; cbColorCount < Distributing.cbDistributing[cbIndex][3 - cbColorIndex]; cbColorCount++) {
                        var tmpCard = makeCardData(cbIndex, 3 - cbColorIndex);
                        if (isInArray(cbHandCardData, tmpCard)) {
                            pSearchCardResult.cbResultCard[cbResultCount][cbCount++] = tmpCard;
                        }else {
                            pSearchCardResult.cbResultCard[cbResultCount][cbCount++] = tmpCard + 0x100;
                        }
                        if(cbIndex ==cbValueIndex + 1 - cbTmpLinkCount){
                            if(Distributing.cbDistributing[cbIndex][3 - cbColorIndex]>0) Distributing.cbDistributing[cbIndex][3 - cbColorIndex]--;
                            if(Distributing.cbDistributing[cbIndex][cbIndexCount]>0)Distributing.cbDistributing[cbIndex][cbIndexCount]--;
                        }
                        if (++cbTmpCount == cbBlockCount) break;
                    }
                    if (cbTmpCount == cbBlockCount) break;
                }
            }

            //复制A
            if (Distributing.cbDistributing[0][cbIndexCount] >= cbBlockCount) {
                cbTmpCount = 0;
                for (var cbColorIndex = 0; cbColorIndex < 4; cbColorIndex++) {
                    for (var cbColorCount = 0; cbColorCount < Distributing.cbDistributing[0][3 - cbColorIndex]; cbColorCount++) {
                        var tmpCard = makeCardData(0, 3 - cbColorIndex);
                        if (isInArray(cbHandCardData, tmpCard)) {
                            pSearchCardResult.cbResultCard[cbResultCount][cbCount++] = tmpCard;
                        }else {
                            pSearchCardResult.cbResultCard[cbResultCount][cbCount++] = tmpCard + 0x100;
                        }

                        if (++cbTmpCount == cbBlockCount) break;
                    }
                    if (cbTmpCount == cbBlockCount) break;
                }
            }

            //设置变量
            pSearchCardResult.cbCardCount[cbResultCount] = cbCount;
            cbResultCount++;
                cbValueIndex = 0;
                cbTmpLinkCount = 0;
            }
        }
    }

    if (pSearchCardResult)
        pSearchCardResult.cbSearchCount = cbResultCount;
    return cbResultCount;
}

//搜索同花顺
function searchSameColorLineType(cbHandCardData, cbHandCardCount, cbLineCount, pSearchCardResult) {
    var cbResultCount = 0;

    //长度判断
    if (cbHandCardCount < cbLineCount) return cbResultCount;

    //复制扑克
    var cbTmpCardData = [];
    CopyMemory(cbTmpCardData, cbHandCardData);
    sortCardList(cbTmpCardData, cbHandCardCount, enDescend);

    //同花变量
    var cbSameCardCount = [0, 0, 0, 0, 0];
    var cbSameCardData = CREATE_ARRAY(5);

    //统计同花
    for (var i = 0; i < cbHandCardCount; i++) {
        //获取牌色
        var cbCardColor = getCardColor(cbTmpCardData[i]);

        //原牌数目
        var cbCount = cbSameCardCount[cbCardColor];

        //追加扑克
        cbSameCardData[cbCardColor][cbCount] = cbTmpCardData[i];
        cbSameCardCount[cbCardColor]++;
    }

    for (var i = 0; i < cbSameCardCount.length; ++i) {
        if (cbSameCardCount[i] >= 5) {
            var tagTempResult = struct_tagSearchCardResult();
            var cbLineResultCount = searchLineCardType(cbSameCardData[i], cbSameCardCount[i], 5, tagTempResult);
            for (var j = 0; j < tagTempResult.cbSearchCount; ++j) {
                CopyMemory(pSearchCardResult.cbResultCard[cbResultCount], tagTempResult.cbResultCard[j]);
                pSearchCardResult.cbCardCount[cbResultCount] = 5;
                cbResultCount++;
            }
        }
    }

    if (pSearchCardResult)
        pSearchCardResult.cbSearchCount = cbResultCount;
    return cbResultCount;
}

/****************************************************
*函数名：CardTypeToWeights 
*功能：  用于将牌的类型转换成权值输出
*参数：     bType      牌类型 IN
*返回值：int(权值，本函数只对已有的牌型做出相应权值的换算)
****************************************************/
function cardTypeToWeights(bType, cbIndex) {
    switch (bType) {
        case CT_INVALID:                                               //错误类型
            {
                return -1;
            }
        case CT_SINGLE:                                                //单牌类型
            {
                return 0;
            }
        case CT_ONE_DOUBLE:                                             //只有一对
            {
                return 2;
            }
        case CT_TWO_DOUBLE:                                             //两对牌型
            {
                return 3;
            }
        case CT_THREE:                                                  //三张牌型
            {
                if (1 == cbIndex) {
                    return (4 + 3);
                }
                else {
                    return 4;
                }

            }
        case CT_FIVE_MIXED_FLUSH_FIRST_A:                               //A前顺子
            {
                return 5;
            }
        case CT_FIVE_MIXED_FLUSH_NO_A:                                  //普通顺子
            {
                return 6;
            }
        case CT_FIVE_MIXED_FLUSH_BACK_A:                                //A后顺子
            {
                return 7;
            }
        case CT_FIVE_FLUSH:                                             //同花
            {
                return 8;
            }
        case CT_FIVE_THREE_DEOUBLE:                                     //三条一对
            {
                return 9;
            }
        case CT_FIVE_FOUR_ONE:                                          //四带一张
            {
                if (2 == cbIndex) {
                    return (10 + 8);
                }
                if (3 == cbIndex) {
                    return (10 + 4);
                }
                else {
                    return 10;
                }

            }
        case CT_FIVE_STRAIGHT_FLUSH_FIRST_A:                            //A同花顺
            {
                if (2 == cbIndex) {
                    return (11 + 10);
                }
                if (3 == cbIndex) {
                    return (11 + 5);
                }
                else {
                    return 11;
                }
            }
        case CT_FIVE_STRAIGHT_FLUSH:                                    //同花顺牌
            {
                if (2 == cbIndex) {
                    return (12 + 10);
                }
                if (3 == cbIndex) {
                    return (12 + 5);
                }
                else {
                    return 12;
                }
            }
        case CT_FIVE:                                    //五同
            {
                return 30;
            }
        default:
            {
                return -1;
            }
    }
}

/****************************************************
*函数名：OptimizationCombo 
*功能：  对已经摆好的牌序列进行优化，让摆出的牌显得更合理
*参数：     bInFirstList       第一组牌数据  IN/OUT
*参数：     bInNextList        第二组牌数据  IN/OUT
*参数：     bFirstCount        第一组牌张数  IN
*参数：     bNextCount         第二组牌张数  IN
*返回值：无(本函数要保证第一组牌型大小不大于第二组牌型)
****************************************************/
function optimizationCombo(bInFirstList, bInNextList, bFirstCount, bNextCount) {
    console.log(bInFirstList, bInNextList, bFirstCount, bNextCount);
    if (bFirstCount <= bNextCount && (3 == bFirstCount || 5 == bFirstCount) && 5 == bNextCount) {

        //获取类型
        var cbMaxCard = 0;
        var bNextType = getCardType(bInNextList, bNextCount, cbMaxCard)[0];
        var bFirstType = getCardType(bInFirstList, bFirstCount, cbMaxCard)[0];
        var bFirstCard = [];
        var bNextCard = [];
        var iTemp1 = 0;
        var iTemp2 = 0;

        if (bFirstCount == bNextCount && enCRLess == compareCard(bInFirstList, bInNextList, 5, 5, true)) {
            CopyMemory(bFirstCard, bInFirstList);
            CopyMemory(bNextCard, bInNextList);
            CopyMemory(bInFirstList, bNextCard);
            CopyMemory(bInNextList, bFirstCard);
        }


        //牌型相同不进行优化
        if (bFirstType == bNextType) {
            return;
        }
        switch (bNextType) {
            case CT_INVALID:                                                //错误类型
            case CT_SINGLE:                                                 //单牌类型
            case CT_FIVE_MIXED_FLUSH_FIRST_A:                               //A前顺子
            case CT_FIVE_MIXED_FLUSH_NO_A:                                  //普通顺子
            case CT_FIVE_MIXED_FLUSH_BACK_A:                                //A后顺子
            case CT_FIVE_FLUSH:                                             //同花
            case CT_FIVE_STRAIGHT_FLUSH_FIRST_A:                            //A同花顺
            case CT_FIVE_STRAIGHT_FLUSH:                                    //同花顺牌
            case CT_FIVE:                                                   //五同
                {
                    //这些牌型无需优化直接返回
                    return;
                }
            case CT_ONE_DOUBLE:                                             //只有一对
            case CT_THREE:                                                  //三张牌型
            case CT_FIVE_FOUR_ONE:                                          //四带一张
                {
                    //对原有的对子(三张、四张)进行保存不允许修改
                    for (var i = 0; i < (bNextCount - 1); i++) {
                        if (getCardLogicValue(bInNextList[i]) == getCardLogicValue(bInNextList[i + 1])) {
                            iTemp1 = getCardLogicValue(bInNextList[i]);
                            break;
                        }
                    }

                    //对剩下的单牌进行置换，在不破坏牌型的情况下将大的单牌放在前面一注
                    for (var i = 0; i < bNextCount; i++) {
                        if (getCardLogicValue(bInNextList[i]) != iTemp1) {
                            for (var j = bFirstCount - 1; j >= 0; j--) {
                                if (getCardLogicValue(bInNextList[i]) > getCardLogicValue(bInFirstList[j])) {
                                    CopyMemory(bFirstCard, bInFirstList);
                                    CopyMemory(bNextCard, bInNextList);
                                    bFirstCard[j] = bInNextList[i];
                                    bNextCard[i] = bInFirstList[j];
                                    sortCardList(bFirstCard, bFirstCount, enDescend);
                                    sortCardList(bNextCard, bNextCount, enDescend);
                                    if (bFirstType == getCardType(bFirstCard, bFirstCount, cbMaxCard)[0] &&
                                        bNextType == getCardType(bNextCard, bNextCount, cbMaxCard)[0]) {
                                        CopyMemory(bInFirstList, bFirstCard);
                                        CopyMemory(bInNextList, bNextCard);
                                        i = -1;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    return;
                }
            case CT_TWO_DOUBLE:                                             //两对牌型
                {
                    //对原有的两个对子进行保存不允许修改
                    for (var i = 0; i < (bNextCount - 1); i++) {
                        if (getCardLogicValue(bInNextList[i]) == getCardLogicValue(bInNextList[i + 1])) {
                            iTemp1 = getCardLogicValue(bInNextList[i]);
                            break;
                        }
                    }
                    for (var i = bNextCount - 2; i >= 0; i--) {
                        if (getCardLogicValue(bInNextList[i]) == getCardLogicValue(bInNextList[i + 1])) {
                            iTemp2 = getCardLogicValue(bInNextList[i]);
                            break;
                        }
                    }

                    //对剩下的单牌进行置换，在不破坏牌型的情况下将大的单牌放在前面一注
                    for (var i = 0; i < bNextCount; i++) {
                        if (getCardLogicValue(bInNextList[i]) != iTemp1 && getCardLogicValue(bInNextList[i]) != iTemp2) {
                            for (var j = bFirstCount - 1; j >= 0; j--) {
                                if (getCardLogicValue(bInNextList[i]) > getCardLogicValue(bInFirstList[j])) {
                                    CopyMemory(bFirstCard, bInFirstList);
                                    CopyMemory(bNextCard, bInNextList);
                                    bFirstCard[j] = bInNextList[i];
                                    bNextCard[i] = bInFirstList[j];
                                    sortCardList(bFirstCard, bFirstCount, enDescend);
                                    sortCardList(bNextCard, bNextCount, enDescend);
                                    if (bFirstType == getCardType(bFirstCard, bFirstCount, cbMaxCard)[0] &&
                                        bNextType == getCardType(bNextCard, bNextCount, cbMaxCard)[0]) {
                                        CopyMemory(bInFirstList, bFirstCard);
                                        CopyMemory(bInNextList, bNextCard);
                                        i = -1;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    return;
                }
            case CT_FIVE_THREE_DEOUBLE:                                     //三条一对
                {
                    //找出对子
                    if (getCardLogicValue(bInNextList[1]) == getCardLogicValue(bInNextList[2])) {
                        iTemp1 = getCardLogicValue(bInNextList[3]);
                    }
                    else {
                        iTemp1 = getCardLogicValue(bInNextList[1]);
                    }
                    //对对子进行置换，在不破坏牌型的情况下将大的对子放在前面一注
                    for (var i = 0; i < bNextCount - 1; i++) {
                        if (getCardLogicValue(bInNextList[i]) == iTemp1) {
                            for (var j = bFirstCount - 2; j >= 0; j--) {
                                if (getCardLogicValue(bInNextList[i]) > getCardLogicValue(bInFirstList[j])) {
                                    CopyMemory(bFirstCard, bInFirstList);
                                    CopyMemory(bNextCard, bInNextList);

                                    bFirstCard[j] = bInNextList[i];
                                    bNextCard[i] = bInFirstList[j];
                                    bFirstCard[j + 1] = bInNextList[i + 1];
                                    bNextCard[i + 1] = bInFirstList[j + 1];

                                    sortCardList(bFirstCard, bFirstCount, enDescend);
                                    sortCardList(bNextCard, bNextCount, enDescend);
                                    if (bFirstType == getCardType(bFirstCard, bFirstCount, cbMaxCard)[0] &&
                                        bNextType == getCardType(bNextCard, bNextCount, cbMaxCard)[0]) {
                                        CopyMemory(bInFirstList, bFirstCard);
                                        CopyMemory(bInNextList, bNextCard);
                                        i = -1;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    return;
                }
            default:
                {
                    return;
                }
        }
    }
    return;
}



    function analyseMagicCards (cards) {
        var cardsArray = [];
        var colorArray = [];
        var maxCount = 0;
        var maxValue = 0;
        var magicCount = 0;
        for (var i = 0; i < cards.length; ++i) {
            var card = cards[i];
            var value = card & 0xf;
            if (!cardsArray[value]) {
                cardsArray[value] = [];
            }
            cardsArray[value].push(card);
            if (value < 14) {
                if (cardsArray[value].length > maxCount) {
                    maxCount = cardsArray[value].length;
                    maxValue = value;
                }else if (cardsArray[value].length == maxCount) {
                    var value1 = value;
                    var maxValue1 = maxValue;
                    if (value1 == 1) {
                        value1 = 20;
                    }
                    if (maxValue1 == 1) {
                        maxValue1 = 20;
                    }
                    if (value1 > maxValue1) {
                        maxValue = value;
                    }
                }
            }
            var color = (card & 0xf0) >> 4;
            if (!colorArray[color]) {
                colorArray[color] = [];
            }
            colorArray[color].push(card);
        }
        if (cardsArray[14]) {
            magicCount += cardsArray[14].length;
        }
        if (cardsArray[15]) {
            magicCount += cardsArray[15].length;
        }
        return {
            cardsArray: cardsArray,
            colorArray: colorArray,
            maxCount: maxCount,
            maxValue: maxValue,
            magicCount: magicCount
        }
    }

    function findBiggestShunZi(cardValues, magicCount) {
    if (cardValues.length + magicCount < 5) {
        return;
    }
    var arr = [];
    for (var i = 0; i < cardValues.length; ++i) {
        if ((cardValues[i] & 0xf) > 13) {
            continue;
        }
        arr[cardValues[i] & 0xf] = 1;
    }
    if (arr[1] == 1) {
        arr[14] = 1;
    }
    var cardValues = [];
    for (var i = 0; i < arr.length; ++i) {
        var value = arr.length - i - 1;
        if (arr[value] == 1) {
            cardValues.push(value);
        }
    }

    var magicCardArray = [];
    for (var i = 0; i < cardValues.length - 4 + magicCount; ++i) {
        var headCard = cardValues[i];
        if (headCard > 0) {
            var isShunZi = false;
            var remainMagic = magicCount;
            magicCardArray = [];
            for (var j = 1; j < 5; ++j) {
                var cardj = cardValues[i + j + (remainMagic - magicCount)];
                if (cardj != headCard - j) {
                    if (remainMagic > 0) {
                        magicCardArray[magicCount - remainMagic] = headCard - j;
                        --remainMagic;
                    } else {
                        break;
                    }
                }
                if (j == 4 - remainMagic) {
                    for (var i = 0; i < remainMagic; ++i) {
                        if (headCard < 14) {
                            ++headCard;
                            magicCardArray.push(headCard);
                        } else {
                            magicCardArray.push(14 - (5 - remainMagic + i));
                        }
                    }
                    if (headCard == 14) {
                        return { headCard: 1, magicCardArray: magicCardArray };
                    }else {
                    	//try a first shun zi
                    	var afMagicCardArray = [];
                    	var afRemainMagic = magicCount;
                    	var canMakeAFirstShunZi = true;
                    	for (var i = 0; i < 5; ++i) {
                    		if (!arr[i+1] || arr[i+1] <= 0) {
                    			if (afRemainMagic <= 0) {
                    				canMakeAFirstShunZi = false;
                    				break;
                    			}else {
                    				--afRemainMagic;
                    				afMagicCardArray.push(i+1);
                    			}
                    		}
                    	}
                    	if (canMakeAFirstShunZi) {
                    		return {headCard: 5, magicCardArray: afMagicCardArray};
                    	}
                    }
                    return { headCard: headCard, magicCardArray: magicCardArray };
                }
            }
        }
    }
}

    //赖子转化
    function convertMagicCards (cards, type) {
        var anlysResult = analyseMagicCards(cards);
        if (anlysResult.magicCount == 0) {
            return cards;
        }

        if (cards.length < 5) {
            var ret = [];
            for (var i = 0 ; i < cards.length; ++i) {
                var card = cards[i];
                if ((card&0xf) > 13) {
                    ret[i] = anlysResult.cardsArray[anlysResult.maxValue][0];
                }else {
                    ret[i] = card;
                }
            }
            return ret;
        }

        //转化为5同
        if (!type || type ==  CT_FIVE) {
            if (anlysResult.maxCount + anlysResult.magicCount >= 5) {
                var maxValue = 0;
                for (var i = 1; i < anlysResult.cardsArray.length; ++i) {
                    var cardsArray = anlysResult.cardsArray[anlysResult.cardsArray.length - i];
                    if (cardsArray && cardsArray.length + anlysResult.magicCount >= 5) {
                        maxValue = anlysResult.maxValue;
                        break;
                    }
                }
                if (maxValue > 0) {
                    var ret = [];
                    for (var i = 0 ; i < cards.length; ++i) {
                        var card = cards[i];
                        if ((card&0xf) > 13) {
                            ret[i] = anlysResult.cardsArray[maxValue][0];
                        }else {
                            ret[i] = card;
                        }
                    }
                    return ret;
                }
            }
        }
        

        //同花顺
        if (!type || type ==  CT_FIVE_STRAIGHT_FLUSH || type == CT_FIVE_STRAIGHT_FLUSH_FIRST_A) {
            var biggestShunZi = null;
            for (var i = 0; i < 4; ++i) {
                if (anlysResult.colorArray[i] && anlysResult.colorArray[i].length + anlysResult.magicCount >= 5) {
                    var shunzi = findBiggestShunZi(anlysResult.colorArray[i], anlysResult.magicCount);
                    if (shunzi) {
                        if (!biggestShunZi || shunzi.headCard > biggestShunZi.headCard) {
                            biggestShunZi = shunzi;
                            biggestShunZi.color = i;
                        }
                    }
                }
            }
            if (biggestShunZi) {
                var ret = [];
                var remainMagic = biggestShunZi.magicCardArray.length;
                for (var i = 0 ; i < cards.length; ++i) {
                    var card = cards[i];
                    if ((card & 0xf) > 13 && remainMagic > 0) {
                        var tmpValue = biggestShunZi.magicCardArray[biggestShunZi.magicCardArray.length - remainMagic];
                        if (tmpValue == 14) {
                            tmpValue = 1;
                        }
                        ret[i] = tmpValue | (biggestShunZi.color << 4);
                        --remainMagic;
                    }else {
                        ret[i] = card;
                    }
                }
                return ret;
            }
        }

        //铁支
        if (!type || type ==  CT_FIVE_FOUR_ONE) {
            if (anlysResult.maxCount + anlysResult.magicCount >= 4) {
                var ret = [];
                for (var i = 0 ; i < cards.length; ++i) {
                    var card = cards[i];
                    if ((card&0xf) > 13) {
                        ret[i] = anlysResult.cardsArray[anlysResult.maxValue][0];
                    }else {
                        ret[i] = card;
                    }
                }
                return ret;
            }
        }

        //葫芦
        if (!type || type ==  CT_FIVE_THREE_DEOUBLE) {
            if (anlysResult.maxCount + anlysResult.magicCount >= 3) {
                var ret = [];
                for (var i = 0 ; i < cards.length; ++i) {
                    var card = cards[i];
                    if ((card&0xf) > 13) {
                        ret[i] = anlysResult.cardsArray[anlysResult.maxValue][0];
                    }else {
                        ret[i] = card;
                    }
                }
                return ret;
            }
        }


        //同花
        if (!type || type ==  CT_FIVE_FLUSH) {
            var biggestValue = 0;
            var biggestCount = 0;
            var color = 0;
            for (var i = 0; i < 4; ++i) {
                if (anlysResult.colorArray[i] && anlysResult.colorArray[i].length + anlysResult.magicCount >= 5) {
                    var tmpAnlys = analyseMagicCards(anlysResult.colorArray[i], anlysResult.magicCardArray);
                    if (biggestCount == 0 || tmpAnlys.maxCount > biggestCount) {
                        biggestCount = tmpAnlys.maxCount;
                        biggestValue = tmpAnlys.maxValue;
                        color = i;
                    }else {
                        var v1 = biggestValue;
                        if (v1 == 1) {
                            v1 = 20;
                        }
                        var v2 = tmpAnlys.maxValue;
                        if (v2 == 1) {
                            v2 = 20;
                        }
                        if (v2 > v1) {
                            biggestValue = tmpAnlys.maxValue;
                            color = i;
                        }
                    }
                }
            }
            if (biggestValue > 0) {
                for (var i = 0; i < cards.length; ++i) {
                    var ret = [];
                    for (var i = 0 ; i < cards.length; ++i) {
                        var card = cards[i];
                        if ((card&0xf) > 13) {
                            ret[i] = biggestValue | (color << 4);
                        }else {
                            ret[i] = card;
                        }
                    }
                    return ret;
                }
            }
        }

        //顺子
        if (!type || type ==  CT_FIVE_MIXED_FLUSH_FIRST_A || type ==  CT_FIVE_MIXED_FLUSH_NO_A || type ==  CT_FIVE_MIXED_FLUSH_BACK_A) {
            var shunzi = findBiggestShunZi(cards, anlysResult.magicCount);
            if (shunzi) {
                var ret = [];
                var remainMagic = shunzi.magicCardArray.length;
                for (var i = 0 ; i < cards.length; ++i) {
                    var card = cards[i];
                     if ((card & 0xf) > 13 && remainMagic > 0) {
                         ret[i] = shunzi.magicCardArray[shunzi.magicCardArray.length - remainMagic];
                        --remainMagic;
                    }else {
                        ret[i] = card;
                    }
                }
                return ret;
            }
        }

        //对子或者三条
        if (!type || type ==  CT_ONE_DOUBLE || type == CT_THREE) {
            var ret = [];
            for (var i = 0 ; i < cards.length; ++i) {
                var card = cards[i];
                if ((card&0xf) > 13) {
                    ret[i] = anlysResult.cardsArray[anlysResult.maxValue][0];
                }else {
                    ret[i] = card;
                }
            }
            return ret;
        }
    }

    function findAllShunzi (cards, magicCount) {
        var ret = [];
        var tmpCards = cards.slice(0);
        for (var i = 0; i < 13; ++i) {
            var shunzi = findBiggestShunZi(tmpCards, magicCount);
            if (shunzi) {
                ret.push([shunzi.headCard, shunzi.magicCardArray.length]);
                tmpCards = removeShunziHead(tmpCards, shunzi.headCard);
            }else {
                break;
            }
        }
        return ret;
    }

    function removeShunziHead (cards, headCard) {
        var helpArr = [];
        var maxValue = 0;
        for (var i = 0; i < cards.length; ++i) {
            var value = (cards[i] & 0xf);
            if (!helpArr[value]) {
                helpArr[value] = 0;
            }
            ++helpArr[value];
            if (value > maxValue) {
                maxValue = value;
            }
        }
        helpArr[maxValue] = null;
        var ret = [];
        for (var k in helpArr) {
            if (k >= headCard) {
                break;
            }
            for (var i = 0; i < helpArr[k]; ++i) {
                ret.push(k);
            }
        }
        return ret;
    }

    function removeShunzi (cards, headCard, magicCount) {
        var helpCards = [];
        for (var i = 0; i < cards.length; ++i) {
            var value = (cards[i] & 0xf);
            if (!helpCards[value]) {
                helpCards[value] = 0;
            }
            ++helpCards[value];
        }
        for (var i = 0; i < 5; ++i) {
            if (!helpCards[headCard-i] || helpCards[headCard-i] == 0) {
                if (magicCount == 0) {
                    return;
                }else {
                    --magicCount;
                }
            }else{
                --helpCards[headCard-i];
            }
        }
        var ret = {magicCount: magicCount, cards: []};
        for (var k in helpCards) {
            for (var i = 0; i < helpCards[k]; ++i) {
                ret.cards.push(k);
            }
        }
        return ret;
    }

    function isContainShunzi3(cards, magicCount) {
        var helpArr = [];
        for (var i = 0; i < cards.length; ++i) {
            var value = cards[i] & 0xf;
            if (!helpArr[value]) {
                helpArr[value] = 0;
            }
            ++helpArr[value];
        }
        if (helpArr[1]) {
            helpArr[14] = helpArr[1];
        }
        for (var i = 1; i < 15; ++i) {
            var tmpCount = magicCount;
            for (var j = 0; j < 3; ++j) {
                var value = i+j;
                if (!(helpArr[value] > 0)) {
                    if (tmpCount <= 0) {
                        break;
                    }
                    --tmpCount;
                }
                if (j == 2) {
                    return true;
                }
            }
        }
        return false;
    }

    function getMagicSpecialType (cards) {
        if (!cards || cards.length < 13) {
            return false;
        }
        var anlysResult = analyseMagicCards(cards);

        for (var i = 0; i < anlysResult.colorArray.length; ++i) {
            if (anlysResult.colorArray[i] && anlysResult.colorArray[i].length + anlysResult.magicCount >= 13) {
                var magicCount = anlysResult.magicCount;
                var ar = analyseMagicCards(anlysResult.colorArray[i]);
                for (var j = 1; j < 14; ++j) {
                    var arcards = ar.cardsArray[j];
                    if (!arcards || arcards.length == 0) {
                        --magicCount;
                        if (magicCount < 0) {
                            break;
                        }
                    }
                }
                if (magicCount >= 0) {
                    return CT_EX_ZHIZUNQINGLONG;
                }
            }
        }

        var magicCount = anlysResult.magicCount;
        for (var i = 1; i < 14; ++i) {
            var arcards = anlysResult.cardsArray[i];
            if (!arcards || arcards.length == 0) {
                --magicCount;
                if (magicCount < 0) {
                    break;
                }
            }
        }
        if (magicCount >= 0) {
            return CT_EX_YITIAOLONG;
        }

        //六对半
        // var duiziCount = 0;
        // for (var i = 1; i < 14; ++i) {
        //     var arcards = anlysResult.cardsArray[i];
        //     if (arcards && arcards.length >= 2) {
        //         duiziCount += Math.floor(arcards.length / 2);
        //         if (duiziCount + anlysResult.magicCount >= 6) {
        //             return CT_EX_LIUDUIBAN;
        //         }
        //     }
        // }

        //三顺子
        // var magicCount = anlysResult.magicCount;
        // var helpArr = [];
        // for (var k in cards) {
        //     var value = (cards[k] & 0xf);
        //     if (value > 13) {
        //         continue;
        //     }
        //     if (!helpArr[value]) {
        //         helpArr[value] = 0;
        //     }
        //     ++helpArr[value];
        // }
        // var dealCards = [];
        // for (var k in helpArr) {
        //     for (var i = 0; i < helpArr[k]; ++i) {
        //         dealCards.push(k);
        //     }
        // }
        // var allShunzi = findAllShunzi(dealCards, magicCount);
        // if (allShunzi && allShunzi.length >= 2) {
        //     for (var i = 0; i < allShunzi.length; ++i) {
        //         var shunzi = allShunzi[i];
        //         var res = removeShunzi(dealCards, shunzi[0], magicCount);
        //         if (res) {
        //             var tmpCards = res.cards;
        //             var tmpMagicCount = res.magicCount;
        //             var allShunzi1 = findAllShunzi(tmpCards, tmpMagicCount);
        //             for (var j = 0; j < allShunzi1.length; ++j) {
        //                 var shunzi1 = allShunzi1[j];
        //                 var res1 = removeShunzi(tmpCards, shunzi1[0], tmpMagicCount);
        //                 if (res1) {
        //                     var tmpCards1 = res1.cards;
        //                     var tmpMagicCount1 = res1.magicCount;
        //                     if (isContainShunzi3(tmpCards1, tmpMagicCount1)) {
        //                         return CT_EX_SANSHUNZI;
        //                     }
        //                 }else{
        //                     break;
        //                 }
        //             }
        //         }else {
        //             break;
        //         }
        //     }
        // }

        //三同花
        // var magicCount = anlysResult.magicCount;
        // var helpArr = [0,0,0,0];
        // var tongHuaCount = 0;
        // for (var i = 0; i < 4; ++i) {
        //     var arcards = anlysResult.colorArray[i];
        //     if (!arcards) {
        //         continue;
        //     }
        //     helpArr[i] = arcards.length;
        //     for (var j = 0; j < 10; ++j) {
        //         if (helpArr[i] >= 5) {
        //             helpArr[i] -= 5;
        //             ++tongHuaCount;
        //         }else{
        //             break;
        //         }
        //     }
        // }

        // if (tongHuaCount >= 3) {
        //     return CT_EX_SANTONGHUA;
        // }

        // helpArr.sort(function (a, b) {
        //     return parseInt(a) < parseInt(b);
        // })

        // for (var i = 0; i < 4; ++i) {
        //     if (tongHuaCount >= 2) {
        //         magicCount -= (3 - helpArr[i]);
        //         if (magicCount >= 0) {
        //             return CT_EX_SANTONGHUA;
        //         }
        //     }else {
        //         if (helpArr[i] > 0) {
        //             magicCount -= (5 - helpArr[i]);
        //             if (magicCount < 0) {
        //                 break;
        //             }
        //         }
        //         ++tongHuaCount;
        //     }
        // }
        return CT_EX_INVALID;
    }
// 形参 1.中道或者尾道, 2 5张牌，3.明牌
//替换后的牌类型  返回一个数组，数组的第一个元素是牌数组，
//后一个是数字型用于判断是否使用明牌(2,3代表已使用，一家使用后，可终止明牌置换, 但是还需要继续判断A5678 变牌)

 var CT_TYPE_INVALID=0;
 var CT_TYPE_NORMAL=1;
 var CT_TYPE_ZD=2;
 var CT_TYPE_THS=3;
 
 function is4AType(bHandCardData, bCardCount){
      ASSERT(bCardCount == 5);
                 if (bCardCount != 5)
                   return [];

                 let IsContinue=false;
               sortCardList(bHandCardData, bCardCount, enDescend); 
              if(getCardLogicValue(bHandCardData[4])==4) //此玩法只适合3个人 A5678 可以变牌
                   IsContinue=true;

        return IsContinue;
}
 function replace4ForA(bHandCardData, bCardCount){
       ASSERT(bCardCount == 5);
        switch(getCardColor(bHandCardData[4]))
        {
            case 0: 
                bHandCardData[4]=0x01;
                sortCardList(bHandCardData, bCardCount, enDescend); 
                break;
            case 1: 
                bHandCardData[4]=0x11;
                sortCardList(bHandCardData, bCardCount, enDescend); 
                break;
            case 2: 
                bHandCardData[4]=0x21;
                sortCardList(bHandCardData, bCardCount, enDescend); 
                break;
            case 3: 
                bHandCardData[4]=0x31;
                sortCardList(bHandCardData, bCardCount, enDescend); 
                break;
    
            default: break;
        }
    return bHandCardData; 
}

function isA4Type(bHandCardOrigin, bCardCount,dangCard){
    ASSERT(bCardCount == 5);
               if (bCardCount != 5)
                 return [];
           var bHandCardData=[];
           CopyMemory(bHandCardData,bHandCardOrigin);
               let IsContinue=false;
             sortCardList(bHandCardOrigin,bCardCount,enDescend);
             sortCardList(bHandCardData, bCardCount, enDescend); 
  
            
  
            if(14==getCardLogicValue(bHandCardData[0]) && getCardLogicValue(bHandCardData[1])==8){ //此玩法只适合3个人 A5678 可以变牌
                  IsContinue=true;
                         for(let i=1;i<4;i++){
                           if(1!=getCardLogicValue(bHandCardData[i])-getCardLogicValue(bHandCardData[i+1])){
                                  IsContinue=false;
                                break;
                              }
                          }
  
                      }
          
  
                      var originSameColor=0;
                      var colorDifIndex=[];
                       var sameColorCard=[];
  
  
                      for(let i=0;i<bHandCardData.length;i++){
                          if(getCardColor(bHandCardData[i])==getCardColor(dangCard)){
                              originSameColor++;
                              sameColorCard.push(bHandCardData[i]);
                          } else {
                               colorDifIndex.push(i);
                          }
                      }
  
           
          if(!IsContinue&&getCardLogicValue(dangCard)==14){
                 
              if(originSameColor>=4 && getCardLogicValue(dangCard)==14){
                  let tempCard=0;
                  switch(getCardColor(dangCard))
                        {
                             case 0: 
                                    tempCard=0x04;
                                     break;
                             case 1: 
                                    tempCard=0x14;
                                     break;
                             case 2: 
                                    tempCard=0x24;
                                     break;
                             case 3: 
                                     tempCard=0x34;
                                     break;             
                         }
                 
                   if(sameColorCard.length==4){
                       if(isLinkCard(sameColorCard,4)){
                            sameColorCard.push(tempCard);
  
                            if(isLinkCard(sameColorCard,5)){
                                return true;
                            }else{
                             sameColorCard.pop();
                            }
                       }
                   }
  
                   if(sameColorCard.length==5){
                       sameColorCard.push(tempCard);
                      if(isLinkCard(sameColorCard.slice(1),5)){
  
                           return true;
                      }else{
                          sameColorCard.pop();
                      }
                   }
             }
  
           }
           if(!IsContinue&&(getCardLogicValue(dangCard)<9)){
                if(14==getCardLogicValue(bHandCardData[0]) && (getCardColor(bHandCardData[0])==getCardColor(dangCard)||getCardColor(bHandCardData[1])==getCardColor(dangCard))){ //此玩法只适合3个人 A5678 可以变牌
                      IsContinue=false;
                  
                     
                      if(originSameColor==5 && isLinkCard(bHandCardData,5)){
                                 return false;
                      } 
  
                      if(originSameColor>=4){
                         
                          if(14==getCardLogicValue(bHandCardData[1])&& getCardColor(bHandCardData[1])==getCardColor(dangCard)){
  
                              var temp1=bHandCardData[0];
                              bHandCardData[0]=bHandCardData[1];
                              bHandCardData[1]=temp1;
  
                              bHandCardOrigin[0]=bHandCardOrigin[1];
                              bHandCardOrigin[1]=temp1;
                          }
  
                          replaceAFor4(bHandCardData,5);
                          let dangArr=findReplaceIndex(0,0,bHandCardData,5,dangCard);
                          if(dangArr[2]==5)
                            IsContinue=true;
                      }
                  }
          }
      //console.log(bHandCardOrigin);
      return IsContinue;
  }
  


function replaceAFor4WithoutA(bHandCardData, bCardCount,dangCard){
  
       ASSERT(bCardCount == 5);   
          var originSameColor=0;
          var colorDifIndex=[];

          for(let i=0;i<bHandCardData.length;i++){
              if(getCardColor(bHandCardData[i])==getCardColor(dangCard)){
                  originSameColor++;
              }

              else{
                  colorDifIndex.push(i);
              }
          }
     
      let  tempCard=0;
      switch(getCardColor(dangCard))
         {
              case 0: 
                      tempCard=0x04;
                      break;
              case 1: 
                      tempCard=0x14;
                      break;
              case 2: 
                       tempCard=0x24; 
                      break;
              case 3: 
                       tempCard=0x34;
                      break;
          
          }

           let  discardCard=0;

          if(originSameColor==4){
              discardCard=bHandCardData[colorDifIndex[0]]; 
              bHandCardData[colorDifIndex[0]]=tempCard;
              sortCardList(bHandCardData,5,enDescend);
              return [bHandCardData,discardCard];

          }
          if(originSameColor==5){
              
              bHandCardData.push(tempCard);
              sortCardList(bHandCardData,6,enDescend);
              discardCard=bHandCardData[0];
              let arr=bHandCardData.slice(1);
              return [arr,discardCard];
          }                          
                   
}



function replaceAFor4(bHandCardData, bCardCount){
    
         ASSERT(bCardCount == 5);   
        switch(getCardColor(bHandCardData[0]))
           {
                case 0: 
                        bHandCardData[0]=0x04;
                        sortCardList(bHandCardData, bCardCount, enDescend); 
                        break;
                case 1: 
                        bHandCardData[0]=0x14;
                        sortCardList(bHandCardData, bCardCount, enDescend); 
                        break;
                case 2: 
                        bHandCardData[0]=0x24;
                        sortCardList(bHandCardData, bCardCount, enDescend); 
                        break;
                case 3: 
                        bHandCardData[0]=0x34;
                        sortCardList(bHandCardData, bCardCount, enDescend); 
                        break;
    
                    default: break;                       
            }                            
                     
       return bHandCardData; 
}


function findReplaceIndex(playerIndex,segmentIndex,bHandCardOrigin,bCardCount, Card) {
    ASSERT(bCardCount == 5);
     if (bCardCount != 5)
    return [6,6,0,0];

   // var bHandCardData= replaceForA4(bHandCardOrigin,bCardCount)
    var bHandCardData=[];
    var bCardData=[];
    CopyMemory(bHandCardData,bHandCardOrigin);
    


    var originSameColor=0;
    var colorDifIndex=[];
    for(let i=0;i<bHandCardData.length;i++){
        if(getCardColor(bHandCardData[i])==getCardColor(Card))
            originSameColor++;
        else
            colorDifIndex.push(i);
    }

    if(originSameColor==4 && colorDifIndex.length==1){
         
        var replacedCard=bHandCardData[colorDifIndex[0]];
         bHandCardData[colorDifIndex[0]]=Card;
         
         sortCardList(bHandCardData, 5, enDescend);
         if(isLinkCard(bHandCardData,5)){

            return [playerIndex,segmentIndex,5,getCardLogicValue(bHandCardData[0]),replacedCard];
         }
    }
        
    
    CopyMemory(bCardData,bHandCardOrigin);
    var AnalyseData = struct_tagAnalyseData();
    analyseCard(bCardData, bCardCount, AnalyseData);
    //分析扑克
    var AnalyseResult = struct_tagAnalyseResult();
    analysebCardData(bCardData, bCardCount, AnalyseResult);

   if(AnalyseData.bSameColor){
               if(getCardColor(bCardData[0])==getCardColor(Card)){
                       if(isLinkCard(bCardData,5)){
                            if(getCardLogicValue(bCardData[0])==getCardLogicValue(Card)-1){
                                var replacedCard=bCardData[4];
                                bCardData[4]=Card;
                                sortCardList(bCardData, bCardCount, enDescend);  
                                return [playerIndex,segmentIndex,5,getCardLogicValue(bCardData[0]),replacedCard];
                                }
                                else{

                                    return [playerIndex,segmentIndex,0,0,0];// 即使原来的牌型是同花顺，但是没有使用明牌，依然返回CT_TYPE_NORMAL
                                }
                        }else{
                             bCardData.push(Card);
                             sortCardList(bCardData,6,enDescend);
                                if(isLinkCard(bCardData,6)){
                                    var replacedCard=bCardData[5];                                    
                                    bCardData.pop();
                                    sortCardList(bCardData, bCardCount, enDescend);  
                                    return [playerIndex,segmentIndex,5,getCardLogicValue(bCardData[0]),replacedCard];
                                }else{
                                        if(isLinkCard(bCardData.slice(0,5),5)){
                                            return [playerIndex,segmentIndex,5,getCardLogicValue(bCardData[0]),bCardData[5]];
                                            }
                                        if(isLinkCard(bCardData.slice(1),5)) {
                                                return [playerIndex,segmentIndex,5,getCardLogicValue(bCardData[1]),bCardData[0]];
                                        }
                                        return [playerIndex,segmentIndex,0,0,0];
                                    }
                            }
                }
      return [playerIndex,segmentIndex,0,0,0];
   }else{
                if(AnalyseData.bThreeCount==1){
                    if(getCardLogicValue(bCardData[AnalyseData.bThreeFirst[0]])==getCardLogicValue(Card)){
                                var replacedCard=0;
                                if(AnalyseData.bThreeFirst[0]==2){     //三张牌 排在尾部
                                    replacedCard=bCardData[1];
                                    bCardData[1]=Card;
                                }
                                else{
                                    replacedCard=bCardData[4];
                                    bCardData[4]=Card;
                                }
                                sortCardList(bCardData, bCardCount, enDescend);
                                return [playerIndex,segmentIndex,4,3,replacedCard];  //三个人的玩法没有2,3,4
                        }
                        else{  
                               return [playerIndex,segmentIndex,0,0,0];
                            }
                }
               else{ 
                   return [playerIndex,segmentIndex,0,0,0];
                }
    }
}

function replaceForBigCard(bHandCardOrigin, bCardCount, Card) {
        ASSERT(bCardCount == 5);
         if (bCardCount != 5)
        return [[], CT_TYPE_INVALID];
   
        var bHandCardData= replaceAFor4(bHandCardOrigin,bCardCount)
        var bCardData=[];
        CopyMemory(bCardData,bHandCardData);
        var AnalyseData = struct_tagAnalyseData();
        analyseCard(bCardData, bCardCount, AnalyseData);
        //分析扑克
        var AnalyseResult = struct_tagAnalyseResult();
        analysebCardData(bCardData, bCardCount, AnalyseResult);

       if(AnalyseData.bSameColor){
                   if(getCardColor(bCardData[0])==getCardColor(Card)){
                           if(isLinkCard(bCardData,5)){
                                if(getCardLogicValue(bCardData[0])==getCardLogicValue(Card)-1){
                                    bCardData[4]=Card;
                                    sortCardList(bCardData, bCardCount, enDescend);  
                                    return [bCardData,CT_TYPE_THS];
                                    }
                                    else{

                                        return [bCardData,CT_TYPE_NORMAL];// 即使原来的牌型是同花顺，但是没有使用明牌，依然返回CT_TYPE_NORMAL
                                    }
                            }else{
                                 bCardData.push(Card);
                                 sortCardList(bCardData,6,enDescend);
                                    if(isLinkCard(bCardData,6)){
                                        bCardData.pop();
                                        sortCardList(bCardData, bCardCount, enDescend);  
                                        return [bCardData,CT_TYPE_THS];
                                    }else{
                                            if(isLinkCard(bCardData.slice(0,5),5)){
                                                return [bCardData.slice(0,5),CT_TYPE_THS];
                                                }
                                            if(isLinkCard(bCardData.slice(1),5)) {
                                                    return [bCardData.slice(1),CT_TYPE_THS];
                                            }
                                            return [bHandCardData,CT_TYPE_NORMAL];
                                        }
                                }
                    }
          return [bHandCardData,CT_TYPE_NORMAL];
       }else{
                    if(AnalyseData.bThreeCount==1){
                        if(getCardLogicValue(bCardData[AnalyseData.bThreeFirst[0]])==getCardLogicValue(Card)){
                                    if(AnalyseData.bThreeFirst[0]==2){     //三张牌 排在尾部

                                        bCardData[1]=Card;
                                    }
                                    else{
                                        
                                        bCardData[4]=Card;
                                    }
                                    sortCardList(bCardData, bCardCount, enDescend);
                                    return [bCardData,CT_TYPE_ZD];
                            }
                            else{  
                                   return [bHandCardData,CT_TYPE_NORMAL];
                                }
                    }
                   else{ 
                       return [bHandCardData,CT_TYPE_NORMAL];
                    }
        }
}

exports.CT_SINGLE = CT_SINGLE;
exports.CT_ONE_DOUBLE = CT_ONE_DOUBLE;
exports.CT_TWO_DOUBLE = CT_TWO_DOUBLE;
exports.CT_THREE = CT_THREE;
exports.CT_FIVE_MIXED_FLUSH_FIRST_A = CT_FIVE_MIXED_FLUSH_FIRST_A;
exports.CT_FIVE_MIXED_FLUSH_NO_A = CT_FIVE_MIXED_FLUSH_NO_A;
exports.CT_FIVE_MIXED_FLUSH_BACK_A = CT_FIVE_MIXED_FLUSH_BACK_A;
exports.CT_FIVE_FLUSH = CT_FIVE_FLUSH;
exports.CT_FIVE_THREE_DEOUBLE = CT_FIVE_THREE_DEOUBLE;
exports.CT_FIVE_FOUR_ONE = CT_FIVE_FOUR_ONE;
exports.CT_FIVE_STRAIGHT_FLUSH_FIRST_A = CT_FIVE_STRAIGHT_FLUSH_FIRST_A;
exports.CT_FIVE_STRAIGHT_FLUSH = CT_FIVE_STRAIGHT_FLUSH;
exports.CT_FIVE = CT_FIVE;

exports.CT_EX_INVALID = CT_EX_INVALID;                       //非特殊牌
exports.CT_EX_SANTONGHUA = CT_EX_SANTONGHUA;                    //三同花
exports.CT_EX_SANSHUNZI = CT_EX_SANSHUNZI;                     //三顺子
exports.CT_EX_LIUDUIBAN = CT_EX_LIUDUIBAN;                     //六对半
exports.CT_EX_LIUDUIBAN_TIEZHI = CT_EX_LIUDUIBAN_TIEZHI;                     //六对半
exports.CT_EX_LIUDUIBAN_WUTONG = CT_EX_LIUDUIBAN_WUTONG;                     //六对半
exports.CT_EX_WUDUISANTIAO = CT_EX_WUDUISANTIAO;                  //五对三条
exports.CT_EX_SITAOSANTIAO = CT_EX_SITAOSANTIAO;                  //四套三条
exports.CT_EX_SHUANGGUAICHONGSAN = CT_EX_SHUANGGUAICHONGSAN;            //双怪冲三
exports.CT_EX_COUYISE = CT_EX_COUYISE;                       //凑一色
exports.CT_EX_QUANXIAO = CT_EX_QUANXIAO;                      //全小
exports.CT_EX_QUANDA = CT_EX_QUANDA;                        //全大
exports.CT_EX_SANFENGTIANXIA = CT_EX_SANFENGTIANXIA;                //三分天下
exports.CT_EX_SANTONGHUASHUN = CT_EX_SANTONGHUASHUN;                //三同花顺
exports.CT_EX_SHIERHUANGZU = CT_EX_SHIERHUANGZU;                  //十二皇族
exports.CT_EX_YITIAOLONG = CT_EX_YITIAOLONG;                    //一条龙
exports.CT_EX_ZHIZUNQINGLONG = CT_EX_ZHIZUNQINGLONG;                //至尊清龙
exports.CT_EX_SAN_HU_LU=CT_EX_SAN_HU_LU;
exports.CT_EX_QUAN_HEI_YIDIANHONG=CT_EX_QUAN_HEI_YIDIANHONG;                  //全黑一点红
exports.CT_EX_QUAN_HONG_YIDIANHEI=CT_EX_QUAN_HONG_YIDIANHEI;                  //全红一点黑
exports.CT_EX_QUAN_HEI=CT_EX_QUAN_HEI;                  //全黑
exports.CT_EX_QUAN_HONG=CT_EX_QUAN_HONG;                 //全红

exports.CT_EX_BANXIAO=CT_EX_BANXIAO;                   //半小
exports.CT_EX_BANDA=CT_EX_BANDA;                     //半大

exports.enDescend = enDescend;
exports.enAscend = enAscend;
exports.enColor = enColor;

exports.enCRLess = enCRLess;
exports.enCREqual = enCREqual;
exports.enCRGreater = enCRGreater;
exports.enCRError = enCRError;

exports.randCardList = randCardList;
exports.sortCardList = sortCardList;
exports.searchSameCard = searchSameCard;
exports.searchLineCardType = searchLineCardType;
exports.searchTakeCardType = searchTakeCardType;
exports.searchSameColorType = searchSameColorType;
exports.searchSameColorLineType = searchSameColorLineType;
exports.compareCard = compareCard;
exports.autoPutCard = autoPutCard;
exports.getCardType = getCardType;
exports.getSpecialType = getSpecialType;
exports.getCardLogicValue = getCardLogicValue;
exports.getCardColor=getCardColor;
exports.convertMagicCards = convertMagicCards;

exports.struct_tagSearchCardResult = struct_tagSearchCardResult;
exports.getMagicSpecialType = getMagicSpecialType;
exports.replaceForBigCard =replaceForBigCard;
exports.replaceAFor4=replaceAFor4;
exports.replace4ForA=replace4ForA;
exports.getAllSpecialType=getAllSpecialType;
exports.changeZhongWei=changeZhongWei;
exports.useDangPai=useDangPai;
exports.cancelDanPai=cancelDanPai;
exports.findReplaceIndex=findReplaceIndex;
exports.is4AType=is4AType;
exports.isA4Type=isA4Type;