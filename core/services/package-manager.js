'use strict';
var Q = require('q');
var Promise = Q.Promise;
var models = require('../../models');
var security = require('../../core/utils/security');
var _ = require('lodash');
var qetag = require('../utils/qetag');
var formidable = require('formidable');
var recursiveFs = require("recursive-fs");
var path = require("path");
var yazl = require("yazl");
var unzip = require('unzip');
var fs = require("fs");
var slash = require("slash");
var common = require('../utils/common');
var os = require('os');
var path = require('path');
var mkdirp = require("mkdirp");
var sortObj = require('sort-object');

var proto = module.exports = function (){
  function PackageManager() {

  }
  PackageManager.__proto__ = proto;
  return PackageManager;
};

proto.parseReqFile = function (req) {
  return Promise(function (resolve, reject, notify) {
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
      if (err) {
        reject({message: "upload error"});
      } else {
        if (_.isEmpty(fields.packageInfo) || _.isEmpty(files.package)) {
          reject({message: "upload info lack"});
        } else {
          resolve({packageInfo:JSON.parse(fields.packageInfo), package: files.package});
        }
      }
    });
  });
};

proto.hashAllFiles = function (files) {
  return Promise(function (resolve, reject, notify) {
    var results = {};
    var length = files.length;
    var count = 0;
    files.forEach(function (file) {
      security.fileSha256(file).then(function (hash) {
        results[file] = hash;
        count++;
        if (count == length) {
          resolve(results);
        }
      });
    });
  });
};

proto.getDeploymentsVersions = function (deploymentId, appVersion) {
  return models.DeploymentsVersions.findOne({
    where: {deployment_id: deploymentId, app_version: appVersion}
  });
};

proto.calcPackageAllFiles = function (directoryPath) {
  var _this = this;
  return Promise(function (resolve, reject, notify) {
    recursiveFs.readdirr(directoryPath, function (error, directories, files) {
      if (error) {
        reject(error);
      } else {
        if (files.length == 0) {
          reject({message: "empty files"});
        }else {
          _this.hashAllFiles(files).then(function (results) {
            var data = {};
            _.forIn(results, function (value, key) {
              var relativePath = path.relative(directoryPath, key);
              relativePath = slash(relativePath);
              data[relativePath] = value;
            });
            data = sortObj(data);
            resolve(data);
          });
        }
      }
    });
  });
};

proto.existPackageHash = function (deploymentId, appVersion, manifestHash) {
  return this.getDeploymentsVersions(deploymentId, appVersion).then(function (data) {
    if (_.isEmpty(data)){
      return models.DeploymentsVersions.create({
        deployment_id: deploymentId,
        app_version: appVersion,
        is_mandatory: false,
      }).then(function () {
        return false;
      });
    } else {
      var packageId = data.current_package_id;
      if (_.gt(packageId, 0)) {
        return models.Packages.findOne({
          where: {id: packageId}
        }).then(function (data) {
          if (_.eq(_.get(data,"package_hash"), manifestHash)){
            return true;
          }else {
            return false;
          }
        });
      }else {
        return false
      }
    }
  });
};

proto.createPackage = function (deploymentId, appVersion, packageHash, manifestHash, params) {
  var releaseMethod = params.releaseMethod || 'Upload';
  var releaseUid = params.releaseUid || 0;
  var isMandatory = params.isMandatory ? 1 : 0;
  var size = params.size || 0;
  var description = params.description || "";
  return models.Deployments.generateLabelId(deploymentId).then(function (labelId) {
    return models.sequelize.transaction(function (t) {
      return models.Packages.create({
        deployment_id: deploymentId,
        description: description,
        package_hash: manifestHash,
        blob_url: packageHash,
        size: size,
        manifest_blob_url: manifestHash,
        release_method: releaseMethod,
        label: "v" + labelId,
        released_by: releaseUid
      },{transaction: t
      }).then(function (packages) {
        return models.DeploymentsVersions.update(
          {is_mandatory: isMandatory, current_package_id: packages.id},
          {where: {deployment_id: deploymentId, app_version: appVersion}, transaction: t
        }).spread(function (affectRow) {
          if (_.lte(affectRow, 0)) {
            throw Error('deploy error.');
          }
          return models.DeploymentsVersions.findOne({where: {deployment_id: deploymentId, app_version: appVersion}});
        }).then(function (deploymentsVersions) {
            if (_.isEmpty(deploymentsVersions)){
              throw new Error('empty versions.');
            }
            return models.Deployments.update({
              last_deployment_version_id: deploymentsVersions.id
            },{where: {id: deploymentId}, transaction: t});
        });
      });
    });
  });
};

proto.releasePackage = function (deploymentId, packageInfo, fileType, filePath, releaseUid) {
  var _this = this;
  var appVersion = packageInfo.appVersion;
  var description = packageInfo.description;
  var isMandatory = packageInfo.isMandatory;
  return security.qetag(filePath).then(function (packageHash) {
    var directoryPath = path.join(os.tmpdir(), `${packageHash}/new`);
    return common.createEmptyTempFolder(directoryPath).then(function () {
      if (fileType == "application/zip") {
        return common.unzipFile(filePath, directoryPath)
      } else {
        throw new Error("file type error!");
      }
    }).then(function (directoryPath) {
      return _this.calcPackageAllFiles(directoryPath).then(function (data) {
        var hashFile = directoryPath + "/hashFile.json";
        fs.writeFileSync(hashFile, JSON.stringify(data));
        return security.qetag(hashFile).then(function (manifestHash) {
          return _this.existPackageHash(deploymentId, appVersion, manifestHash).then(function (isExist) {
            if (!isExist){
              return Q.allSettled([
                common.uploadFileToQiniu(manifestHash, hashFile),
                common.uploadFileToQiniu(packageHash, filePath)
              ]).spread(function (up1, up2) {
                return manifestHash;
              });
            } else {
              throw new Error("The uploaded package is identical to the contents of the specified deployment's current release.");
            }
          });
        });
      });
    }).then(function (manifestHash) {
      var stats = fs.statSync(filePath);
      var params = {
        releaseMethod: 'Upload',
        releaseUid: releaseUid,
        isMandatory: isMandatory,
        size: stats.size,
        description: description
      }
      return _this.createPackage(deploymentId, appVersion, packageHash, manifestHash, params);
    });
  });
};
