var path = require('path')
var fs = require('fs');
var text1 = fs.readFileSync(path.resolve(__dirname, '../codepush-text1'), 'utf-8');
var text2 = fs.readFileSync(path.resolve(__dirname, '../codepush-text2'), 'utf-8');

var DiffMatchPatch = require('diff-match-patch');
var dmp = new DiffMatchPatch();
var patchs = dmp.patch_make(text1, text2);
var d = dmp.patch_toText(patchs);
fs.writeFileSync(path.resolve(__dirname, '../codepush-patch'), d);
console.log(d);

