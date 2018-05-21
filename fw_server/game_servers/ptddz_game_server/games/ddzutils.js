'use strict';
var _ = require('lodash');
var commonUtils = require('../commonUtils');

var compareTwoNumbers = function (a, b) {
    return a - b;
};

var deepCopy = function (source) {
    var result;
    if (_.isArray(source)) {
        result = [];
        for (var i = 0; i < source.length; i++)
            result.push(typeof source[i] === 'object' ? deepCopy(source[i]) : source[i])
    } else {
        result = {};
        for (var key in source) {
            if (source.hasOwnProperty(key))
                result[key] = typeof source[key] === 'object' ? deepCopy(source[key]) : source[key];
        }
    }
    return result;
};

//牌型
var CardType = {};
CardType.c1 = 0;//单牌
CardType.c2 = 1;//对子
CardType.c3 = 2;//3不带
CardType.c4 = 3;//炸弹
CardType.c31 = 4;//3带1
CardType.c32 = 5;//3带2
CardType.c411 = 6;//4带2个单，或者一对
CardType.c422 = 7;//4带2对
CardType.c123 = 8;//顺子
CardType.c1122 = 9;//连对
CardType.c111222 = 10;//飞机
CardType.c11122234 = 11;//飞机带单牌.
CardType.c1112223344 = 12;//飞机带对子.
CardType.c42 = 13; // 王炸
CardType.c0 = 14;//不能出牌

exports.CardType = CardType;


//可用牌型
var availableCardTypes = [];
availableCardTypes.push(CardType.c1);
availableCardTypes.push(CardType.c2);
availableCardTypes.push(CardType.c3);
availableCardTypes.push(CardType.c4);
availableCardTypes.push(CardType.c31);
availableCardTypes.push(CardType.c32);
availableCardTypes.push(CardType.c411);
availableCardTypes.push(CardType.c422);
availableCardTypes.push(CardType.c123);
availableCardTypes.push(CardType.c1122);
availableCardTypes.push(CardType.c111222);
availableCardTypes.push(CardType.c11122234);
availableCardTypes.push(CardType.c1112223344);
availableCardTypes.push(CardType.c42);

exports.availableCardTypes = availableCardTypes;


var Card = function (number) {
    var type = Math.floor(Math.floor(number / 13) + 0.5);
    var type1 = type + 1;
    var value = number - type * 13 + 1;
    var weight = value;
    if (type1 == 5)
        weight = value + 15;
    else if (value <= 2)
        weight = value + 13;

    var voice = weight - 3;
    return {
        type: type1,
        value: value,
        number: number,
        name: type + "_" + value,
        weight: weight,
        voice: voice,
        changeToNumber: number % 13,
        isLaizi: false
    };
};

var getValue = function (card) {
    var value = card.value;
    var i = value;
    if (value == 2)
        i += 13;
    if (value == 1)
        i += 13;
    if (card.type == 5)
        i += 2;// 是王
    return i;
};

var getMax = function (list) {
    var card_index = [];

    for (var i = 0; i < 4; i++)
        card_index[i] = [];

    var count = [];// 1-13各算一种,王算第14种
    for (var i = 0; i < 14; i++)
        count[i] = 0;

    for (var i = 0; i < list.length; i++) {
        if (list[i].type == 5) {
            count[13]++;
        } else {
            var v = list[i].value;
            if (v <= 2) {
                v += 13;
            }

            count[v - 3]++;
        }
    }

    for (var i = 0; i < 14; i++) {
        switch (count[i]) {
            case 1:
                card_index[0].push(i + 3);
                break;
            case 2:
                card_index[1].push(i + 3);
                break;
            case 3:
                card_index[2].push(i + 3);
                break;
            case 4:
                card_index[3].push(i + 3);
                break;
        }
    }

    return card_index;
};

var isSequenceArr = function (list) {
    var result = false;
    var count = list.length;
    if (count != 0) {
        var first = list[0];
        var last = list[count - 1];
        if (Math.abs(first - last) == count - 1 && (last < 15) && first < 15) {
            result = true;
        }
    }
    return result;
};

var checkPlane = function (cards) {

    var count = analyzeCards(cards);
    var len = cards.length;
    var threeList = [];
    var twoList = [];
    var oneList = [];

    for (var i = 0; i < count.length; i++) {
        if (count[i] == 3) {
            //add the weight to the list
            threeList.push(i);
        } else if (count[i] == 2) {
            twoList.push(i);
        } else if (count[i] == 1) {
            oneList.push(i);
        }
    }

    var size = threeList.length;
    var twosize = twoList.length;
    var onesize = oneList.length;

    if (size < 2) {
        return CardType.c0;
    }
    if (size >= 2 && size * 3 === len && isSequenceArr(threeList)) {
        return CardType.c111222;
    }
    if (size >= 2 && isSequenceArr(threeList) && size === twosize && len === size * 3 + twosize * 2) {
        return CardType.c1112223344
    }

    if (size >= 2) {
        var count = 0;
        for(var i=2; i<=size; i++){
            if(isSequenceArr(threeList.slice(0, i))){
                count = i;
                continue;
            }
            break;
        }
        if (count === (size-count)*3 + twosize*2 + onesize ) {
            return CardType.c11122234;
        }
    }

    return CardType.c0;
};

var checkPlaneWithLaizi = function (normalCards, laiziCards, cardsValue) {
    var resultTypes = [];
    var _availableCardTypes = [];
    var cardsLen = normalCards.length;
    var laiziLen = laiziCards.length;
    var totalLen = cardsLen + laiziLen;
    if (totalLen == 6 || totalLen == 9 || totalLen == 12 || totalLen == 15 || totalLen == 18) {
        _availableCardTypes.push(CardType.c111222);
    }
    if (totalLen == 8 || totalLen == 12 || totalLen == 16 || totalLen == 20) {
        _availableCardTypes.push(CardType.c11122234);
    }
    if (totalLen == 10 || totalLen == 15 || totalLen == 20) {
        _availableCardTypes.push(CardType.c1112223344);
    }
    if (_availableCardTypes.length == 0) {
        return resultTypes;
    }
    var count = analyzeCards(normalCards);
    var fourList = [];
    var threeList = [];
    var twoList = [];
    var oneList = [];
    var i, j, _temp_laizi_cards;
    for (i = 0; i < count.length; i++) {
        if (count[i] == 4) {
            fourList.push(i + 3);
        } else if (count[i] == 3) {
            threeList.push(i + 3);
        } else if (count[i] == 2) {
            twoList.push(i + 3);
        } else if (count[i] == 1) {
            oneList.push(i + 3);
        }
    }
    var first = cardsValue[0];
    if (_availableCardTypes.indexOf(CardType.c111222) >= 0) {
        if (laiziLen == 0) {
            if (threeList.length * 3 == totalLen && isSequenceArr(threeList)) {
                resultTypes.push(getResultObj(CardType.c111222, normalCards, laiziCards));
            }
        } else if (fourList.length == 0) {
            var begin = first - Math.floor(laiziLen / 3);
            for (i = begin >= 3 ? begin : 3; i < 15; i++) {
                if (count[i - 3] > 2) {
                    continue;
                }
                _temp_laizi_cards = deepCopy(laiziCards);
                var _temp_three_list = deepCopy(threeList);
                var _temp_count = deepCopy(count);
                var _changeIndex = -1;
                for (j = i; j < 15; j++) {
                    if (_temp_count[j - 3] < 3) {
                        while (_temp_count[j - 3] < 3) {
                            _changeIndex++;
                            if (_changeIndex >= laiziLen) {
                                break;
                            }
                            _temp_laizi_cards[_changeIndex].changeToNumber = (j - 1) % 13;
                            _temp_count[j - 3]++;
                        }
                        if (_temp_count[j - 3] == 3) {
                            _temp_three_list.push(j);
                        }
                    }
                    if (_temp_count[j - 3] < 3) {
                        break;
                    }
                }
                if (_temp_three_list.length * 3 == totalLen && isSequenceArr(_temp_three_list.sort(compareTwoNumbers))) {
                    resultTypes.push(getResultObj(CardType.c111222, normalCards, _temp_laizi_cards));
                    if (laiziLen == 0) {
                        break;
                    }
                }
            }
        }
    }
    if (_availableCardTypes.indexOf(CardType.c11122234) >= 0) {
        var planeLen = totalLen / 4;
        var begin = first - Math.floor(laiziLen / 3);
        var _pre_three_list = [];
        for (i = begin >= 3 ? begin : 3; i < 15; i++) {
            if (count[i - 3] > 2) {
                _pre_three_list.push(i);
                if (_pre_three_list.length == planeLen) {
                    resultTypes.push(getResultObj(CardType.c11122234, normalCards, laiziCards));
                    break;
                }
                continue;
            }
            _temp_laizi_cards = deepCopy(laiziCards);
            var _temp_three_list = deepCopy(_pre_three_list);
            _pre_three_list = [];
            var _temp_count = deepCopy(count);
            var _changeIndex = -1;
            for (j = i; j < 15; j++) {
                if (laiziLen - 1 - _changeIndex >= 3 - _temp_count[j - 3]) {
                    while (_temp_count[j - 3] < 3) {
                        _changeIndex++;
                        if (_changeIndex >= laiziLen) {
                            break;
                        }
                        _temp_laizi_cards[_changeIndex].changeToNumber = (j - 1) % 13;
                        _temp_count[j - 3]++;
                    }
                }
                if (_temp_count[j - 3] >= 3) {
                    _temp_three_list.push(j);
                } else {
                    break;
                }
            }
            if (_temp_three_list.length == planeLen && isSequenceArr(_temp_three_list.sort(compareTwoNumbers))) {
                resultTypes.push(getResultObj(CardType.c11122234, normalCards, _temp_laizi_cards));
            } else if (_temp_three_list.length == planeLen + 1) {
                _temp_three_list.sort(compareTwoNumbers);
                if (!(_temp_three_list.length * 3 == totalLen && isSequenceArr(_temp_three_list))) {
                    var _temp_three_list1 = deepCopy(_temp_three_list);
                    _temp_three_list1.splice(0, 1);
                    var _temp_three_list2 = deepCopy(_temp_three_list);
                    _temp_three_list2.splice(_temp_three_list2.length - 1, 1);
                    if (isSequenceArr(_temp_three_list1) || isSequenceArr(_temp_three_list2)) {
                        resultTypes.push(getResultObj(CardType.c11122234, normalCards, _temp_laizi_cards));
                    }
                }
            }
        }
    }
    if (_availableCardTypes.indexOf(CardType.c1112223344) >= 0) {
        var planeLen = totalLen / 5;
        var begin = first - Math.floor(laiziLen / 3);
        var _pre_three_list = [];
        for (i = begin >= 3 ? begin : 3; i < 15; i++) {
            if (count[i - 3] > 2) {
                _pre_three_list.push(i);
                if (_pre_three_list.length < planeLen) {
                    continue;
                }
            }
            _temp_laizi_cards = deepCopy(laiziCards);
            var _temp_three_list = deepCopy(_pre_three_list);
            _pre_three_list = [];
            var _temp_count = deepCopy(count);
            var _changeIndex = -1;
            var _single_list = oneList.concat(threeList);
            for (j = i; j < 15; j++) {
                if (_temp_three_list.length == planeLen) {
                    break;
                }
                while (_temp_count[j - 3] < 3) {
                    _changeIndex++;
                    if (_changeIndex >= laiziLen) {
                        break;
                    }
                    _temp_laizi_cards[_changeIndex].changeToNumber = (j - 1) % 13;
                    _temp_count[j - 3]++;
                }
                if (_temp_count[j - 3] >= 3) {
                    _temp_three_list.push(j);
                } else {
                    break;
                }
            }
            if (_temp_three_list.length == planeLen && isSequenceArr(_temp_three_list.sort(compareTwoNumbers))) {
                for (j = 0; j < _temp_three_list.length; j++) {
                    if (count[_temp_three_list[j] - 3] == 1 || count[_temp_three_list[j] - 3] == 3) {
                        _single_list.splice(_single_list.indexOf(_temp_three_list[j]), 1);
                    } else if (count[_temp_three_list[j] - 3] == 4) {
                        _single_list.push(_temp_three_list[j]);
                    }
                }
                for (j = 0; j < _single_list.length; j++) {
                    _changeIndex++;
                    if (_changeIndex >= laiziLen) {
                        break;
                    }
                    _temp_laizi_cards[_changeIndex].changeToNumber = (_single_list[j] - 1) % 13;
                }
                if (_changeIndex < laiziLen) {
                    while (_changeIndex < laiziLen - 1) {
                        _changeIndex++;
                        _temp_laizi_cards[_changeIndex].changeToNumber = laiziCards[laiziLen - 1].number % 13;
                    }
                    resultTypes.push(getResultObj(CardType.c1112223344, normalCards, _temp_laizi_cards));
                }
            }
        }
    }
    return resultTypes;
};

var judgeType = function (list) {
    if (list && list.length > 0 && _.isNumber(list[0]))
        list = toCardsArr(list);
    list.sort(function (a, b) {
        return a.weight - b.weight
    });
    var len = list.length;
    if (len == 0) {
        return CardType.c0;
    }
    var cardsValue = [];

    var valueStr = '';

    for (var i = 0; i < len; i++) {
        valueStr += getValue(list[i])+','
        cardsValue.push(getValue(list[i]));
    }

    var first = cardsValue[0];
    var last = cardsValue[len - 1];
    if (len <= 4) {
        if (first == last) {
            if (len == 1) {
                return CardType.c1;
            } else if (len == 2) {
                return CardType.c2;
            } else if (len == 3) {
                return CardType.c3;
            } else {
                return CardType.c4;
            }
        } else {
            if (len == 2 && first > 15 && last > 15) {
                return CardType.c42;
            } else if (len == 4) {
                var second = cardsValue[1];
                var third = cardsValue[2];
                if (second == third && (first == second || third == last)) {
                    return CardType.c31;
                } else {
                    return CardType.c0;
                }
            }
        }
    } else {
        if (first == last) {
            return CardType.c4;
        }
        var ci = getMax(list);

        var arr0 = ci[0] || [];
        var arr1 = ci[1] || [];
        var arr2 = ci[2] || [];
        var arr3 = ci[3] || [];

        // 链子
        if (arr0.length == len && isSequenceArr(arr0)) {
            return CardType.c123;
        }

        // 连对
        if (arr1.length * 2 == len && isSequenceArr(arr1)) {
            return CardType.c1122;
        }

        // 3带一对
        if (arr2.length == 1 && len == 5 && arr1.length == 1) {
            return CardType.c32;
        }

        // 4带2
        if (arr3.length == 1 && len == 6) {
            return CardType.c411;
        }

        // 4带2对
        if (arr3.length == 1 && arr1.length == 2 && len == 8 || arr3.length == 2) {
            return CardType.c422;
        }

        // 分析飞机
        if (len >= 6) {
            return checkPlane(list);
        }
    }
    return CardType.c0;
};

