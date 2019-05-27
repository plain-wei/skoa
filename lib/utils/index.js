"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.only = exports.isJSON = void 0;

var isJSON = function isJSON(body) {
  if (!body) return false;
  if (typeof body === 'string') return false;
  if (typeof body.pipe === 'function') return false;
  return !Buffer.isBuffer(body);
};

exports.isJSON = isJSON;

var only = function only(obj, keys) {
  obj = obj || {};
  if (typeof keys === 'string') keys = keys.split(/ +/);
  return keys.reduce(function (ret, key) {
    if (obj[key] == null) return ret;
    ret[key] = obj[key];
    return ret;
  }, {});
};

exports.only = only;