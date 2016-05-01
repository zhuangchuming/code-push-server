'use strict';
var bcrypt = require('bcrypt');
var crypto = require('crypto');
var fs = require('fs');
var Q = require('q');
var Promise = Q.Promise;
var qetag = require('../utils/qetag');
var randToken = require('rand-token').generator({
  chars: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  source: crypto.randomBytes
});
var security = module.exports = {
  passwordHash : function(password){
    return bcrypt.hashSync(password, bcrypt.genSaltSync(12));
  },
  passwordVerify: function(password, hash){
    return bcrypt.compareSync(password, hash)
  },
  randToken: function(num) {
    return randToken.generate(num);
  },
  parseToken: function(token) {
    return {identical: token.substr(-9,9), token:token.substr(0,28)}
  },
  fileSha256: function (file) {
    return Promise(function (resolve, reject, notify) {
      var rs = fs.createReadStream(file);
      var hash = crypto.createHash('sha256');
      rs.on('data', hash.update.bind(hash));
      rs.on('end', function () {
        resolve(hash.digest('hex'));
      });
    });
  },
  qetag: function (filePath) {
    return Promise(function (resolve, reject, notify) {
      qetag(filePath, resolve);
    });
  }
};
