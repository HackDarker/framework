var ChanCheConfig = require("./niuniu_config").ChanCheConfig;

function randomCards (cards) {
	if (!cards || cards.length == 0) {
		return;
	}
	for (var i = 0; i < cards.length; ++i) {
		var randIndex = Math.floor(Math.random()*cards.length);
		var tmp = cards[i];
		cards[i] = cards[randIndex];
		cards[randIndex] = tmp;
	}
}

function getCardChanCheValue (cardData) {
	var cardValue = getCardValue(cardData);
	if (cardValue > 10) {
		return 10;
	}
	return cardValue;
}

function getCardValue (cardData) {
	return cardData & 0x0f;
}

function getCardColor (cardData) {
	return (cardData & 0xf0) >> 4;
}

function getCardValueToDecimal (cardData) {//转化为10进制的数
	var value = getCardValue(cardData);
	var color = getCardColor(cardData);
	return value + color * 13;
}
function struct_AnalyseResult () {
	return {
		type: ChanCheConfig.Enum.CHAN_CHE_TYPE_MA_SHA,
		maxCard: 0,
		value: 0,
		win : 0,
		multiple :0,
	};
}

function analyseChanCheCards(cards) {
	if (cards.length != 3) {
		console.log("error! card amount must be 3!");
		return;
	}
	var sum = 0;
	var maxCard = {value:0,color:0};
	for (var i = 0; i < cards.length; ++i) {
		sum += getCardChanCheValue(cards[i]);
		var v = getCardValue(cards[i]);
		var c =	getCardColor(cards[i]);
		if(v>maxCard.value) {
			maxCard = {value:v,color:c};
		}
		else if(v == maxCard.value) {
			if(c>maxCard.color) {
				maxCard = {value:v,color:c};
			}
		}
	}
	var ret = struct_AnalyseResult();
	ret.value = sum % 10;
	ret.maxCard = maxCard;

	if(ret.value >= 1&& ret.value <= 6) {
		ret.type = ChanCheConfig.Enum.CHAN_CHE_TYPE_MU_CHAN;
		ret.multiple = 1;
	}
	else if(ret.value >= 7&& ret.value <= 8 ) {
		ret.type = ChanCheConfig.Enum.CHAN_CHE_TYPE_TIE_CHAN;
		ret.multiple = 2;
	}	
	else if(ret.value == 9) {
		if(getCardValue(cards[0]) == 3&&getCardValue(cards[1]) == 3&&getCardValue(cards[2]) == 3) {
			ret.type = ChanCheConfig.Enum.CHAN_CHE_TYPE_ZHI_ZUN_CHAN;
			ret.multiple = 9;
		}
		else {
			ret.type = ChanCheConfig.Enum.CHAN_CHE_TYPE_TONG_CHAN;
			ret.multiple = 3;
		}
	}
	else if(ret.value == 0) {
		if(getCardValue(cards[0]) > 10&&getCardValue(cards[1]) > 10&&getCardValue(cards[2]) > 10) {
			if(getCardValue(cards[0]) == getCardValue(cards[1])&&getCardValue(cards[2]) == getCardValue(cards[0])) {
				ret.type = ChanCheConfig.Enum.CHAN_CHE_TYPE_JIN_CHAN;
				ret.multiple = 6;
			}
			else {
				ret.type = ChanCheConfig.Enum.CHAN_CHE_TYPE_YIN_CHAN;
				ret.multiple = 5;
			}
		}
		else {
			ret.type = ChanCheConfig.Enum.CHAN_CHE_TYPE_MA_SHA;
			ret.multiple = 1;
		}
	}	
	ret.win = ret.type*14*14*14 + ret.value*14*14 + ret.maxCard.value*14 + ret.maxCard.color;
	return ret;
}

function chanCheGetResult(array,length) {
	var s1  = array[length-1].yaScore;
	var s2 = 0;
	for(var k=0;k<length-1;k++) {
		s2 += array[k].allScore;
	}
	if(s2<=s1) {
		array[length-1].getScore = array[length-1].allScore - array[length-1].yaScore + s2;
		for (var k=0;k<length-1;k++) {
			array[k].getScore = -array[k].yaScore;
		}
		return array;
	}
	else {
		array[length-1].getScore = array[length-1].yaScore;
		var S = array[length-1].getScore;
		for(var k=0;k<length-1;k++) { //扣注
			if(S<=array[k].allScore) {
				array[k].allScore -=S;
				break;
			}
			else {
				S -= array[k].allScore;
				array[k].allScore = 0;
			};
		}
		return chanCheGetResult(array,length-1);
	}
}

function analyseCards (cards) {
    var value = [];
    var color = [];
    for (var i = 0; i < cards.length; ++i) {
        var cardValue = getCardValue(cards[i]);
        var cardColor = getCardColor(cards[i]);
        if (value[cardValue] == null) {
            value[cardValue] = [];
        }
        value[cardValue].push(cards[i]);
        if (color[cardColor] == null) {
            color[cardColor] = [];
        }
        color[cardColor].push(cards[i]);
    }
    return {value: value, color: color};
}

function isZhaDan (analyseRes) {
    for (var i = 0; i < analyseRes.value.length; ++i) {
        if (analyseRes.value[i] && analyseRes.value[i].length >= 4) {
            return true;
        }
    }
    return false;
}