exports.judgeType = judgeType;


var judgeTypeWithLaizi = function (normalCards, laiziCards) {
    if (normalCards && normalCards.length > 0 && _.isNumber(normalCards[0]))
        normalCards = toCardsArr(normalCards);
    if (laiziCards && laiziCards.length > 0 && _.isNumber(laiziCards[0]))
        laiziCards = toCardsArr(laiziCards);

    var cardsLen = normalCards.length;
    var laiziLen = laiziCards.length;
    var cardsValue = [];
    var i;
    var j;
    for (i = 0; i < cardsLen; i++) {
        cardsValue.push(getValue(normalCards[i]));
    }
    var laiziValue = [];
    for (i = 0; i < laiziLen; i++) {
        laiziValue.push(getValue(laiziCards[i]));
    }
    var resultTypes = [];
    var _temp_laizi_cards = null;
    if (cardsLen == 0) {
        if (laiziLen == 0) {
            resultTypes.push(getResultObj(CardType.c0, normalCards, laiziCards));
        } else if (laiziLen == 1) {
            resultTypes.push(getResultObj(CardType.c1, normalCards, laiziCards));
        } else if (laiziLen == 2) {
            if (laiziValue[0] == laiziValue[1]) {
                resultTypes.push(getResultObj(CardType.c2, normalCards, laiziCards));
            }
        } else if (laiziLen == 3) {
            if (laiziValue[0] == laiziValue[2]) {
                resultTypes.push(getResultObj(CardType.c3, normalCards, laiziCards));
            }
        } else {
            _temp_laizi_cards = deepCopy(laiziCards);
            for (i = 1; i < _temp_laizi_cards.length; i++) {
                _temp_laizi_cards[i].changeToNumber = _temp_laizi_cards[0].number % 13;
            }
            resultTypes.push(getResultObj(CardType.c4, normalCards, _temp_laizi_cards));
            if (laiziLen == 4 && laiziValue[0] != laiziValue[laiziLen - 1]) {
                if (laiziValue[0] == laiziValue[2] || laiziValue[1] == laiziValue[3]) {
                    resultTypes.push(getResultObj(CardType.c31, normalCards, laiziCards));
                }
            }
            if (laiziLen == 5 && ((laiziValue[0] == laiziValue[2] && laiziValue[3] == laiziValue[4]) ||
                (laiziValue[0] == laiziValue[1] && laiziValue[2] == laiziValue[4]))) {
                resultTypes.push(getResultObj(CardType.c32, normalCards, laiziCards));
            }
            if (laiziLen == 6 && laiziValue[0] != laiziValue[laiziLen - 1]) {
                if (laiziValue[0] == laiziValue[2] && laiziValue[3] == laiziValue[5]) {
                    resultTypes.push(getResultObj(CardType.c111222, normalCards, laiziCards));
                }
                if ((laiziValue[0] == laiziValue[3] && laiziValue[4] == laiziValue[5]) ||
                    (laiziValue[0] == laiziValue[1] && laiziValue[2] == laiziValue[5])) {
                    resultTypes.push(getResultObj(CardType.c411, normalCards, laiziCards));
                }
            }
        }
        return resultTypes;
    }

    var first = cardsValue[0];
    var last = cardsValue[cardsLen - 1];
    if (cardsLen + laiziLen == 1) {
        resultTypes.push(getResultObj(CardType.c1, normalCards, laiziCards));
    } else if (cardsLen + laiziLen == 2) {
        if (first == last && last <= 15) {
            _temp_laizi_cards = deepCopy(laiziCards);
            for (i = 0; i < _temp_laizi_cards.length; i++) {
                _temp_laizi_cards[i].changeToNumber = normalCards[0].number % 13;
            }
            resultTypes.push(getResultObj(CardType.c2, normalCards, _temp_laizi_cards));
        }
        if (cardsLen == 2 && first > 15) {
            resultTypes.push(getResultObj(CardType.c42, normalCards, laiziCards));
        }
    } else if (cardsLen + laiziLen == 3) {
        if (first == last && last <= 15) {
            _temp_laizi_cards = deepCopy(laiziCards);
            for (i = 0; i < _temp_laizi_cards.length; i++) {
                _temp_laizi_cards[i].changeToNumber = normalCards[0].number % 13;
            }
            resultTypes.push(getResultObj(CardType.c3, normalCards, _temp_laizi_cards));
        }
    } else if (cardsLen + laiziLen == 4) {
        if (cardsLen == 1) {
            var _three_value = [];
            _three_value.push({value: normalCards[0].number, needCount: 2});
            _three_value.push({value: laiziCards[0].number, needCount: 3});
            if (laiziValue[0] != laiziValue[laiziLen - 1]) {
                _three_value.push({value: laiziCards[laiziLen - 1].number, needCount: 3});
            }
            for (i = 0; i < _three_value.length; i++) {
                _temp_laizi_cards = deepCopy(laiziCards);
                for (j = 0; j < _three_value[i].needCount; j++) {
                    _temp_laizi_cards[j].changeToNumber = _three_value[i].value % 13;
                }
                resultTypes.push(getResultObj(CardType.c31, normalCards, _temp_laizi_cards));
            }
            if (first <= 15) {
                _temp_laizi_cards = deepCopy(laiziCards);
                for (i = 0; i < _temp_laizi_cards.length; i++) {
                    _temp_laizi_cards[i].changeToNumber = normalCards[0].number % 13;
                }
                resultTypes.push(getResultObj(CardType.c4, normalCards, _temp_laizi_cards));
            }
        } else if (cardsLen == 2) {
            if (first <= 15) {
                var _three_value = [];
                if (first == last) {
                    _three_value.push({value: normalCards[0].number, needCount: 1});
                    _temp_laizi_cards = deepCopy(laiziCards);
                    for (i = 0; i < _temp_laizi_cards.length; i++) {
                        _temp_laizi_cards[i].changeToNumber = normalCards[0].number % 13;
                    }
                    resultTypes.push(getResultObj(CardType.c4, normalCards, _temp_laizi_cards));
                } else {
                    _three_value.push({value: normalCards[0].number, needCount: 2});
                    if (last <= 15) {
                        _three_value.push({value: normalCards[cardsLen - 1].number, needCount: 2});
                    }
                }
                for (i = 0; i < _three_value.length; i++) {
                    _temp_laizi_cards = deepCopy(laiziCards);
                    for (j = 0; j < _three_value[i].needCount; j++) {
                        _temp_laizi_cards[j].changeToNumber = _three_value[i].value % 13;
                    }
                    resultTypes.push(getResultObj(CardType.c31, normalCards, _temp_laizi_cards));
                }
            }
        } else if (cardsLen == 3) {
            if (first == last) {
                resultTypes.push(getResultObj(CardType.c31, normalCards, laiziCards));
                _temp_laizi_cards = deepCopy(laiziCards);
                for (i = 0; i < _temp_laizi_cards.length; i++) {
                    _temp_laizi_cards[i].changeToNumber = normalCards[0].number % 13;
                }
                resultTypes.push(getResultObj(CardType.c4, normalCards, _temp_laizi_cards));
            } else {
                var _three_value = [];
                if (first == cardsValue[1]) {
                    _three_value.push({value: normalCards[0].number, needCount: 1});
                }
                if (cardsValue[1] == last) {
                    _three_value.push({value: normalCards[cardsLen - 1].number, needCount: 1});
                }
                for (i = 0; i < _three_value.length; i++) {
                    _temp_laizi_cards = deepCopy(laiziCards);
                    for (j = 0; j < _three_value[i].needCount; j++) {
                        _temp_laizi_cards[j].changeToNumber = _three_value[i].value % 13;
                    }
                    resultTypes.push(getResultObj(CardType.c31, normalCards, _temp_laizi_cards));
                }
            }
        } else if (cardsLen == 4) {
            if (first == last) {
                resultTypes.push(getResultObj(CardType.c4, normalCards, laiziCards));
            } else if (first == cardsValue[2] || cardsValue[1] == last) {
                resultTypes.push(getResultObj(CardType.c31, normalCards, laiziCards));
            }
        }
    } else {
        var count = analyzeCards(normalCards);
        var fourList = [];
        var threeList = [];
        var twoList = [];
        var oneList = [];
        for (i = 0; i < count.length; i++) {
            if (count[i] == 4) {
                fourList.push(i + 3);
            } else if (count[i] == 3) {
                threeList.push(i + 3);
            } else if (count[i] == 2) {
                twoList.push(i + 3);
            } else if (count[i] == 1) {
                oneList.push(i + 3);
            }
        }
        //炸弹
        if (first == last && last <= 15) {
            _temp_laizi_cards = deepCopy(laiziCards);
            for (i = 0; i < _temp_laizi_cards.length; i++) {
                _temp_laizi_cards[i].changeToNumber = normalCards[0].number % 13;
            }
            resultTypes.push(getResultObj(CardType.c4, normalCards, _temp_laizi_cards));
        }
        //顺子
        if (oneList.length == cardsLen) {
            var begin = first - laiziLen;
            for (i = begin >= 3 ? begin : 3; i < 15; i++) {
                if (count[i - 3] > 0) {
                    if (i == 14 && laiziLen == 0 && isSequenceArr(oneList)) {
                        resultTypes.push(getResultObj(CardType.c123, normalCards, laiziCards));
                        break;
                    }
                    continue;
                }
                _temp_laizi_cards = deepCopy(laiziCards);
                var _temp_one_list = deepCopy(oneList);
                var _changeIndex = -1;
                for (j = i; j < 15; j++) {
                    if (count[j - 3] == 0) {
                        _changeIndex++;
                        if (_changeIndex >= _temp_laizi_cards.length) {
                            break;
                        }
                        _temp_laizi_cards[_changeIndex].changeToNumber = (j - 1) % 13;
                        _temp_one_list.push(j);
                    }
                }
                if (isSequenceArr(_temp_one_list.sort(compareTwoNumbers))) {
                    resultTypes.push(getResultObj(CardType.c123, normalCards, _temp_laizi_cards));
                }
                if (laiziLen == 0 || _changeIndex < _temp_laizi_cards.length) {
                    break;
                }
            }
        }

        //连对
        if (fourList.length == 0 && threeList.length == 0) {
            var begin = first - Math.floor(laiziLen / 2);
            for (i = begin >= 3 ? begin : 3; i < 15; i++) {
                if (count[i - 3] > 1) {
                    if (i == 14 && twoList.length * 2 == cardsLen + laiziLen && isSequenceArr(twoList)) {
                        resultTypes.push(getResultObj(CardType.c1122, normalCards, laiziCards));
                        break;
                    }
                    continue;
                }
                _temp_laizi_cards = deepCopy(laiziCards);
                var _temp_two_list = deepCopy(twoList);
                var _changeIndex = -1;
                for (j = i; j < 15; j++) {
                    if (count[j - 3] < 2) {
                        for (var k = 0; k < (2 - count[j - 3]); k++) {
                            _changeIndex++;
                            if (_changeIndex >= _temp_laizi_cards.length) {
                                break;
                            }
                            _temp_laizi_cards[_changeIndex].changeToNumber = (j - 1) % 13;
                        }
                        if (_changeIndex < _temp_laizi_cards.length) {
                            _temp_two_list.push(j);
                        } else {
                            break;
                        }
                    }
                }
                if (_temp_two_list.length * 2 == cardsLen + laiziLen && isSequenceArr(_temp_two_list.sort(compareTwoNumbers))) {
                    resultTypes.push(getResultObj(CardType.c1122, normalCards, _temp_laizi_cards));
                }
                if (laiziLen == 0 || _changeIndex < _temp_laizi_cards.length) {
                    break;
                }
            }
        }

        // 斗地主3带一对
        if (cardsLen + laiziLen == 5 && last <= 15 && fourList.length == 0) {
            if (oneList.length + twoList.length + threeList.length <= 2) {
                if (threeList.length == 1) {
                    _temp_laizi_cards = deepCopy(laiziCards);
                    if (oneList.length == 1) {
                        _temp_laizi_cards[0].changeToNumber = (oneList[0] - 1) % 13
                    } else if (oneList.length + twoList.length == 0) {
                        if (laiziValue[0] != laiziValue[1]) {
                            _temp_laizi_cards[0].changeToNumber = _temp_laizi_cards[1].number % 13
                        }
                    }
                    resultTypes.push(getResultObj(CardType.c32, normalCards, _temp_laizi_cards));
                } else {
                    var _changeValue = [];
                    if (cardsValue[0] == cardsValue[cardsLen - 1]) {

                        console.log('--->>>'+laiziCards);
                        console.log('--->>>'+(laiziLen - 1));
                        console.log('--->>>'+laiziCards[laiziLen - 1]);

                        _changeValue.push([{value: normalCards[0].number, needCount: 3 - cardsLen},
                            {value: laiziCards[laiziLen - 1].number, needCount: 2}]);
                        _changeValue.push([{value: normalCards[0].number, needCount: 2 - cardsLen},
                            {value: laiziCards[laiziLen - 1].number, needCount: 3}]);
                        if (laiziValue[0] != laiziValue[laiziLen - 1]) {
                            _changeValue.push([{value: normalCards[0].number, needCount: 2 - cardsLen},
                                {value: laiziCards[0].number, needCount: 3}]);
                        }
                    } else {
                        var _availableNum = [];
                        for (i = 0; i < oneList.length; i++) {
                            _availableNum.push({number: oneList[i] - 1, count: 1});
                        }
                        for (i = 0; i < twoList.length; i++) {
                            _availableNum.push({number: twoList[i] - 1, count: 2});
                        }
                        _changeValue.push([{value: _availableNum[0].number, needCount: 3 - _availableNum[0].count},
                            {value: _availableNum[1].number, needCount: 2 - _availableNum[1].count}]);
                        _changeValue.push([{value: _availableNum[1].number, needCount: 3 - _availableNum[1].count},
                            {value: _availableNum[0].number, needCount: 2 - _availableNum[0].count}]);
                    }
                    for (i = 0; i < _changeValue.length; i++) {
                        _temp_laizi_cards = deepCopy(laiziCards);
                        var _changeIndex = -1;
                        for (j = 0; j < _changeValue[i].length; j++) {
                            for (var k = 0; k < _changeValue[i][j].needCount; k++) {
                                _changeIndex++;
                                _temp_laizi_cards[_changeIndex].changeToNumber = _changeValue[i][j].value % 13;
                            }
                        }
                        resultTypes.push(getResultObj(CardType.c32, normalCards, _temp_laizi_cards));
                    }
                }
            }
        }

        //4带2
        if (cardsLen + laiziLen == 6 && oneList.length + twoList.length + threeList.length + fourList.length <= 3) {
            if (fourList.length == 1) {
                resultTypes.push(getResultObj(CardType.c411, normalCards, laiziCards));
            } else if (threeList.length == 1) {
                if (laiziLen > 0) {
                    _temp_laizi_cards = deepCopy(laiziCards);
                    _temp_laizi_cards[0].changeToNumber = (threeList[0] - 1) % 13;
                    resultTypes.push(getResultObj(CardType.c411, normalCards, _temp_laizi_cards));
                }
            } else if (laiziLen > 0) {
                var _availableNums = oneList.concat(twoList);
                _availableNums.push(laiziValue[0]);
                if (laiziValue[0] != laiziValue[laiziLen - 1]) {
                    _availableNums.push(laiziValue[laiziLen - 1]);
                }
                for (i = 0; i < _availableNums.length; i++) {
                    _temp_laizi_cards = deepCopy(laiziCards);
                    var _changeIndex = -1;
                    for (j = 0; j < (4 - count[_availableNums[i] - 3]); j++) {
                        _changeIndex++;
                        if (_changeIndex >= _temp_laizi_cards.length) {
                            break;
                        }
                        _temp_laizi_cards[_changeIndex].changeToNumber = (_availableNums[i] - 1) % 13;
                    }
                    if (j == (4 - count[_availableNums[i] - 3])) {
                        resultTypes.push(getResultObj(CardType.c411, normalCards, _temp_laizi_cards));
                    }
                }
            }
        }

        //4带2对
        if (cardsLen + laiziLen == 8 && last <= 15 && oneList.length + twoList.length + threeList.length + fourList.length <= 3) {
            _temp_laizi_cards = deepCopy(laiziCards);
            var _changeIndex = -1;
            do {
                for (i = 0; i < oneList.length; i++) {
                    _changeIndex++;
                    if (_changeIndex >= _temp_laizi_cards.length) {
                        break;
                    }
                    _temp_laizi_cards[_changeIndex].changeToNumber = (oneList[i] - 1) % 13;
                }
                for (i = 0; i < threeList.length; i++) {
                    _changeIndex++;
                    if (_changeIndex >= _temp_laizi_cards.length) {
                        break;
                    }
                    _temp_laizi_cards[_changeIndex].changeToNumber = (threeList[i] - 1) % 13;
                }
                if (_changeIndex >= _temp_laizi_cards.length) {
                    break;
                }
                var _temp_two_list = twoList.concat(oneList);
                var _temp_four_list = fourList.concat(threeList);
                if (_temp_four_list.length == 1) {
                    if (_temp_two_list.length == 1) {
                        var _temp_laizi_cards2 = deepCopy(_temp_laizi_cards);
                        var _changeIndex2 = _changeIndex;
                        _changeIndex2++;
                        _temp_laizi_cards2[_changeIndex2].changeToNumber = _temp_laizi_cards2[laiziLen - 1] % 13;
                        resultTypes.push(getResultObj(CardType.c422, normalCards, _temp_laizi_cards2));
                        break;
                    } else if (_temp_two_list.length == 0) {
                        var _temp_laizi_cards2 = deepCopy(_temp_laizi_cards);
                        var _changeIndex2 = _changeIndex;
                        _changeIndex2++;
                        _temp_laizi_cards2[_changeIndex2].changeToNumber = _temp_laizi_cards2[0] % 13;
                        _changeIndex2++;
                        _temp_laizi_cards2[_changeIndex2].changeToNumber = _temp_laizi_cards2[laiziLen - 1] % 13;
                        resultTypes.push(getResultObj(CardType.c422, normalCards, _temp_laizi_cards2));
                        break;
                    }
                } else if (_temp_four_list.length == 0) {
                    if (_temp_two_list.length == 3) {
                        for (i = 0; i < _temp_two_list.length; i++) {
                            var _temp_laizi_cards2 = deepCopy(_temp_laizi_cards);
                            var _changeIndex2 = _changeIndex;
                            for (j = 0; j < 2; j++) {
                                _changeIndex2++;
                                _temp_laizi_cards2[_changeIndex2].changeToNumber = (_temp_two_list[i] - 1) % 13;
                            }
                            resultTypes.push(getResultObj(CardType.c422, normalCards, _temp_laizi_cards2));
                        }
                        break;
                    } else if (_temp_two_list.length == 2 || _temp_two_list.length == 1) {
                        var _availableNums = [];
                        for (i = 0; i < _temp_two_list.length; i++) {
                            _availableNums.push(_temp_two_list[i]);
                        }
                        _availableNums.push(laiziValue[0]);
                        if (laiziValue[0] != laiziValue[laiziLen - 1]) {
                            _availableNums.push(laiziValue[laiziLen - 1]);
                        }
                        for (i = 0; i < _availableNums.length; i++) {
                            var _temp_laizi_cards2 = deepCopy(_temp_laizi_cards);
                            var _changeIndex2 = _changeIndex;
                            for (j = 0; j < 2; j++) {
                                _changeIndex2++;
                                _temp_laizi_cards2[_changeIndex2].changeToNumber = (_availableNums[i] - 1) % 13;
                            }
                            if (_temp_two_list.length == 1 && i == _availableNums.length - 1) {
                                for (j = 0; j < 2; j++) {
                                    _changeIndex2++;
                                    _temp_laizi_cards2[_changeIndex2].changeToNumber = (laiziValue[0] - 1) % 13;
                                }
                            }
                            resultTypes.push(getResultObj(CardType.c422, normalCards, _temp_laizi_cards2));
                        }
                        break;
                    }
                }
                resultTypes.push(getResultObj(CardType.c422, normalCards, _temp_laizi_cards));
            } while (0);
        }

        // 分析飞机
        if (cardsLen + laiziLen >= 6) {
            resultTypes = resultTypes.concat(checkPlaneWithLaizi(normalCards, laiziCards, cardsValue));
        }
    }

    return resultTypes;
};

