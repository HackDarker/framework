//地球半径
const EARTH_RADIUS = 6378137.0; //单位M
//PI值
const PI = Math.PI;

const EPSINON = 0.00001;

function getRad(d) {
	return d * PI / 180.0;
}

/**
 * 判断是否是0
 * @param {Number} num 
 */
function isZero(num) {
	return Math.abs(num) <= EPSINON;
}

/**
 * 根据GPS两点经纬度信息计算距离
 * @param  {Object} gps_data1 点1GPS信息
 * @param  {Object} gps_data2 点2GPS信息
 * @return {Number}           两点距离
 */
exports.getFlatternDistance = function(gps_data1, gps_data2) {
	if (gps_data1 == null || gps_data2 == null) {
		console.log('invalid gps info');
		return Number.NaN;
	}

	var lat1 = gps_data1.lat;
	var lng1 = gps_data1.lng;
	var lat2 = gps_data2.lat;
	var lng2 = gps_data2.lng;

	if (lat1 == null || lng1 == null ||
		lat2 == null || lng2 == null) {
		console.log('invalid gps info');
		return Number.NaN;
	}

	//数值相等则直接返回0
	if (isZero(lat1 - lat2) && isZero(lng1 - lng2)) {
		return 0;
	}

	var f = getRad((lat1 + lat2) / 2);
	var g = getRad((lat1 - lat2) / 2);
	var l = getRad((lng1 - lng2) / 2);

	var sg = Math.sin(g);
	var sl = Math.sin(l);
	var sf = Math.sin(f);

	var s, c, w, r, d, h1, h2;
	var a = EARTH_RADIUS;
	var fl = 1 / 298.257;

	sg = sg * sg;
	sl = sl * sl;
	sf = sf * sf;

	s = sg * (1 - sl) + (1 - sf) * sl;
	c = (1 - sg) * (1 - sl) + sf * sl;

	w = Math.atan(Math.sqrt(s / c));
	r = Math.sqrt(s * c) / w;
	d = 2 * w * a;
	h1 = (3 * r - 1) / 2 / c;
	h2 = (3 * r + 1) / 2 / s;

	return d * (1 + fl * (h1 * sf * (1 - sg) - h2 * (1 - sf) * sg));
};