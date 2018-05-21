module.exports = WindChecker;
function WindChecker(){
	//私有变量
	var _cnt = 0;
	var _jings = 0;
	var _checkJings = false;
	var _debugStack = null;
	
	function pick(countMap,vmap){
		var needJings = 0;
		for(var k in vmap){
			var n = vmap[k];
			var c = countMap[k];
			if(c == null){
				c = 0;
			}
			if(c < n){
				if(!_checkJings){
					return null;
				}
				else{
					needJings += n - c;
				}
				
			}
		}
		
		if(needJings >= 3){
			return null;
		}

		if(needJings > _jings){
			return null;
		}
		
		var picker = {
			jingUsed:needJings,
			m:vmap
		};
		
		_jings -= needJings;
		for(var k in vmap){
			var n = vmap[k];
			if(countMap[k] != null){
				countMap[k] -= n;	
			}
			_cnt -= n;
		}
		_cnt += needJings;
		if(_debugStack){
			_debugStack.push(picker);			
		}
		return picker;
	}

	function pickone(countMap,k,v){
		return pick(countMap,{[k]:v});
	}

	function pickrow(countMap,a,b,c){
		return pick(countMap,{[a]:1,[b]:1,[c]:1});
	}
	function unpick(countMap,picker){
		for(var k in picker.m){
			var n = picker.m[k];
			if(countMap[k] != null){
				countMap[k]+= n;				
			}
			_cnt+=n;
		}
		_jings += picker.jingUsed;
		_cnt -= picker.jingUsed;
		if(_debugStack){
			_debugStack.pop();			
		}
	}

	function check(countMap){
		if(_cnt == 0){
			return true;
		}
		
		var ret = pickone(countMap,27,3);
		if(ret != null){
			var t = check(countMap);
			unpick(countMap,ret);
			if(t){
				return true;
			}
		}
		
		var ret = pickone(countMap,28,3);
		if(ret != null){
			var t = check(countMap);
			unpick(countMap,ret);
			if(t){
				return true;
			}
		}
		
		var ret = pickone(countMap,29,3);
		if(ret != null){
			var t = check(countMap);
			unpick(countMap,ret);
			if(t){
				return true;
			}
		}
		
		var ret = pickone(countMap,30,3);
		if(ret != null){
			var t = check(countMap);
			unpick(countMap,ret);
			if(t){
				return true;
			}
		}
		
		var ret = pickrow(countMap,27,28,29);
		if(ret != null){
			var t = check(countMap);
			unpick(countMap,ret);
			if(t){
				return true;
			}
		}
		
		var ret = pickrow(countMap,27,28,30);
		if(ret != null){
			var t = check(countMap);
			unpick(countMap,ret);
			if(t){
				return true;
			}
		}
		
		var ret = pickrow(countMap,27,29,30);
		if(ret != null){
			var t = check(countMap);
			unpick(countMap,ret);
			if(t){
				return true;
			}
		}
		
		var ret = pickrow(countMap,28,29,30);
		if(ret != null){
			var t = check(countMap);
			unpick(countMap,ret);
			if(t){
				return true;
			}
		}
		return false;
	}
	
	this.start = function(countMap,jings,checkJings,debugMode){
		_jings = jings;
		_checkJings = checkJings;
		_cnt = 0;
		if(debugMode){
			_debugStack = [];
		}
		for(var k in countMap){
			if(countMap[k] > 0){
				_cnt += countMap[k];
			}
		}
		var t = check(countMap);
		return t;
	}
	
	this.printStack = function(){
		console.log(_debugStack);
	}
}