var getResultObj = function (cardType, normalCards, laiziCards) {
    var obj = {};
    obj.type = cardType;
    obj.originalardArr = [];
    obj.cardArr = [];
    obj.newCards = deepCopy(normalCards);
    for (var i = 0; i < normalCards.length; i++) {
        obj.cardArr.push(normalCards[i].number);
        obj.originalardArr.push(normalCards[i].number);
    }
    for (i = 0; i < laiziCards.length; i++) {
        obj.cardArr.push((laiziCards[i].changeToNumber + 1) * 100 + laiziCards[i].number);
        obj.originalardArr.push(laiziCards[i].number);
        obj.newCards.push(new Card(laiziCards[i].changeToNumber));
    }
    obj.newCards.sort(function (a, b) {
        return a.weight - b.weight
    });
    return obj;
};

var analyzeCards = function (list) {
    var count = [];
    for (var i = 0; i < 15; i++)
        count[i] = 0;

    for (var _card in list)
        if (list.hasOwnProperty(_card)) {
            var card = list[_card];
            var index = card.weight - 3;
            count[index]++;
        }
    return count;
};

var analyzeCardsData = function (list) {
    var count = [];
    for (var i = 0; i < 15; i++)
        count[i] = {count:0, numbers:[]};

    for (var _card in list)
        if (list.hasOwnProperty(_card)) {
            var card = list[_card];
            var index = card.weight - 3;
            count[index].count++;
            count[index].numbers.push(card.number);
        }
    return count;
};


exports.checkCards = function (playerCards, myCards, isMyLastHandCards, laiziValue) {
    if (playerCards && playerCards.length && _.isNumber(playerCards[0]))
        playerCards = toCardsArr(playerCards);

    if (myCards && myCards.length && _.isNumber(myCards[0]))
        myCards = toCardsArr(myCards);

    var laiziCards = [];
    myCards = myCards || [];
    for (var j = myCards.length - 1; j >= 0; j--) {
        if (isLaizi(myCards[j].number, laiziValue)) {
            myCards[j].isLaizi = true;
            laiziCards.push(myCards[j]);
            myCards.splice(j, 1);
        }
    }

    if (laiziCards.length)
        laiziCards.sort(function (a, b) {
            return a.weight - b.weight
        });
    if (myCards && myCards.length)
        myCards.sort(function (a, b) {
            return a.weight - b.weight
        });
    if (playerCards && playerCards.length)
        playerCards.sort(function (a, b) {
            return a.weight - b.weight
        });

    var resultTypes = checkCardsSimple(myCards, laiziCards);
    if (!playerCards || playerCards.length == 0)
        return resultTypes;

    var playerCardType = judgeType(playerCards);
    if (availableCardTypes.indexOf(playerCardType) < 0) {
        return [];
    }
    if (resultTypes.length <= 0) {
        return resultTypes;
    }
    if (playerCardType == CardType.c42) {
        return [];
    }
    var exceptTypes = [];
    exceptTypes.push(CardType.c42);
    exceptTypes.push(CardType.c4);
    if (playerCardType == CardType.c4) {
        removeResultType(resultTypes, exceptTypes);
        for (var i = resultTypes.length - 1; i >= 0; i--) {
            if (resultTypes[i].type == CardType.c4) {
                if (myCards.length + laiziCards.length < playerCards.length) {
                    resultTypes.splice(i, 1);
                } else if (myCards.length + laiziCards.length == playerCards.length) {
                    if (getBombWeight(playerCards) >= getBombWeight(myCards.concat(laiziCards))) {
                        resultTypes.splice(i, 1);
                    }
                }
            }
        }
        return resultTypes;
    }

    exceptTypes.push(playerCardType);
    if (isMyLastHandCards) {
        if (playerCardType == CardType.c32) {
            exceptTypes.push(CardType.c31);
            exceptTypes.push(CardType.c3);
        }
        if (playerCardType == CardType.c1112223344) {
            exceptTypes.push(CardType.c111222);
        }
    }
    removeResultType(resultTypes, exceptTypes);

    // 单牌,对子,3带
    if (playerCardType == CardType.c1 || playerCardType == CardType.c2
        || playerCardType == CardType.c3) {
        for (var i = resultTypes.length - 1; i >= 0; i--) {
            if (resultTypes[i].type != CardType.c4 && resultTypes[i].type != CardType.c42) {
                if (playerCards[0].weight >= resultTypes[i].newCards[0].weight) {
                    resultTypes.splice(i, 1);
                }
            }
        }
    }

    // 顺子,连队，飞机不带
    if (playerCardType == CardType.c123 || playerCardType == CardType.c1122
        || playerCardType == CardType.c111222) {
        for (var i = resultTypes.length - 1; i >= 0; i--) {
            if (resultTypes[i].type != CardType.c4 && resultTypes[i].type != CardType.c42) {
                if (playerCards.length != resultTypes[i].newCards.length ||
                    playerCards[0].weight >= resultTypes[i].newCards[0].weight) {
                    resultTypes.splice(i, 1);
                }
            }
        }
    }
    // 按重复多少排序
    // 3带1,3带2 ,飞机带单，双,4带1,2,只需比较第一个就行，独一无二的
    if (playerCardType == CardType.c31 || playerCardType == CardType.c32
        || playerCardType == CardType.c411 || playerCardType == CardType.c422) {
        var count = analyzeCards(playerCards);
        var fourList = [];
        var threeList = [];
        var twoList = [];
        var oneList = [];
        for (i = 0; i < count.length; i++) {
            if (count[i] == 4) {
                fourList.push(i);
            } else if (count[i] == 3) {
                threeList.push(i);
            } else if (count[i] == 2) {
                twoList.push(i);
            } else if (count[i] == 1) {
                oneList.push(i);
            }
        }
        if (fourList.length == 2) {
            twoList.push(fourList[0]);
            twoList.push(fourList[0]);
            twoList.sort(compareTwoNumbers);
            fourList.splice(0, 1);
        }
        for (var i = resultTypes.length - 1; i >= 0; i--) {
            if (resultTypes[i].type != CardType.c4 && resultTypes[i].type != CardType.c42) {
                var count2 = analyzeCards(resultTypes[i].newCards);
                var fourList2 = [];
                var threeList2 = [];
                var twoList2 = [];
                var oneList2 = [];
                for (j = 0; j < count2.length; j++) {
                    if (count2[j] == 4) {
                        fourList2.push(j);
                    } else if (count2[j] == 3) {
                        threeList2.push(j);
                    } else if (count2[j] == 2) {
                        twoList2.push(j);
                    } else if (count2[j] == 1) {
                        oneList2.push(j);
                    }
                }
                if (fourList2.length == 2) {
                    twoList2.push(fourList2[0]);
                    twoList2.push(fourList2[0]);
                    twoList2.sort(compareTwoNumbers);
                    fourList2.splice(0, 1);
                }
                var isEqual = false;
                var func = function (list1, list2, i) {
                    if (list1.length != list2.length) {
                        resultTypes.splice(i, 1);
                        return true;
                    }
                    for (var j = list1.length - 1; j >= 0; j--) {
                        if (list1[j] > list2[j]) {
                            resultTypes.splice(i, 1);
                            return true;
                        } else if (list1[j] < list2[j]) {
                            return true;
                        } else if (list1[j] == list2[j]) {
                            isEqual = true;
                        }
                    }
                    return false;
                };

                if (fourList.length > 0 && func(fourList, fourList2, i)) {
                    continue;
                }
                if (threeList.length > 0 && func(threeList, threeList2, i)) {
                    continue;
                }
                if (twoList.length > 0 && func(twoList, twoList2, i)) {
                    continue;
                }
                if (oneList.length > 0 && func(oneList, oneList2, i)) {
                    continue;
                }
                if (isEqual) {
                    resultTypes.splice(i, 1);
                }
            }
        }
    }
    if (playerCardType == CardType.c11122234 || playerCardType == CardType.c1112223344) {
        for (var i = resultTypes.length - 1; i >= 0; i--) {
            if (resultTypes[i].type != CardType.c4 && resultTypes[i].type != CardType.c42) {
                var playerWeight = getPlaneMinWeight(playerCards, playerCardType);
                var mineWeight = getPlaneMinWeight(resultTypes[i].newCards, resultTypes[i].type);
                if (playerWeight[0] > mineWeight[0]) {
                    resultTypes.splice(i, 1);
                } else if (playerWeight[0] == mineWeight[0]) {
                    var isBreak = false;
                    for (var j = playerWeight[1].length - 1; j >= 0; j--) {
                        if (playerWeight[1][j] > mineWeight[1][j]) {
                            resultTypes.splice(i, 1);
                            isBreak = true;
                            break;
                        } else if (playerWeight[1][j] < mineWeight[1][j]) {
                            isBreak = true;
                            break;
                        }
                    }
                    if (!isBreak) {
                        resultTypes.splice(i, 1);
                    }
                }
            }
        }
    }
    return resultTypes;
};

