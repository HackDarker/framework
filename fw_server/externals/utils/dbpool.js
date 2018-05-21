var MYSQL = require("mysql");
var FIBERS = require('fibers');

var pool = null;

exports.init = function (config) {
    pool = MYSQL.createPool({
        host: config.HOST,
        user: config.USER,
        password: config.PSWD,
        database: config.DB,
        port: config.PORT,
    });
};

exports.query = function (sql, print) {
        if (print) {
            console.log(sql);
        }
        var fc = FIBERS.current;
        var ret = {
            err: null,
            vals: null,
            rows: null,
            fields: null,
        };

        pool.getConnection(function (err, conn) {
            if (err) {
                ret.err = err;
                console.log(err);
                if (fc) {
                    fc.run();
                }
            }
            else {
                conn.query(sql, function (qerr, vals, fields) {
                    if (qerr) {
                        console.log("SQL QUERY ERR:" + sql);
                    }
                    //释放连接
                    conn.release();
                    ret.err = qerr;
                    ret.vals = vals;
                    ret.rows = vals;
                    ret.fields = fields;
                    if (fc) {
                        fc.run();
                    }
                });
            }
        });

        try {
            FIBERS.yield();
        } catch (e) {
            console.log('db query -> ' + sql + ', error -> ' + e);
        }
        return ret;
};