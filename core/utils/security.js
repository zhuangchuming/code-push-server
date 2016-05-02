'use strict';
var bcrypt = require('bcrypt');
var crypto = require('crypto');
var fs = require('fs');
var Q = require('q');
var Promise = Q.Promise;
var qetag = require('../utils/qetag');
var _ = require('lodash');

var randToken = require('rand-token').generator({
  chars: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  source: crypto.randomBytes
});
var security = {};
module.exports = security;

security.passwordHash = function(password){
  return bcrypt.hashSync(password, bcrypt.genSaltSync(12));
}

security.passwordVerify = function(password, hash){
  return bcrypt.compareSync(password, hash)
}

security.randToken = function(num) {
  return randToken.generate(num);
}

security.parseToken = function(token) {
  return {identical: token.substr(-9,9), token:token.substr(0,28)}
}

security.fileSha256 = function (file) {
  return Promise(function (resolve, reject, notify) {
    var rs = fs.createReadStream(file);
    var hash = crypto.createHash('sha256');
    rs.on('data', hash.update.bind(hash));
    rs.on('end', function () {
      resolve(hash.digest('hex'));
    });
  });
}

security.stringSha256Sync = function (string) {
  var sha256 = crypto.createHash('sha256');
  sha256.update(string);
  return sha256.digest('hex');
}

security.packageHashSync = function (jsonData) {
  var manifestData = _.map(jsonData, function(v, k){
    return k + ':' + v;
  });
  var manifestString = JSON.stringify(manifestData.sort());
  manifestString = _.replace(manifestString, /\\\//g, '/');
  return security.stringSha256Sync(manifestString);
}

security.qetag = function (filePath) {
  return Promise(function (resolve, reject, notify) {
    qetag(filePath, resolve);
  });
}