var removeResultType = function (resultTypes, exceptTypes) {
    for (var i = resultTypes.length - 1; i >= 0; i--) {
        var needRemove = true;
        for (var j = 0; j < exceptTypes.length; j++) {
            if (resultTypes[i].type == exceptTypes[j]) {
                needRemove = false;
                break;
            }
        }
        if (needRemove) {
            resultTypes.splice(i, 1);
        }
    }
};

var getBombWeight = function (cards) {
    var laiziNum = 0;
    for (var i = 0; i < cards.length; i++) {
        if (cards[i].isLaizi) {
            laiziNum++;
        }
    }
    var fixNum;
    if (laiziNum == 0) {
        fixNum = 2;
    } else if (laiziNum == cards.length) {
        fixNum = 3;
    } else {
        fixNum = 1;
    }
    return fixNum * 100 + getValue(cards[0]);
};

var getPlaneMinWeight = function (playerCards, planeType) {
    var player_count = analyzeCards(playerCards);
    var plane_size;
    if (planeType == CardType.c1112223344) {
        plane_size = playerCards.length / 5;
    } else if (planeType == CardType.c111222) {
        plane_size = playerCards.length / 3;
    } else if (planeType == CardType.c11122234) {
        plane_size = playerCards.length / 4;
    }

    for (var i = 11; i >= 0; i--) {
        if (player_count[i] < 3) {
            continue;
        }
        var size = 1;
        for (var j = i - 1; j >= 0; j--) {
            if (player_count[j] >= 3) {
                size++;
            } else {
                break;
            }
            if (size == plane_size) {
                return [i + 3, player_count];
            }
        }
    }
    return [0, player_count];
};

var checkCardsSimple = function (myCards, laiziCards) {
    if (myCards && myCards.length && _.isNumber(myCards[0]))
        myCards = toCardsArr(myCards);
    if (laiziCards && laiziCards.length && _.isNumber(laiziCards[0]))
        laiziCards = toCardsArr(laiziCards);
    var myCardTypeList = judgeTypeWithLaizi(myCards, laiziCards);
    for (var i = myCardTypeList.length - 1; i >= 0; i--) {
        if (availableCardTypes.indexOf(myCardTypeList[i].type) < 0) {
            myCardTypeList.splice(i, 1);
        }
    }
    return myCardTypeList;
};

var toCardsArr = function (arr) {
    var retArr = [];
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] < 100) {
            retArr.push(new Card(arr[i]));
        } else {
            var card = new Card(Math.floor(arr[i] / 100) - 1);
            card.isLaizi = true;
            retArr.push(card);
        }
    }
    return retArr;
};

exports.numberArr2NameArr = function (arr) {
    var t = [];
    for (var i = 0; i < arr.length; i++)
        t.push(new Card(arr[i]).name);
    return t;
};

var isLaizi = function (value, laiziValue) {
    if (laiziValue.length > 0) {
        for (var i = 0; i < laiziValue.length; i++) {
            if (value < 52 && value % 13 + 1 == laiziValue[i]) {
                return true;
            }
        }
        return false;
    }
    return false;
};

