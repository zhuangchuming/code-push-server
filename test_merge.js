var path = require('path')
var fs = require('fs');
var text1 = fs.readFileSync(path.resolve(__dirname, '../codepush-text1'), 'utf-8');
var patch = fs.readFileSync(path.resolve(__dirname, '../codepush-patch'), 'utf-8');

var DiffMatchPatch = require('diff-match-patch');
var dmp = new DiffMatchPatch();
var patchs = dmp.patch_fromText(patch);
var d = dmp.patch_apply(patchs, text1);
fs.writeFileSync(path.resolve(__dirname, '../codepush-text2-new'), d[0]);

console.log(d[1]);

