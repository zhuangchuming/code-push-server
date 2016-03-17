'use strict';
var Q = require('q');
var Promise = Q.Promise;
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var fs = require("fs");
var unzip = require('node-unzip-2');
var qiniu = require("node-qiniu");
var _ = require('lodash');
var config    = _.get(require('../config'), 'qiniu', {});
var common = {};
module.exports = common;

common.deleteFolder = function (folderPath) {
  return Promise(function (resolve, reject, notify) {
    rimraf(folderPath, function (err) {
      if (err) {
        reject(err);
      }else {
        resolve(null);
      }
    });
  });
};

common.createEmptyTempFolder = function (folderPath) {
  return Promise(function (resolve, reject, notify) {
    common.deleteFolder(folderPath).then(function (data) {
      mkdirp(folderPath, function (err) {
        if (err) {
          reject({message: "create error"});
        } else {
          resolve(folderPath);
        }
      });
    });
  });
};

common.unzipFile = function (zipFile, outputPath) {
  return Promise(function (resolve, reject, notify) {
    var readStream = fs.createReadStream(zipFile);
    var extract = unzip.Extract({ path: outputPath });
    readStream.pipe(extract);
    extract.on("close", function () {
      resolve(outputPath);
    });
  });
};

common.uploadFileToQiniu = function (key, filePath) {
  return Promise(function (resolve, reject, notify) {
    qiniu.config({
      access_key: _.get(config, "accessKey"),
      secret_key: _.get(config, "secretKey"),
    });
    var bucket = qiniu.bucket(_.get(config, "bucketName", "jukang"));
    var assets = bucket.key(key);
    assets.stat(function (err, result) {
      if (_.isEmpty(result.hash)) {
        bucket.putFile(key, filePath, function(err, reply) {
          if (err) {
            reject({message: "error"});
          }else {
            resolve(reply.hash);
          }
        });
      } else {
        resolve(result.hash);
      }
    });
  });
};