exports.getPromptCards = function(playerCards, myCards, laiziValue) {
    if (playerCards && playerCards.length && _.isNumber(playerCards[0]))
        playerCards = toCardsArr(playerCards);

    if (!playerCards || playerCards.length === 0) {
        return [];
    }

    if (playerCards && playerCards.length)
        playerCards.sort(function (a, b) {
            return a.weight - b.weight
        });

    var playerCardType = judgeType(playerCards);
    if (availableCardTypes.indexOf(playerCardType) < 0) {
        return [];
    }
    if (playerCardType === CardType.c42) {
        return [];
    }

    if (!myCards || myCards.length === 0) {
        return [];
    }

    var that = this;

    if (myCards && myCards.length && _.isNumber(myCards[0]))
        myCards = toCardsArr(myCards);

    var laiziCards = [];
    myCards = myCards || [];
    for (var j = myCards.length - 1; j >= 0; j--) {
        if (isLaizi(myCards[j].number, laiziValue)) {
            myCards[j].isLaizi = true;
            laiziCards.push(myCards[j]);
            myCards.splice(j, 1);
        }
    }
    if (laiziCards.length)
        laiziCards.sort(function (a, b) {
            return a.weight - b.weight
        });
    if (myCards && myCards.length)
        myCards.sort(function (a, b) {
            return a.weight - b.weight
        });

    var cardStr = '';
    var weightStr = '';
    var playerWeightStr = '';
    for (var j = myCards.length - 1; j >= 0; j--) {
        cardStr += myCards[j].number + ','
        weightStr += myCards[j].weight + ','
    }

    for (var j = playerCards.length - 1; j >= 0; j--) {
        playerWeightStr += playerCards[j].weight + ','
    }

    var countArr = analyzeCardsData(myCards);

    var fourList = [];
    var threeList = [];
    var twoList = [];
    var oneList = [];
    for (i = 0; i < countArr.length; i++) {
        if (countArr[i].count === 4) {
            fourList.push(i);
        } else if (countArr[i].count === 3) {
            threeList.push(i);
        } else if (countArr[i].count === 2) {
            twoList.push(i);
        } else if (countArr[i].count === 1) {
            oneList.push(i);
        }
    }

    var getRocket = function () {
        if (myCards.length > 1) {
            var a = myCards[myCards.length - 1];
            var b = myCards[myCards.length - 2];
            if (a.number === 53 && b.number === 52) {
                return [52, 53];
            }
        }
        return [];
    };

    var getSoftBomb = function () {

        var res = [];

        var laiziLen = laiziCards.length;

        for (var i = 1; i <= laiziLen; i++) {
            var useLaizis = laiziCards.slice(0, i);

            var tempLaizi = [];
            for (var k = 0; k < useLaizis.length; k++) {
                tempLaizi.push(useLaizis[k].number);
            }

            for (var j = 0; j < fourList.length; j++) {
                res.push(countArr[fourList[j]].numbers.concat(tempLaizi));
            }

            if (i >= 1) {
                for (var j = 0; j < threeList.length; j++) {
                    res.push(countArr[threeList[j]].numbers.concat(tempLaizi));
                }
            }

            if (i >= 2) {
                for (var j = 0; j < twoList.length; j++) {
                    res.push(countArr[twoList[j]].numbers.concat(tempLaizi));
                }
            }

            if (i >= 3) {
                for (var j = 0; j < oneList.length; j++) {
                    if (oneList[j] + 3 > 15) {
                        continue;
                    }
                    res.push(countArr[oneList[j]].numbers.concat(tempLaizi));
                }
            }

        }

        return res;

    };

    var getOnlySingleCards = function (cardArr) {

        cardArr.sort(function (a, b) {
            return a.weight - b.weight
        });

        var cardCount = {};
        for (var i = 3; i < 18; i++) {
            cardCount[i] = 0;
            for (var j = 0; j < cardArr.length; j++) {
                if (i === cardArr[j].weight) {
                    cardCount[i] += 1;
                }
            }
        }

        var numbers = [];
        var cardsArr = [];

        for (var i = 0; i < cardArr.length; i++) {
            if (cardCount[cardArr[i].weight] === 1) {
                cardsArr.push({ weight: cardArr[i].weight, cards: [cardArr[i]] });
                numbers.push(cardArr[i].number);
            }
        }

        return { cardsArr: cardsArr, numbers: numbers };

    };

    var getSingleCards = function (normalCards, laiziCards) {

        var cardArr = normalCards.concat(laiziCards);
        cardArr.sort(function (a, b) {
            return a.weight - b.weight
        });

        var numbers = [];
        var cardsArr = [];

        var tempWeight = [];

        for (var i = 0; i < cardArr.length; i++) {
            if (tempWeight.indexOf(cardArr[i].weight) >= 0) {
                continue;
            }
            cardsArr.push({ weight: cardArr[i].weight, cards: [cardArr[i]] });
            numbers.push(cardArr[i].number);

            tempWeight.push(cardArr[i].weight);
        }

        return { cardsArr: cardsArr, numbers: numbers };
    };

    var getPairCards = function (normalCards, laiziCards) {

        var cardArr = normalCards.concat(laiziCards);

        var numbers = [];
        var cardsArr = [];

        var tempWeight = [];

        cardArr.sort(function (a, b) {
            return a.weight - b.weight
        });
        for (var i = 0; i < cardArr.length - 1; i++) {
            if (cardArr[i].weight === cardArr[i + 1].weight) {

                if (tempWeight.indexOf(cardArr[i].weight) >= 0) {
                    continue;
                }

                numbers.push(cardArr[i].number);
                numbers.push(cardArr[i + 1].number);
                cardsArr.push({
                    weight: cardArr[i].weight,
                    cards: [cardArr[i], cardArr[i + 1]]
                });

                tempWeight.push(cardArr[i].weight);

            }
        }
        if (laiziCards.length > 0) {
            for (var i = 0; i < laiziCards.length; i++) {
                var laizi = laiziCards[i];
                var lastLaiziCards = that.getExpectCards(laiziCards, [laiziCards[i].number]);
                var singleCardsArr = getSingleCards(normalCards, lastLaiziCards).cardsArr;
                for (var j = 0; j < singleCardsArr.length; j++) {
                    if (singleCardsArr[j].weight < 16) {

                        if (tempWeight.indexOf(singleCardsArr[j].weight) >= 0) {
                            continue;
                        }

                        numbers.push(singleCardsArr[j].cards[0].number);
                        numbers.push(laizi.number);
                        cardsArr.push({
                            weight: singleCardsArr[j].cards[0].weight,
                            cards: [singleCardsArr[j].cards[0], laizi]
                        });

                        tempWeight.push(singleCardsArr[j].cards[0].weight);
                    }

                }
            }
        }

        return { cardsArr: cardsArr, numbers: numbers };
    };

    var getThreeCards = function (normalCards, laiziCards) {

        var cardArr = normalCards.concat(laiziCards);

        var numbers = [];
        var cardsArr = [];

        var tempWeight = [];

        cardArr.sort(function (a, b) {
            return a.weight - b.weight
        });
        for (var i = 0; i < cardArr.length - 2; i++) {
            if (cardArr[i].weight === cardArr[i + 1].weight &&
                cardArr[i].weight === cardArr[i + 2].weight) {

                if (tempWeight.indexOf(cardArr[i].weight) >= 0) {
                    continue;
                }

                numbers.push(cardArr[i].number);
                numbers.push(cardArr[i + 1].number);
                numbers.push(cardArr[i + 2].number);
                cardsArr.push({
                    weight: cardArr[i].weight,
                    cards: [cardArr[i], cardArr[i + 1], cardArr[i + 2]]
                });

                tempWeight.push(cardArr[i].weight);

            }
        }

        if (laiziCards.length > 0) {
            for (var i = 0; i < laiziCards.length; i++) {
                var laizi = laiziCards[i];
                var lastLaiziCards = that.getExpectCards(laiziCards, [laiziCards[i].number]);
                var pairCards = getPairCards(normalCards, lastLaiziCards);
                var pairCardsArr = pairCards.cardsArr;
                for (var j = 0; j < pairCardsArr.length; j++) {

                    if (tempWeight.indexOf(pairCardsArr[j].cards[0].weight) >= 0) {
                        continue;
                    }

                    numbers.push(pairCardsArr[j].cards[0].number);
                    numbers.push(pairCardsArr[j].cards[1].number);
                    numbers.push(laizi.number);
                    cardsArr.push({
                        weight: pairCardsArr[j].cards[0].weight,
                        cards: [pairCardsArr[j].cards[0],
                        pairCardsArr[j].cards[1], laizi]
                    });

                    tempWeight.push(pairCardsArr[j].cards[0].weight);
                }
            }
        }

        if (laiziCards.length > 1) {
            for (var i = 0; i < laiziCards.length - 1; i++) {
                var laizi1 = laiziCards[i];
                var laizi2 = laiziCards[i + 1];

                var lastLaiziCards = that.getExpectCards(laiziCards, [laizi1.number, laizi2.number]);
                var singleCards = getSingleCards(normalCards, lastLaiziCards);
                var singleCardsArr = singleCards.cardsArr;
                for (var j = 0; j < singleCardsArr.length; j++) {
                    if (singleCardsArr[j].weight < 16) {

                        if (tempWeight.indexOf(singleCardsArr[j].cards[0].weight) >= 0) {
                            continue;
                        }

                        numbers.push(singleCardsArr[j].cards[0].number);
                        numbers.push(laizi1.number);
                        numbers.push(laizi2.number);
                        cardsArr.push({
                            weight: singleCardsArr[j].cards[0].weight,
                            cards: [singleCardsArr[j].cards[0],
                                laizi1, laizi2]
                        });

                        tempWeight.push(singleCardsArr[j].cards[0].weight);

                    }
                }
            }
        }

        return { cardsArr: cardsArr, numbers: numbers };
    };

    var getFourCards = function (normalCards, laiziCards) {

        var cardArr = normalCards.concat(laiziCards);

        var numbers = [];
        var cardsArr = [];

        var tempWeight = [];

        cardArr.sort(function (a, b) {
            return a.weight - b.weight
        });
        for (var i = 0; i < cardArr.length - 3; i++) {
            if (cardArr[i].weight === cardArr[i + 1].weight &&
                cardArr[i].weight === cardArr[i + 2].weight &&
                cardArr[i].weight === cardArr[i + 3].weight
            ) {

                if (tempWeight.indexOf(cardArr[i].weight) >= 0) {
                    continue;
                }

                numbers.push(cardArr[i].number);
                numbers.push(cardArr[i + 1].number);
                numbers.push(cardArr[i + 2].number);
                numbers.push(cardArr[i + 3].number);
                cardsArr.push({
                    weight: cardArr[i].weight,
                    cards: [cardArr[i],
                    cardArr[i + 1],
                    cardArr[i + 2],
                    cardArr[i + 3]
                    ]
                });

                tempWeight.push(cardArr[i].weight);

            }
        }

        if (laiziCards.length > 3) {
            for (var i = 0; i < laiziCards.length; i++) {
                var laizi = laiziCards[i];
                var lastLaiziCards = that.getExpectCards(laiziCards, [laiziCards[i].number]);
                var threeCards = getThreeCards(normalCards, lastLaiziCards);
                var threeCardsArr = threeCards.cardsArr;
                for (var j = 0; j < threeCardsArr.length; j++) {

                    if (tempWeight.indexOf(threeCardsArr[j].cards[0].weight) >= 0) {
                        continue;
                    }

                    numbers.push(threeCardsArr[j].cards[0].number);
                    numbers.push(threeCardsArr[j].cards[1].number);
                    numbers.push(threeCardsArr[j].cards[2].number);
                    numbers.push(laizi.number);
                    cardsArr.push({
                        weight: threeCardsArr[j].cards[0].weight,
                        cards: [threeCardsArr[j].cards[0],
                        threeCardsArr[j].cards[1],
                        threeCardsArr[j].cards[2],
                            laizi]
                    });

                    tempWeight.push(threeCardsArr[j].cards[0].weight);
                }
            }
        }

        if (laiziCards.length > 1) {
            for (var i = 0; i < laiziCards.length - 1; i++) {
                var laizi1 = laiziCards[i];
                var laizi2 = laiziCards[i + 1];
                var lastLaiziCards = that.getExpectCards(laiziCards, [laizi1.number, laizi2.number]);
                var pairCards = getPairCards(normalCards, lastLaiziCards);
                var pairCardsArr = pairCards.cardsArr;
                for (var j = 0; j < pairCardsArr.length; j++) {

                    if (tempWeight.indexOf(pairCardsArr[j].cards[0].weight) >= 0) {
                        continue;
                    }

                    numbers.push(pairCardsArr[j].cards[0].number);
                    numbers.push(pairCardsArr[j].cards[1].number);
                    numbers.push(laizi1.number);
                    numbers.push(laizi2.number);
                    cardsArr.push({
                        weight: pairCardsArr[j].cards[0].weight,
                        cards: [pairCardsArr[j].cards[0],
                        pairCardsArr[j].cards[1],
                            laizi1,
                            laizi2,
                        ]
                    });

                    tempWeight.push(pairCardsArr[j].cards[0].weight);
                }
            }
        }

        if (laiziCards.length > 2) {
            for (var i = 0; i < laiziCards.length - 2; i++) {
                var laizi1 = laiziCards[i];
                var laizi2 = laiziCards[i + 1];
                var laizi3 = laiziCards[i + 2];

                var lastLaiziCards = that.getExpectCards(laiziCards, [laizi1.number, laizi2.number, laizi3.number]);
                var singleCards = getSingleCards(normalCards, lastLaiziCards);
                var singleCardsArr = singleCards.cardsArr;
                for (var j = 0; j < singleCardsArr.length; j++) {
                    if (singleCardsArr[j].weight < 16) {

                        if (tempWeight.indexOf(singleCardsArr[j].cards[0].weight) >= 0) {
                            continue;
                        }

                        numbers.push(singleCardsArr[j].cards[0].number);
                        numbers.push(laizi1.number);
                        numbers.push(laizi2.number);
                        numbers.push(laizi3.number);
                        cardsArr.push({
                            weight: singleCardsArr[j].cards[0].weight,
                            cards: [singleCardsArr[j].cards[0],
                                laizi1, laizi2, laizi3]
                        });

                        tempWeight.push(singleCardsArr[j].cards[0].weight);

                    }
                }
            }
        }

        return { cardsArr: cardsArr, numbers: numbers };
    };


    var result = [];
    if (playerCardType === CardType.c1) {

        var singleCards = getSingleCards(myCards, laiziCards);

        for (var i = 0; i < singleCards.cardsArr.length; i++) {
            if (singleCards.cardsArr[i].weight > playerCards[0].weight) {
                result.push([singleCards.cardsArr[i].cards[0].number]);
            }
        }

        //存在癞子牌时加入软炸弹判断
        result = result.concat(getSoftBomb());

        for (var i = 0; i < fourList.length; i++) {
            result.push(countArr[fourList[i]].numbers);
        }
    }
    else if (playerCardType === CardType.c2) {
        var playerWeight = playerCards[0].weight;

        var pairCards = getPairCards(myCards, laiziCards);

        for (var i = 0; i < pairCards.cardsArr.length; i++) {
            if (pairCards.cardsArr[i].weight > playerWeight) {
                result.push([pairCards.cardsArr[i].cards[0].number,
                pairCards.cardsArr[i].cards[1].number]);
            }
        }

        //存在癞子牌时加入软炸弹判断
        result = result.concat(getSoftBomb());

        for (var i = 0; i < fourList.length; i++) {
            result.push(countArr[fourList[i]].numbers);
        }

    }
    else if (playerCardType === CardType.c3) {
        var playerWeight = playerCards[0].weight;

        var threeCards = getThreeCards(myCards, laiziCards);

        for (var i = 0; i < threeCards.cardsArr.length; i++) {
            if (threeCards.cardsArr[i].weight > playerWeight) {
                result.push([threeCards.cardsArr[i].cards[0].number,
                threeCards.cardsArr[i].cards[1].number,
                threeCards.cardsArr[i].cards[2].number]
                );
            }
        }

        //存在癞子牌时加入软炸弹判断
        result = result.concat(getSoftBomb());

        for (var i = 0; i < fourList.length; i++) {
            result.push(countArr[fourList[i]].numbers);
        }

    }
    else if (playerCardType === CardType.c4) {

        var playerWeight = getBombWeight(playerCards);

        //存在癞子牌时加入软炸弹判断
        var bombs = getSoftBomb();
        for (var i = 0; i < bombs.length; i++) {
            if (bombs[i].length > playerCards.length) {
                result.push(bombs[i]);
            }
        }

        for (var i = 0; i < fourList.length; i++) {
            var bombWeight = getBombWeight(toCardsArr(countArr[fourList[i]].numbers));
            if (bombWeight > playerWeight) {
                result.push(countArr[fourList[i]].numbers);
            }
        }

    }
    else if (playerCardType === CardType.c31) {

        var playerCount = analyzeCards(playerCards);
        var threeList2 = [];
        var oneList2 = [];
        for (i = 0; i < playerCount.length; i++) {
            if (playerCount[i] === 3) {
                threeList2.push(i);
            } else if (playerCount[i] === 1) {
                oneList2.push(i);
            }
        }
        var playerWeight = threeList2[0] + 3;

        var threeCards = getThreeCards(myCards, laiziCards);

        var allCards = myCards.concat(laiziCards);

        for (var i = 0; i < threeCards.cardsArr.length; i++) {
            if (threeCards.cardsArr[i].weight > playerWeight) {
                var tempArr = getExpectCards(allCards, [threeCards.cardsArr[i].cards[0].number,
                threeCards.cardsArr[i].cards[1].number,
                threeCards.cardsArr[i].cards[2].number]);

                var onlySingle = getOnlySingleCards(tempArr);

                for (var j = 0; j < onlySingle.numbers.length; j++) {
                    result.push([threeCards.cardsArr[i].cards[0].number,
                    threeCards.cardsArr[i].cards[1].number,
                    threeCards.cardsArr[i].cards[2].number,
                    onlySingle.numbers[j]]
                    );
                }

                var others = getExpectCards(tempArr, onlySingle.numbers);

                for (var j = 0; j < others.length; j++) {
                    result.push([threeCards.cardsArr[i].cards[0].number,
                    threeCards.cardsArr[i].cards[1].number,
                    threeCards.cardsArr[i].cards[2].number,
                    others[j].number]
                    );
                }
                ///-------------3带1优化
                // for(var j=0; j<tempArr.length; j++){
                //     result.push([threeCards.cardsArr[i].cards[0].number,
                //         threeCards.cardsArr[i].cards[1].number,
                //         threeCards.cardsArr[i].cards[2].number,
                //         tempArr[j].number]
                //     );
                // }
            }
        }

        //存在癞子牌时加入软炸弹判断
        result = result.concat(getSoftBomb());

        for (var i = 0; i < fourList.length; i++) {
            result.push(countArr[fourList[i]].numbers);
        }


    }
    else if (playerCardType === CardType.c32) {
        var playerCount = analyzeCards(playerCards);
        var threeList2 = [];
        var twoList2 = [];
        for (i = 0; i < playerCount.length; i++) {
            if (playerCount[i] === 3) {
                threeList2.push(i);
            } else if (playerCount[i] === 2) {
                twoList2.push(i);
            }
        }
        var playerWeight = threeList2[0] + 3;

        var threeCardsArr = getThreeCards(myCards, laiziCards).cardsArr;

        for (var i = 0; i < threeCardsArr.length; i++) {
            if (threeCardsArr[i].weight > playerWeight) {

                var normals = getExpectCards(myCards, [threeCardsArr[i].cards[0].number,
                threeCardsArr[i].cards[1].number,
                threeCardsArr[i].cards[2].number]);
                var laizis = getExpectCards(laiziCards, [threeCardsArr[i].cards[0].number,
                threeCardsArr[i].cards[1].number,
                threeCardsArr[i].cards[2].number]);


                var threeNumArr = [];

                for (var j = 0; j < threeCardsArr[i].cards.length; j++) {
                    if (!threeCardsArr[i].cards[j].isLaizi) {
                        threeNumArr.push(threeCardsArr[i].cards[j].number);
                    }
                }

                var pairCardsArr = getPairCards(normals, laizis).cardsArr;

                for (var j = 0; j < pairCardsArr.length; j++) {
                    var numberArr = [].concat(threeNumArr);

                    if (!pairCardsArr[j].cards[0].isLaizi) {
                        numberArr.push(pairCardsArr[j].cards[0].number);
                    }
                    if (!pairCardsArr[j].cards[1].isLaizi) {
                        numberArr.push(pairCardsArr[j].cards[1].number);
                    }

                    if (numberArr.length < playerCards.length) {
                        var needLCount = playerCards.length - numberArr.length;

                        if (laiziCards.length >= needLCount) {
                            for (var k = 0; k < needLCount; k++) {
                                numberArr.push(laiziCards[k].number);
                            }
                            result.push(numberArr);
                        }

                    } else {
                        result.push(numberArr);
                    }

                }

            }
        }

        //存在癞子牌时加入软炸弹判断
        result = result.concat(getSoftBomb());

        for (var i = 0; i < fourList.length; i++) {
            result.push(countArr[fourList[i]].numbers);
        }


    }
    else if (playerCardType === CardType.c411) {

        var playerCount = analyzeCards(playerCards);
        var fourList2 = [];
        var oneList2 = [];
        for (i = 0; i < playerCount.length; i++) {
            if (playerCount[i] === 4) {
                fourList2.push(i);
            } else if (playerCount[i] === 1) {
                oneList2.push(i);
            }
        }

        var playerWeight = fourList2[0] + 3;

        var fourCardsArr = getFourCards(myCards, laiziCards).cardsArr;
        var allCards = myCards.concat(laiziCards);

        for (var i = 0; i < fourCardsArr.length; i++) {

            if (fourCardsArr[i].weight > playerWeight) {

                var tempArr = getExpectCards(allCards, [fourCardsArr[i].cards[0].number,
                fourCardsArr[i].cards[1].number,
                fourCardsArr[i].cards[2].number,
                fourCardsArr[i].cards[3].number]);

                for (var j = 0; j < tempArr.length - 1; j++) {
                    result.push([
                        fourCardsArr[i].cards[0].number,
                        fourCardsArr[i].cards[1].number,
                        fourCardsArr[i].cards[2].number,
                        fourCardsArr[i].cards[3].number,
                        tempArr[j].number,
                        tempArr[j + 1].number
                    ]
                    );
                }

            }
        }

        //存在癞子牌时加入软炸弹判断
        result = result.concat(getSoftBomb());

        for (var i = 0; i < fourList.length; i++) {
            result.push(countArr[fourList[i]].numbers);
        }

    }
    else if (playerCardType === CardType.c422) {
        var playerCount = analyzeCards(playerCards);
        var fourList2 = [];
        var twoList2 = [];
        for (i = 0; i < playerCount.length; i++) {
            if (playerCount[i] === 4) {
                fourList2.push(i);
            } else if (playerCount[i] === 2) {
                twoList2.push(i);
            }
        }

        var playerWeight = fourList2[0] + 3;

        var fourCardsArr = getFourCards(myCards, laiziCards).cardsArr;

        for (var i = 0; i < fourCardsArr.length; i++) {

            if (fourCardsArr[i].weight > playerWeight) {

                var normals = getExpectCards(myCards, [fourCardsArr[i].cards[0].number,
                fourCardsArr[i].cards[1].number,
                fourCardsArr[i].cards[2].number,
                fourCardsArr[i].cards[3].number]);
                var laizis = getExpectCards(laiziCards, [fourCardsArr[i].cards[0].number,
                fourCardsArr[i].cards[1].number,
                fourCardsArr[i].cards[2].number,
                fourCardsArr[i].cards[3].number]);

                var fourNumArr = [];

                for (var j = 0; j < fourCardsArr[i].cards.length; j++) {
                    if (!fourCardsArr[i].cards[j].isLaizi) {
                        fourNumArr.push(fourCardsArr[i].cards[j].number);
                    }
                }

                var pairCardsArr = getPairCards(normals, laizis).cardsArr;

                for (var j = 0; j < pairCardsArr.length - 1; j++) {
                    var numberArr = [].concat(fourNumArr);

                    if (!pairCardsArr[j].cards[0].isLaizi) {
                        numberArr.push(pairCardsArr[j].cards[0].number);
                    }
                    if (!pairCardsArr[j].cards[1].isLaizi) {
                        numberArr.push(pairCardsArr[j].cards[1].number);
                    }

                    if (!pairCardsArr[j + 1].cards[0].isLaizi) {
                        numberArr.push(pairCardsArr[j + 1].cards[0].number);
                    }
                    if (!pairCardsArr[j + 1].cards[1].isLaizi) {
                        numberArr.push(pairCardsArr[j + 1].cards[1].number);
                    }

                    if (numberArr.length < playerCards.length) {
                        var needLCount = playerCards.length - numberArr.length;

                        if (laiziCards.length >= needLCount) {
                            for (var k = 0; k < needLCount; k++) {
                                numberArr.push(laiziCards[k].number);
                            }
                            result.push(numberArr);
                        }

                    } else {
                        result.push(numberArr);
                    }

                }

            }
        }

        //存在癞子牌时加入软炸弹判断
        result = result.concat(getSoftBomb());

        for (var i = 0; i < fourList.length; i++) {
            result.push(countArr[fourList[i]].numbers);
        }
    }
    else if (playerCardType === CardType.c123) {
        var playerWeight = playerCards[0].weight;
        var playerLength = playerCards.length;

        var singleCards = getSingleCards(myCards, laiziCards);
        var singleCardsArr = singleCards.cardsArr;

        singleCardsArr.sort(function (a, b) {
            return a.weight - b.weight
        });

        for (var i = 0; i < singleCardsArr.length; i++) {
            if (singleCardsArr[i].weight <= playerWeight) {
                continue;
            }
            var tempList = singleCardsArr.slice(i, playerLength + i);
            var weightList = [];
            var sequenceNumArr = [];
            for (var j = 0; j < tempList.length; j++) {
                weightList.push(tempList[j].weight);
                if (tempList[j].weight < playerLength + singleCardsArr[i].weight
                    && tempList[j].weight < 15) {
                    sequenceNumArr.push(tempList[j].cards[0].number);
                }
            }

            if (sequenceNumArr.length === playerLength && isSequenceArr(weightList)) {
                result.push(sequenceNumArr);
            }
            if (sequenceNumArr.length < playerLength) {
                var needLaiziCount = playerLength - sequenceNumArr.length;
                var lastLaizi = getExpectCards(laiziCards, sequenceNumArr);
                if (lastLaizi.length >= needLaiziCount) {
                    var res = [].concat(sequenceNumArr);
                    for (var j = 0; j < needLaiziCount; j++) {
                        res.push(lastLaizi[j].number);
                    }
                    result.push(res);
                }
            }

        }

        //存在癞子牌时加入软炸弹判断
        result = result.concat(getSoftBomb());

        for (var i = 0; i < fourList.length; i++) {
            result.push(countArr[fourList[i]].numbers);
        }
    }
    else if (playerCardType === CardType.c1122) {
        var playerWeight = playerCards[0].weight;
        var playerLength = playerCards.length / 2;

        var pairCards = getPairCards(myCards, laiziCards).cardsArr;

        pairCards.sort(function (a, b) {
            return a.weight - b.weight
        });

        for (var i = 0; i < pairCards.length; i++) {

            if (pairCards[i].weight <= playerWeight) {
                continue;
            }
            var tempList = pairCards.slice(i, playerLength + i);
            var weightList = [];
            var sequenceNumArr = [];
            for (var j = 0; j < tempList.length; j++) {
                weightList.push(tempList[j].weight);
                if (tempList[j].weight < playerLength + pairCards[i].weight) {
                    if (!tempList[j].cards[0].isLaizi) {
                        sequenceNumArr.push(tempList[j].cards[0].number);
                    }
                    if (!tempList[j].cards[1].isLaizi) {
                        sequenceNumArr.push(tempList[j].cards[1].number);
                    }
                }
            }

            if (weightList.length === playerLength && isSequenceArr(weightList)) {
                if (sequenceNumArr.length < playerCards.length) {
                    var needLCount = playerCards.length - sequenceNumArr.length;
                    if (laiziCards.length >= needLCount) {
                        for (var j = 0; j < needLCount; j++) {
                            sequenceNumArr.push(laiziCards[j].number);
                        }
                        result.push(sequenceNumArr);
                    }

                } else {
                    result.push(sequenceNumArr);
                }
            }

        }

        //存在癞子牌时加入软炸弹判断
        result = result.concat(getSoftBomb());

        for (var i = 0; i < fourList.length; i++) {
            result.push(countArr[fourList[i]].numbers);
        }
    }
    else if (playerCardType === CardType.c111222) {
        var playerWeight = playerCards[0].weight;
        var playerLength = playerCards.length / 3;

        var threeCardsArr = getThreeCards(myCards, laiziCards).cardsArr;

        threeCardsArr.sort(function (a, b) {
            return a.weight - b.weight
        });

        for (var i = 0; i < threeCardsArr.length; i++) {
            if (threeCardsArr[i].weight <= playerWeight) {
                continue;
            }
            var tempList = threeCardsArr.slice(i, playerLength + i);
            var weightList = [];
            var sequenceNumArr = [];
            for (var j = 0; j < tempList.length; j++) {
                weightList.push(tempList[j].weight);
                if (tempList[j].weight < playerLength + threeCardsArr[i].weight) {
                    if (!tempList[j].cards[0].isLaizi) {
                        sequenceNumArr.push(tempList[j].cards[0].number);
                    }
                    if (!tempList[j].cards[1].isLaizi) {
                        sequenceNumArr.push(tempList[j].cards[1].number);
                    }
                    if (!tempList[j].cards[2].isLaizi) {
                        sequenceNumArr.push(tempList[j].cards[2].number);
                    }
                }
            }

            if (weightList.length === playerLength && isSequenceArr(weightList)) {
                if (sequenceNumArr.length < playerCards.length) {
                    var needLCount = playerCards.length - sequenceNumArr.length;
                    if (laiziCards.length >= needLCount) {
                        for (var j = 0; j < needLCount; j++) {
                            sequenceNumArr.push(laiziCards[j].number);
                        }
                        result.push(sequenceNumArr);
                    }

                } else {
                    result.push(sequenceNumArr);
                }
            }

        }

        //存在癞子牌时加入软炸弹判断
        result = result.concat(getSoftBomb());

        for (var i = 0; i < fourList.length; i++) {
            result.push(countArr[fourList[i]].numbers);
        }
    }
    else if (playerCardType === CardType.c11122234) {
        var playerWeight = getPlaneMinWeight(playerCards, playerCardType)[0];
        var playerLength = playerCards.length / 4;

        var threeCardsArr = getThreeCards(myCards, laiziCards).cardsArr;

        var allCards = myCards.concat(laiziCards);

        threeCardsArr.sort(function (a, b) {
            return a.weight - b.weight
        });

        for (var i = 0; i < threeCardsArr.length; i++) {
            if (threeCardsArr[i].weight <= playerWeight) {
                continue;
            }
            var tempList = threeCardsArr.slice(i, playerLength + i);
            var weightList = [];
            var sequenceNumArr = [];
            for (var j = 0; j < tempList.length; j++) {
                weightList.push(tempList[j].weight);
                if (tempList[j].weight < playerLength + threeCardsArr[i].weight) {
                    if (!tempList[j].cards[0].isLaizi) {
                        sequenceNumArr.push(tempList[j].cards[0].number);
                    }
                    if (!tempList[j].cards[1].isLaizi) {
                        sequenceNumArr.push(tempList[j].cards[1].number);
                    }
                    if (!tempList[j].cards[2].isLaizi) {
                        sequenceNumArr.push(tempList[j].cards[2].number);
                    }
                }
            }

            if (weightList.length === playerLength && isSequenceArr(weightList)) {

                var res = [];

                if (sequenceNumArr.length < playerCards.length) {
                    var needLCount = playerLength * 3 - sequenceNumArr.length;
                    if (laiziCards.length >= needLCount) {
                        for (var j = 0; j < needLCount; j++) {
                            sequenceNumArr.push(laiziCards[j].number);
                        }
                        res = res.concat(sequenceNumArr);

                        var tempArr = getExpectCards(allCards, res);
                        if (tempArr.length >= playerLength) {
                            for (var j = 0; j < playerLength; j++) {
                                res.push(tempArr[j].number);
                            }
                            result.push(res);
                        }
                    }

                } else {
                    res = res.concat(sequenceNumArr);
                    var tempArr = getExpectCards(allCards, res);
                    if (tempArr.length >= playerLength) {
                        for (var j = 0; j < playerLength; j++) {
                            res.push(tempArr[j].number);
                        }
                        result.push(res);
                    }

                }
            }

        }

        //存在癞子牌时加入软炸弹判断
        result = result.concat(getSoftBomb());

        for (var i = 0; i < fourList.length; i++) {
            result.push(countArr[fourList[i]].numbers);
        }
    }
    else if (playerCardType === CardType.c1112223344) {
        var playerWeight = getPlaneMinWeight(playerCards, playerCardType)[0];
        var playerLength = playerCards.length / 5;

        var threeCardsArr = getThreeCards(myCards, laiziCards).cardsArr;

        threeCardsArr.sort(function (a, b) {
            return a.weight - b.weight
        });

        for (var i = 0; i < threeCardsArr.length; i++) {
            if (threeCardsArr[i].weight <= playerWeight) {
                continue;
            }
            var tempList = threeCardsArr.slice(i, playerLength + i);
            var weightList = [];
            var sequenceNumArr = [];
            for (var j = 0; j < tempList.length; j++) {
                if (tempList[j].weight > 14) {
                    continue;
                }

                weightList.push(tempList[j].weight);
                if (tempList[j].weight < playerLength + threeCardsArr[i].weight) {
                    if (!tempList[j].cards[0].isLaizi) {
                        sequenceNumArr.push(tempList[j].cards[0].number);
                    }
                    if (!tempList[j].cards[1].isLaizi) {
                        sequenceNumArr.push(tempList[j].cards[1].number);
                    }
                    if (!tempList[j].cards[2].isLaizi) {
                        sequenceNumArr.push(tempList[j].cards[2].number);
                    }
                }
            }

            if (weightList.length === playerLength && isSequenceArr(weightList)) {

                var normals = getExpectCards(myCards, sequenceNumArr);

                var laizis = getExpectCards(laiziCards, sequenceNumArr);

                var pairCardsArr = getPairCards(normals, laizis).cardsArr;

                if (pairCardsArr.length >= playerLength) {
                    for (var j = 0; j < pairCardsArr.length - 1; j++) {

                        var res = [].concat(sequenceNumArr);

                        if (!pairCardsArr[j].cards[0].isLaizi) {
                            res.push(pairCardsArr[j].cards[0].number);
                        }
                        if (!pairCardsArr[j].cards[1].isLaizi) {
                            res.push(pairCardsArr[j].cards[1].number);
                        }
                        if (!pairCardsArr[j + 1].cards[0].isLaizi) {
                            res.push(pairCardsArr[j + 1].cards[0].number);
                        }
                        if (!pairCardsArr[j + 1].cards[1].isLaizi) {
                            res.push(pairCardsArr[j + 1].cards[1].number);
                        }

                        if (res.length < playerCards.length) {
                            var needLCount = playerCards.length - res.length;
                            if (laiziCards.length >= needLCount) {
                                for (var j = 0; j < needLCount; j++) {
                                    res.push(laiziCards[j].number);
                                }
                                result.push(res);
                            }

                        } else {
                            result.push(res);
                        }

                    }
                }

            }

        }

        //存在癞子牌时加入软炸弹判断
        result = result.concat(getSoftBomb());

        for (var i = 0; i < fourList.length; i++) {
            result.push(countArr[fourList[i]].numbers);
        }
    }

    if (getRocket().length > 0) {
        result.push(getRocket());
    }

    return result;

};