function isHulu (analyseRes) {
    var count3 = false;
    var count2 = false;
    for (var i = 0; i < analyseRes.value.length; ++i) {
        if (analyseRes.value[i]) {
            if (analyseRes.value[i].length == 3) {
                count3 = true;
            }
            if (analyseRes.value[i].length == 2) {
                count2 = true;
            }
            if (count3 && count2) {
                return true;
            }
        }
    }
    return false;
}

function isTongHua (analyseRes) {
    var colorCount = 0;
    for (var i = 0; i < analyseRes.color.length; ++i) {
        if (analyseRes.color[i] && analyseRes.color[i].length > 0) {
            ++colorCount;
            if (colorCount > 1) {
                return false;
            }
        }
    }
    return colorCount == 1;
}

function isWuHua (analyseRes) {
    for (var i = 1; i < 10; ++i) {
        if (analyseRes.value[i] && analyseRes.value[i].length > 0) {
            return false;
        }
    }
    return true;
}

function isShunZi (analyseRes) {
    var count = 0;
    var MAX_COUNT = 5;
    var beginValue = 1;
    for (var i = 0; i < analyseRes.value.length + 1 - MAX_COUNT; ++i) {
        if (analyseRes.value[i] && analyseRes.value[i].length > 0) {
            beginValue = i;
            var suc = true;
            for (var j = beginValue + 1; j < beginValue + MAX_COUNT; ++j) {
                if (!(analyseRes.value[j] && analyseRes.value[i].length > 0)) {
                    suc = false;
                    break;
                }
            }
            if (suc) {
                return true;
            }
        }
    }
    return false;
}

function analyseNiuNiuCards (cards, specialTypeOnOff) {
    if (specialTypeOnOff == null) {
        specialTypeOnOff = [true, true, true, true, true];
    }
    var res = analyseCards(cards);
    var maxCard = 0;
    for (var i = 0; i < 13; ++i) {
        var valueArray = res.value[13 - i];
        if (valueArray && valueArray.length > 0) {
            valueArray.sort(function (a, b) {
                return b - a;
            });
            maxCard = valueArray[0];
            break;
        }
    }
    if (specialTypeOnOff[4] && isZhaDan(res)) {
        return {type: 6, maxCard: maxCard};
    }else if (specialTypeOnOff[3] && isHulu(res)) {
        return {type: 5, maxCard: maxCard};
    }else if (specialTypeOnOff[2] && isTongHua(res)) {
        return {type: 4, maxCard: maxCard};
    }else if (specialTypeOnOff[1] && isWuHua(res)) {
        return {type: 3, maxCard: maxCard};
    }else if (specialTypeOnOff[0] && isShunZi(res)) {
        return {type: 2, maxCard: maxCard};
    }else {
        var allArr = [[0,1,2],[0,1,3],[0,1,4],[0,2,3],[0,2,4],[0,3,4],[1,2,3],[1,2,4],[1,3,4],[2,3,4]];
        for (var i = 0; i < allArr.length; ++i) {
            var validCards = [cards[allArr[i][0]], cards[allArr[i][1]], cards[allArr[i][2]]];
            if ((getCardChanCheValue(validCards[0]) + getCardChanCheValue(validCards[1]) + getCardChanCheValue(validCards[2])) % 10 == 0) {
                var niuCount = (getCardChanCheValue(cards[0]) + getCardChanCheValue(cards[1]) + getCardChanCheValue(cards[2]) + getCardChanCheValue(cards[3]) + getCardChanCheValue(cards[4])) % 10;
                return {type: 1, maxCard: maxCard, niuCount:niuCount, validCards: validCards};
            }
        }
    }
    return {type: 0, maxCard: maxCard};
}

function compareNNCard (card1, card2) {
	var value1 = getCardValue(card1);
	var value2 = getCardValue(card2);
	if (value1 == value2) {
		var color1 = getCardColor(card1);
		var color2 = getCardColor(card2);
		return color1 - color2 > 0;
	}
	return value1 - value2 > 0;
}

function compareNNCards (cards1, cards2, specialTypeOnOff) {
	var res1 = analyseNiuNiuCards(cards1, specialTypeOnOff);
	var res2 = analyseNiuNiuCards(cards2, specialTypeOnOff);
	if (res1.type == res2.type) {
		if (res1.type == 1) {
			if (res1.niuCount == res2.niuCount) {
				return compareNNCard(res1.maxCard, res2.maxCard);
			}else {
				var n1 = res1.niuCount;
				var n2 = res2.niuCount;
				if (n1 == 0) {
					n1 = 10;
				}
				if (n2 == 0) {
					n2 = 10;
				}
				return n1 - n2 > 0;
			}
		}else {
			return compareNNCard(res1.maxCard, res2.maxCard);
		}
	}else {
		return res1.type - res2.type > 0;
	}
}

exports.randomCards = randomCards;
exports.getCardValue = getCardValue;
exports.getCardColor = getCardColor;
exports.analyseChanCheCards = analyseChanCheCards;
exports.getCardValueToDecimal = getCardValueToDecimal;
exports.chanCheGetResult = chanCheGetResult;
exports.compareNNCards = compareNNCards;
exports.analyseNiuNiuCards = analyseNiuNiuCards;