// test
var getExpectCards = function (cardList, exceptNumList){
    var result = [];
    for(var i = 0; i<cardList.length; i++){
        var include = false;
        for(var j = 0; j<exceptNumList.length; j++){
            if(cardList[i].number === exceptNumList[j]){
                include = true;
                break;
            }
        }
        if(!include){
            result.push(cardList[i]);
        }
    }
    return result;
};
//
// var getPromptCards = function (playerCards, myCards, laiziValue) {
//     if (playerCards && playerCards.length && _.isNumber(playerCards[0]))
//         playerCards = toCardsArr(playerCards);
//
//     if (!playerCards || playerCards.length === 0){
//         return [];
//     }
//
//     if (playerCards && playerCards.length)
//         playerCards.sort(function (a, b) {
//             return a.weight - b.weight
//         });
//
//     var playerCardType = judgeType(playerCards);
//
//     if (availableCardTypes.indexOf(playerCardType) < 0) {
//         return [];
//     }
//     if (playerCardType === CardType.c42) {
//         return [];
//     }
//
//     if (!myCards || myCards.length === 0){
//         return [];
//     }
//
//     if (myCards && myCards.length && _.isNumber(myCards[0]))
//         myCards = toCardsArr(myCards);
//
//     var laiziCards = [];
//     myCards = myCards || [];
//
//
//     for (var j = myCards.length - 1; j >= 0; j--) {
//         if (isLaizi(myCards[j].number, laiziValue)) {
//             myCards[j].isLaizi = true;
//             laiziCards.push(myCards[j]);
//             myCards.splice(j, 1);
//         }
//     }
//     if (laiziCards.length)
//         laiziCards.sort(function (a, b) {
//             return a.weight - b.weight
//         });
//     if (myCards && myCards.length)
//         myCards.sort(function (a, b) {
//             return a.weight - b.weight
//         });
//
//     var laiziCardsStr = '';
//     var cardStr = '';
//     var weightStr = '';
//     var playerWeightStr = '';
//     for (var j = myCards.length - 1; j >= 0; j--) {
//         cardStr += myCards[j].number+','
//         weightStr += myCards[j].weight+','
//     }
//
//     for (var j = playerCards.length - 1; j >= 0; j--) {
//         playerWeightStr += playerCards[j].weight+','
//     }
//
//     for (var j = laiziCards.length - 1; j >= 0; j--) {
//         laiziCardsStr += laiziCards[j].weight+','
//     }
//
//     var countArr = analyzeCardsData(myCards);
//     var laiziCountArr = analyzeCardsData(laiziCards);
//
//     var fourList = [];
//     var fourList_laizi = [];
//     var threeList = [];
//     var threeList_laizi = [];
//     var twoList = [];
//     var twoList_laizi = [];
//     var oneList = [];
//     var oneList_laizi = [];
//     for (i = 0; i < countArr.length; i++) {
//         if (countArr[i].count === 4) {
//             fourList.push(i);
//         } else if (countArr[i].count === 3) {
//             threeList.push(i);
//         } else if (countArr[i].count === 2) {
//             twoList.push(i);
//         } else if (countArr[i].count === 1) {
//             oneList.push(i);
//         }
//     }
//
//     for (i = 0; i < laiziCountArr.length; i++) {
//         if (laiziCountArr[i].count === 4) {
//             fourList_laizi.push(i);
//         } else if (laiziCountArr[i].count === 3) {
//             threeList_laizi.push(i);
//         } else if (laiziCountArr[i].count === 2) {
//             twoList_laizi.push(i);
//         } else if (laiziCountArr[i].count === 1) {
//             oneList_laizi.push(i);
//         }
//     }
//
//     console.log('cardStr:'+cardStr);
//     console.log('playerWeightStr:'+playerWeightStr);
//     console.log('      weightStr:'+weightStr);
//     console.log('  laiziCardsStr:'+laiziCardsStr);
//     console.log('fourList:'+fourList);
//     console.log('threeList:'+threeList);
//     console.log('twoList:'+twoList);
//     console.log('oneList:'+oneList);
//
//     var getRocket = function () {
//         var a = myCards[myCards.length-1];
//         var b = myCards[myCards.length-2];
//         if(a.number === 53 && b.number === 52){
//             return [52, 53];
//         }
//         return [];
//     };
//
//     var getSoftBomb = function () {
//
//         var res = [];
//
//         var laiziLen = laiziCards.length;
//
//         for(var i = 1; i <= laiziLen; i++){
//             var useLaizis =  laiziCards.slice(0, i);
//
//             var tempLaizi = [];
//             for(var k = 0; k<useLaizis.length; k++){
//                 tempLaizi.push(useLaizis[k].number);
//             }
//
//             for(var j = 0; j<fourList.length; j++){
//                 res.push(countArr[fourList[j]].numbers.concat(tempLaizi));
//             }
//
//             if(i>=1){
//                 for(var j = 0; j<threeList.length; j++){
//                     res.push(countArr[threeList[j]].numbers.concat(tempLaizi));
//                 }
//             }
//
//             if(i>=2){
//                 for(var j = 0; j<twoList.length; j++){
//                     res.push(countArr[twoList[j]].numbers.concat(tempLaizi));
//                 }
//             }
//
//             if(i>=3){
//                 for(var j = 0; j<oneList.length; j++){
//                     res.push(countArr[oneList[j]].numbers.concat(tempLaizi));
//                 }
//             }
//
//         }
//
//         return res;
//
//     };
//
//     var getSingleCards = function (normalCards, laiziCards) {
//
//         var cardArr = normalCards.concat(laiziCards);
//         cardArr.sort(function (a, b) {
//             return a.weight - b.weight
//         });
//
//         var numbers = [];
//         var cardsArr = [];
//         for(var i = 0; i< cardArr.length; i++){
//             if(numbers.indexOf(cardArr[i].number) < 0){
//                 cardsArr.push({weight: cardArr[i].weight, cards: [cardArr[i]]});
//                 numbers.push(cardArr[i].number);
//             }
//         }
//
//         return {cardsArr: cardsArr, numbers: numbers};
//     };
//
//     var getPairCards = function (normalCards, laiziCards) {
//
//         var cardArr = normalCards.concat(laiziCards);
//
//         var numbers = [];
//         var cardsArr = [];
//
//         var tempWeight = [];
//
//         cardArr.sort(function (a, b) {
//             return a.weight - b.weight
//         });
//         for(var i=0; i<cardArr.length-1; i++){
//             if(cardArr[i].value === cardArr[i+1].value){
//
//                 if(tempWeight.indexOf(cardArr[i].weight)>=0){
//                     continue;
//                 }
//
//                 numbers.push(cardArr[i].number);
//                 numbers.push(cardArr[i+1].number);
//                 cardsArr.push({weight: cardArr[i].weight,
//                     cards: [cardArr[i], cardArr[i+1]]});
//
//                 tempWeight.push(cardArr[i].weight);
//
//             }
//         }
//         if(laiziCards.length>0){
//             for(var i=0; i< laiziCards.length; i++){
//                 var laizi = laiziCards[i];
//                 var lastLaiziCards = getExpectCards(laiziCards, [laiziCards[i].number]);
//                 var singleCards = getSingleCards(normalCards, lastLaiziCards);
//                 var singleCardsArr = singleCards.cardsArr;
//                 for(var j=0; j< singleCardsArr.length; j++){
//                     if(singleCardsArr[j].weight < 16){
//
//                         if(tempWeight.indexOf(singleCardsArr[j].weight) >= 0){
//                             continue;
//                         }
//
//                         numbers.push(singleCardsArr[j].cards[0].number);
//                         numbers.push(laizi.number);
//                         cardsArr.push({weight: singleCardsArr[j].cards[0].weight,
//                             cards: [singleCardsArr[j].cards[0], laizi]});
//
//                         tempWeight.push(singleCardsArr[j].weight);
//                     }
//
//                 }
//             }
//         }
//
//         return {cardsArr: cardsArr, numbers: numbers};
//     };
//
//     var getThreeCards = function (normalCards, laiziCards) {
//
//         var cardArr = normalCards.concat(laiziCards);
//
//         var numbers = [];
//         var cardsArr = [];
//
//         var tempWeight = [];
//
//         cardArr.sort(function (a, b) {
//             return a.weight - b.weight
//         });
//         for(var i=0; i<cardArr.length-2; i++){
//             if(cardArr[i].value === cardArr[i+1].value &&
//                 cardArr[i].value === cardArr[i+2].value){
//
//                 if(tempWeight.indexOf(cardArr[i].weight)>=0){
//                     continue;
//                 }
//
//                 numbers.push(cardArr[i].number);
//                 numbers.push(cardArr[i+1].number);
//                 numbers.push(cardArr[i+2].number);
//                 cardsArr.push({weight: cardArr[i].weight,
//                     cards: [cardArr[i], cardArr[i+1], cardArr[i+2]]});
//
//                 tempWeight.push(cardArr[i].weight);
//
//             }
//         }
//
//         if(laiziCards.length>0){
//             for(var i=0; i< laiziCards.length; i++){
//                 var laizi = laiziCards[i];
//                 var lastLaiziCards = getExpectCards(laiziCards, [laiziCards[i].number]);
//                 var pairCards = getPairCards(normalCards, lastLaiziCards);
//                 var pairCardsArr = pairCards.cardsArr;
//                 for(var j=0; j< pairCardsArr.length; j++){
//
//                     if(tempWeight.indexOf(pairCardsArr[j].cards[0].weight)>=0){
//                         continue;
//                     }
//
//                     numbers.push(pairCardsArr[j].cards[0].number);
//                     numbers.push(pairCardsArr[j].cards[1].number);
//                     numbers.push(laizi.number);
//                     cardsArr.push({weight: pairCardsArr[j].cards[0].weight,
//                         cards: [pairCardsArr[j].cards[0],
//                             pairCardsArr[j].cards[1], laizi]});
//
//                     tempWeight.push(pairCardsArr[j].cards[0].weight);
//                 }
//             }
//         }
//
//         if(laiziCards.length>1){
//             for(var i=0; i< laiziCards.length-1; i++){
//                 var laizi1 = laiziCards[i];
//                 var laizi2 = laiziCards[i+1];
//
//                 var lastLaiziCards = getExpectCards(laiziCards, [laizi1.number, laizi2.number]);
//                 var singleCards = getSingleCards(normalCards, lastLaiziCards);
//                 var singleCardsArr = singleCards.cardsArr;
//                 for(var j=0; j< singleCardsArr.length; j++){
//                     if(singleCardsArr[j].weight < 16){
//
//                         if(tempWeight.indexOf(singleCardsArr[j].cards[0].weight)>=0){
//                             continue;
//                         }
//
//                         numbers.push(singleCardsArr[j].cards[0].number);
//                         numbers.push(laizi1.number);
//                         numbers.push(laizi2.number);
//                         cardsArr.push({weight: singleCardsArr[j].cards[0].weight,
//                             cards: [singleCardsArr[j].cards[0],
//                                 laizi1, laizi2]});
//
//                         tempWeight.push(singleCardsArr[j].cards[0].weight);
//
//                     }
//                 }
//             }
//         }
//
//         return {cardsArr: cardsArr, numbers: numbers};
//     };
//
//     var result = [];
//     if(playerCardType === CardType.c1){
//
//         var singleCards = getSingleCards(myCards, laiziCards);
//
//         for(var i = 0; i<singleCards.cardsArr.length; i++){
//             if(singleCards.cardsArr[i].weight > playerCards[0].weight){
//                 result.push([singleCards.cardsArr[i].cards[0].number]);
//             }
//         }
//
//         //存在癞子牌时加入软炸弹判断
//         result = result.concat(getSoftBomb());
//
//         for(var i = 0; i<fourList.length; i++){
//             result.push(countArr[fourList[i]].numbers);
//         }
//
//     }
//     else if(playerCardType === CardType.c2){
//         var playerWeight = playerCards[0].weight;
//
//         var pairCards = getPairCards(myCards, laiziCards);
//
//         for(var i = 0; i<pairCards.cardsArr.length; i++){
//             if(pairCards.cardsArr[i].weight > playerWeight){
//                 result.push([pairCards.cardsArr[i].cards[0].number,
//                     pairCards.cardsArr[i].cards[1].number]);
//             }
//         }
//
//         //存在癞子牌时加入软炸弹判断
//         result = result.concat(getSoftBomb());
//
//         for(var i = 0; i<fourList.length; i++){
//             result.push(countArr[fourList[i]].numbers);
//         }
//
//     }
//     else if(playerCardType === CardType.c3){
//         var playerWeight = playerCards[0].weight;
//
//         var threeCards = getThreeCards(myCards, laiziCards);
//
//         for(var i = 0; i<threeCards.cardsArr.length; i++){
//             if(threeCards.cardsArr[i].weight > playerWeight){
//                 result.push([threeCards.cardsArr[i].cards[0].number,
//                     threeCards.cardsArr[i].cards[1].number,
//                     threeCards.cardsArr[i].cards[2].number]
//                 );
//             }
//         }
//
//         //存在癞子牌时加入软炸弹判断
//         result = result.concat(getSoftBomb());
//
//         for(var i = 0; i<fourList.length; i++){
//             result.push(countArr[fourList[i]].numbers);
//         }
//
//     }
//     else if(playerCardType === CardType.c4){
//
//         var playerWeight = getBombWeight(playerCards);
//
//         //存在癞子牌时加入软炸弹判断
//         var bombs = getSoftBomb();
//         for(var i = 0; i<bombs.length; i++){
//             if(bombs[i].length>playerCards.length){
//                 result.push(bombs[i]);
//             }
//         }
//
//         for(var i = 0; i<fourList.length; i++){
//             var bombWeight = getBombWeight(toCardsArr(countArr[fourList[i]].numbers));
//             if(bombWeight > playerWeight){
//                 result.push(countArr[fourList[i]].numbers);
//             }
//         }
//
//     }
//     else if(playerCardType === CardType.c31){
//         var playerCount = analyzeCards(playerCards);
//         var threeList2 = [];
//         var oneList2 = [];
//         for (i = 0; i < playerCount.length; i++) {
//             if (playerCount[i] === 3) {
//                 threeList2.push(i);
//             } else if (playerCount[i] === 1) {
//                 oneList2.push(i);
//             }
//         }
//         var playerWeight = threeList2[0] + 3;
//
//         var threeCards = getThreeCards(myCards, laiziCards);
//
//         var allCards = myCards.concat(laiziCards);
//
//         for(var i = 0; i<threeCards.cardsArr.length; i++){
//             if(threeCards.cardsArr[i].weight > playerWeight){
//                 var tempArr = getExpectCards(allCards, [threeCards.cardsArr[i].cards[0].number,
//                     threeCards.cardsArr[i].cards[1].number,
//                     threeCards.cardsArr[i].cards[2].number]);
//
//                 for(var j=0; j<tempArr.length; j++){
//                     result.push([threeCards.cardsArr[i].cards[0].number,
//                         threeCards.cardsArr[i].cards[1].number,
//                         threeCards.cardsArr[i].cards[2].number,
//                         tempArr[j].number]
//                     );
//                 }
//             }
//         }
//
//         //存在癞子牌时加入软炸弹判断
//         result = result.concat(getSoftBomb());
//
//         for(var i = 0; i<fourList.length; i++){
//             result.push(countArr[fourList[i]].numbers);
//         }
//
//
//     }
//     else if(playerCardType === CardType.c32){
//         var playerCount = analyzeCards(playerCards);
//         var threeList2 = [];
//         var twoList2 = [];
//         for (i = 0; i < playerCount.length; i++) {
//             if (playerCount[i] === 3) {
//                 threeList2.push(i);
//             } else if (playerCount[i] === 2) {
//                 twoList2.push(i);
//             }
//         }
//         var playerWeight = threeList2[0] + 3;
//
//         var threeCards = getThreeCards(myCards, laiziCards);
//
//         for(var i = 0; i<threeCards.cardsArr.length; i++){
//             if(threeCards.cardsArr[i].weight > playerWeight){
//
//                 var normals = getExpectCards(myCards, [threeCards.cardsArr[i].cards[0].number,
//                     threeCards.cardsArr[i].cards[1].number,
//                     threeCards.cardsArr[i].cards[2].number]);
//                 var laizis = getExpectCards(laiziCards, [threeCards.cardsArr[i].cards[0].number,
//                     threeCards.cardsArr[i].cards[1].number,
//                     threeCards.cardsArr[i].cards[2].number]);
//
//                 var pairCards = getPairCards(normals, laizis);
//
//
//                 for(var j=0; j<pairCards.length; j++){
//                     result.push([threeCards.cardsArr[i].cards[0].number,
//                         threeCards.cardsArr[i].cards[1].number,
//                         threeCards.cardsArr[i].cards[2].number,
//                         pairCards.cardsArr[j].cards[0].number,
//                         pairCards.cardsArr[j].cards[1].number
//                         ]
//                     );
//                 }
//             }
//         }
//
//         //存在癞子牌时加入软炸弹判断
//         result = result.concat(getSoftBomb());
//
//         for(var i = 0; i<fourList.length; i++){
//             result.push(countArr[fourList[i]].numbers);
//         }
//
//
//     }
//     else if(playerCardType === CardType.c411){
//
//         var playerCount = analyzeCards(playerCards);
//         var fourList2 = [];
//         var oneList2 = [];
//         for (i = 0; i < playerCount.length; i++) {
//             if (playerCount[i] === 4) {
//                 fourList2.push(i);
//             } else if (playerCount[i] === 1) {
//                 oneList2.push(i);
//             }
//         }
//
//         var playerWeight = fourList2[0] + 3;
//
//         for(var i = 0; i<fourList.length; i++){
//             if(fourList[i]+3 > playerWeight){
//                 var arr = deepCopy(countArr[fourList[i]].numbers);
//                 var arr2 = getExpectCards(myCards, arr);
//
//                 for(var j = 0; j<arr2.length-1; j++){
//                     var arr3 = deepCopy(arr);
//                     arr3.push(arr2[j].number);
//                     for(var k = j+1; k<arr2.length; k++){
//                         var arr4 = deepCopy(arr3);
//                         arr4.push(arr2[k].number);
//                         result.push(arr4);
//                     }
//                 }
//             }
//         }
//
//         //存在癞子时判断加上癞子牌的牌型
//         // result = result.concat(getLaiziChangeCards(CardType.c411));
//
//         var allCards = myCards.concat(laiziCards);
//
//         var bombCards = getSoftBomb();
//
//         for(var i = 0; i<bombCards.length; i++){
//             var tempCards = bombCards[i].slice(0, 4);
//             if(tempCards[0].weight > playerWeight){
//
//                 var tempArr = getExpectCards(allCards, [tempCards[0].number,
//                     tempCards[1].number,
//                     tempCards[2].number,
//                     tempCards[3].number]);
//
//                 for(var j=0; j<tempArr.length-1; j++){
//                     result.push([
//                         tempCards[0].number,
//                         tempCards[1].number,
//                         tempCards[2].number,
//                         tempCards[4].number,
//                         tempArr[j].number,
//                         tempArr[j+1].number
//                         ]
//                     );
//                 }
//
//             }
//         }
//
//
//         //存在癞子牌时加入软炸弹判断
//         result = result.concat(bombCards);
//
//         for(var i = 0; i<fourList.length; i++){
//             result.push(countArr[fourList[i]].numbers);
//         }
//
//     }
//     else if(playerCardType === CardType.c422){
//         var playerCount = analyzeCards(playerCards);
//         var fourList2 = [];
//         var twoList2 = [];
//         for (i = 0; i < playerCount.length; i++) {
//             if (playerCount[i] === 4) {
//                 fourList2.push(i);
//             } else if (playerCount[i] === 2) {
//                 twoList2.push(i);
//             }
//         }
//
//         var playerWeight = fourList2[0] + 3;
//
//         for(var i = 0; i<fourList.length; i++){
//             if(fourList[i]+3 > playerWeight){
//                 var arr = deepCopy(countArr[fourList[i]].numbers);
//                 var arr1 = getExpectCards(myCards, countArr[fourList[i]].numbers);
//                 var countArr1 = analyzeCardsData(arr1);
//
//                 var fourList1 = [];
//                 var threeList1 = [];
//                 var twoList1 = [];
//                 var oneList1 = [];
//
//                 for (j = 0; j < countArr1.length; j++) {
//                     if (countArr1[j].count === 4) {
//                         fourList1.push(j);
//                     } else if (countArr1[j].count === 3) {
//                         threeList1.push(j);
//                     } else if (countArr1[j].count === 2) {
//                         twoList1.push(j);
//                     } else if (countArr1[j].count === 1) {
//                         oneList1.push(j);
//                     }
//                 }
//
//                 var tempList = [];
//                 tempList = tempList.concat(twoList1);
//                 tempList = tempList.concat(threeList1);
//                 tempList = tempList.concat(fourList1);
//
//                 tempList.sort(compareTwoNumbers);
//
//                 for(var j=0; j<tempList.length-1; j++){
//                     var arr2 = deepCopy(arr);
//                     arr2 = arr2.concat(countArr[tempList[j]].numbers.slice(0, 2));
//                     for(var k=j+1; k<tempList.length; k++){
//                         var arr3 = deepCopy(arr2);
//                         arr3 = arr3.concat(countArr[tempList[k]].numbers.slice(0, 2));
//                         result.push(arr3);
//                     }
//                 }
//
//             }
//         }
//
//         // //存在癞子时判断加上癞子牌的牌型
//         // result = result.concat(getLaiziChangeCards(CardType.c422));
//
//         var bombCards = getSoftBomb();
//
//         for(var i = 0; i<bombCards.length; i++){
//             var tempCards = bombCards[i].slice(0, 4);
//             if(tempCards[0].weight > playerWeight){
//
//                 var normals = getExpectCards(myCards, [tempCards[0].number,
//                     tempCards[1].number,
//                     tempCards[2].number,
//                     tempCards[3].number]);
//
//                 var laizis = getExpectCards(laiziCards, [tempCards[0].number,
//                     tempCards[1].number,
//                     tempCards[2].number,
//                     tempCards[3].number]);
//
//                 var pairCards = getPairCards(normals, laizis);
//
//                 for(var j=0; j<pairCards.length-1; j++){
//                     result.push([
//                         tempCards[0].number,
//                         tempCards[1].number,
//                         tempCards[2].number,
//                         tempCards[3].number,
//                         pairCards.cardsArr[j].cards[0].number,
//                         pairCards.cardsArr[j].cards[1].number,
//                         pairCards.cardsArr[j+1].cards[0].number,
//                         pairCards.cardsArr[j+1].cards[1].number
//                         ]
//                     );
//                 }
//
//             }
//         }
//
//
//         //存在癞子牌时加入软炸弹判断
//         result = result.concat(bombCards);
//
//         for(var i = 0; i<fourList.length; i++){
//             result.push(countArr[fourList[i]].numbers);
//         }
//
//
//     }
//     else if(playerCardType === CardType.c123){
//         var playerWeight = playerCards[0].weight;
//         var playerLength = playerCards.length;
//
//         var singleCards = getSingleCards(myCards, laiziCards);
//         var singleCardsArr = singleCards.cardsArr;
//
//         singleCardsArr.sort(function (a, b) {
//             return a.weight - b.weight
//         });
//
//         for(var i=0; i<singleCardsArr.length; i++){
//             if(singleCardsArr[i].weight <= playerWeight){
//                 continue;
//             }
//             var tempList = singleCardsArr.slice(i, playerLength+i);
//             var weightList = [];
//             var sequenceNumArr = [];
//             for(var j=0;j<tempList.length;j++){
//                 weightList.push(tempCards[j].weight);
//                 if(tempCards[j].weight < playerLength+tempCards[j].weight){
//                     sequenceNumArr.push(tempCards[j].cards[0].number);
//                 }
//             }
//
//             if(isSequenceArr(weightList)){
//                 result.push(sequenceNumArr);
//             }
//             if(sequenceNumArr.length < playerLength) {
//                 var needLaiziCount = playerLength - sequenceNumArr.length;
//                 var lastLaizi = getExpectCards(laiziCards, sequenceNumArr);
//                 if(lastLaizi.length >= needLaiziCount){
//                     var res = [];
//                     res = res.concat(sequenceNumArr);
//                     for(var j=0; j<lastLaizi.length; i++){
//                         res.push(lastLaizi[j].number);
//                     }
//                 }
//             }
//
//         }
//
//         //存在癞子牌时加入软炸弹判断
//         result = result.concat(getSoftBomb());
//
//         for(var i = 0; i<fourList.length; i++){
//             result.push(countArr[fourList[i]].numbers);
//         }
//
//     }
//     else if(playerCardType === CardType.c1122){
//
//         var playerWeight = playerCards[0].weight;
//         var playerLength = playerCards.length/2;
//
//         var pairCards = getPairCards(myCards, laiziCards).cardsArr;
//
//         pairCards.sort(function (a, b) {
//             return a.weight - b.weight
//         });
//
//         for(var i=0; i<pairCards.length; i++){
//             if(pairCards[i].weight <= playerWeight){
//                 continue;
//             }
//             var tempList = pairCards.slice(i, playerLength+i);
//             var weightList = [];
//             var sequenceNumArr = [];
//             for(var j=0;j<tempList.length;j++){
//                 weightList.push(tempCards[j].weight);
//                 if(tempCards[j].weight < playerLength+tempCards[j].weight){
//                     sequenceNumArr.push(tempCards[j].cards[0].number);
//                     sequenceNumArr.push(tempCards[j].cards[1].number);
//                 }
//             }
//
//             if(isSequenceArr(weightList)){
//                 result.push(sequenceNumArr);
//             }
//
//         }
//
//
//         //存在癞子牌时加入软炸弹判断
//         result = result.concat(getSoftBomb());
//
//         for(var i = 0; i<fourList.length; i++){
//             result.push(countArr[fourList[i]].numbers);
//         }
//
//     }
//     else if(playerCardType === CardType.c111222){
//
//         var playerWeight = playerCards[0].weight;
//         var playerLength = playerCards.length/3;
//
//         var threeCardsArr = getThreeCards(myCards, laiziCards).cardsArr;
//
//         threeCardsArr.sort(function (a, b) {
//             return a.weight - b.weight
//         });
//
//         for(var i=0; i<threeCardsArr.length; i++){
//             if(threeCardsArr[i].weight <= playerWeight){
//                 continue;
//             }
//             var tempList = threeCardsArr.slice(i, playerLength+i);
//             var weightList = [];
//             var sequenceNumArr = [];
//             for(var j=0;j<tempList.length;j++){
//                 weightList.push(tempList[j].weight);
//                 if(tempList[j].weight < playerLength+threeCardsArr[i].weight){
//                     sequenceNumArr.push(tempList[j].cards[0].number);
//                     sequenceNumArr.push(tempList[j].cards[1].number);
//                     sequenceNumArr.push(tempList[j].cards[2].number);
//                 }
//             }
//
//             if(isSequenceArr(weightList)){
//                 result.push(sequenceNumArr);
//             }
//         }
//
//         //存在癞子牌时加入软炸弹判断
//         result = result.concat(getSoftBomb());
//
//         for(var i = 0; i<fourList.length; i++){
//             result.push(countArr[fourList[i]].numbers);
//         }
//
//
//     }
//     else if(playerCardType === CardType.c11122234){
//
//         var playerWeight = getPlaneMinWeight(playerCards, playerCardType)[0];
//         var playerLength = playerCards.length/4;
//
//         var threeCardsArr = getThreeCards(myCards, laiziCards).cardsArr;
//
//         var allCards = myCards.concat(laiziCards);
//
//         threeCardsArr.sort(function (a, b) {
//             return a.weight - b.weight
//         });
//
//         for(var i=0; i<threeCardsArr.length; i++){
//             if(threeCardsArr[i].weight <= playerWeight){
//                 continue;
//             }
//             var tempList = threeCardsArr.slice(i, playerLength+i);
//             var weightList = [];
//             var sequenceNumArr = [];
//             for(var j=0;j<tempList.length;j++){
//                 weightList.push(tempList[j].weight);
//                 if(tempList[j].weight < playerLength+threeCardsArr[i].weight){
//                     sequenceNumArr.push(tempList[j].cards[0].number);
//                     sequenceNumArr.push(tempList[j].cards[1].number);
//                     sequenceNumArr.push(tempList[j].cards[2].number);
//                 }
//             }
//
//             if(isSequenceArr(weightList)){
//
//                 var res = [].concat(sequenceNumArr);
//
//                 var tempArr = getExpectCards(allCards, res);
//
//                 for(var j=0; j<playerLength; j++){
//                     res.push(tempArr[j].number);
//                 }
//
//                 result.push(res);
//             }
//         }
//
//         //存在癞子牌时加入软炸弹判断
//         result = result.concat(getSoftBomb());
//
//         for(var i = 0; i<fourList.length; i++){
//             result.push(countArr[fourList[i]].numbers);
//         }
//
//     }
//     else if(playerCardType === CardType.c1112223344){
//         var playerWeight = getPlaneMinWeight(playerCards, playerCardType)[0];
//         var playerLength = playerCards.length/5;
//
//         var threeCardsArr = getThreeCards(myCards, laiziCards).cardsArr;
//
//         threeCardsArr.sort(function (a, b) {
//             return a.weight - b.weight
//         });
//
//         for(var i=0; i<threeCardsArr.length; i++){
//             if(threeCardsArr[i].weight <= playerWeight){
//                 continue;
//             }
//             var tempList = threeCardsArr.slice(i, playerLength+i);
//             var weightList = [];
//             var sequenceNumArr = [];
//             for(var j=0;j<tempList.length;j++){
//                 weightList.push(tempList[j].weight);
//                 if(tempList[j].weight < playerLength+threeCardsArr[i].weight){
//                     sequenceNumArr.push(tempList[j].cards[0].number);
//                     sequenceNumArr.push(tempList[j].cards[1].number);
//                     sequenceNumArr.push(tempList[j].cards[2].number);
//                 }
//             }
//
//             if(isSequenceArr(weightList)){
//                 var res = [].concat(sequenceNumArr);
//
//                 var normals = getExpectCards(myCards, sequenceNumArr);
//
//                 var laizis = getExpectCards(laiziCards, sequenceNumArr);
//
//                 var pairCardsArr = getPairCards(normals, laizis).cardsArr;
//
//                 if(pairCardsArr.length>=playerLength){
//                     for(var j=0; j<playerLength; j++){
//                         res.push(pairCardsArr[j].cards[0].number);
//                         res.push(pairCardsArr[j].cards[1].number);
//                     }
//                     result.push(res);
//                 }
//             }
//         }
//
//         //存在癞子牌时加入软炸弹判断
//         result = result.concat(getSoftBomb());
//
//         for(var i = 0; i<fourList.length; i++){
//             result.push(countArr[fourList[i]].numbers);
//         }
//     }
//
//     if(getRocket().length > 0){
//         result.push(getRocket());
//     }
//
//     return result;
//
// }

// var PaiArr = [
//     2, 3, 4, 5, 6, 7, 8, 9, 10,11,12,0, 1,
//     15,16,17,18,19,20,21,22,23,24,25,13,14,
//     28,29,30,31,32,33,34,35,36,37,38,26,27,
//     41,42,43,44,45,46,47,48,49,50,51,39,40,
//     52,53
// ];
//
// var myPaiArr = [2,3,5,6,7,8,9,10,11,12,0,1, 19, 32];
// var playerPaiArr = [4, 17,30, 18, 31, 44];
//
// console.log(getPromptCards(playerPaiArr, myPaiArr, [3,4]));


// console.log(judgeType([2,3,4,15,16,17,28,29,30,0,13,26]));
// console.log(judgeType([47, 34, 1218, 50, 37, 24, 51, 25]));































