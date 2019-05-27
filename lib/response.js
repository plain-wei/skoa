"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _contentDisposition = _interopRequireDefault(require("content-disposition"));

var _errorInject = _interopRequireDefault(require("error-inject"));

var _cacheContentType = _interopRequireDefault(require("cache-content-type"));

var _onFinished = _interopRequireDefault(require("on-finished"));

var _escapeHtml = _interopRequireDefault(require("escape-html"));

var _typeIs = _interopRequireDefault(require("type-is"));

var _statuses = _interopRequireDefault(require("statuses"));

var _destroy = _interopRequireDefault(require("destroy"));

var _assert = _interopRequireDefault(require("assert"));

var _path = _interopRequireDefault(require("path"));

var _vary2 = _interopRequireDefault(require("vary"));

var _util = _interopRequireDefault(require("util"));

var _index = require("./utils/index");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var typeis = _typeIs.default.is;
var extname = _path.default.extname;
var _response = {
  get socket() {
    return this.response.socket;
  },

  get headers() {
    var response = this.response;
    return typeof response.getHeaders === 'function' ? response.getHeaders() : response._headers || {}; // Node < 7.7
  },

  get status() {
    return this.response.statusCode;
  },

  set status(code) {
    if (this.headerSent) return;
    (0, _assert.default)(Number.isInteger(code), 'status code must be a number');
    (0, _assert.default)(code >= 100 && code <= 999, "invalid status code: " + String(code));
    this._explicitStatus = true;
    this.response.statusCode = code;
    if (this.request.httpVersionMajor < 2) this.response.statusMessage = _statuses.default[code];
    if (this.body && _statuses.default.empty[code]) this.body = null;
  },

  get message() {
    return this.response.statusMessage || _statuses.default[this.status];
  },

  set message(msg) {
    this.response.statusMessage = msg;
  },

  get body() {
    return this._body;
  },

  set body(val) {
    var _this = this;

    var original = this._body;
    this._body = val; // no content

    if (val == null) {
      if (!_statuses.default.empty[this.status]) this.status = 204;
      this.remove('Content-Type');
      this.remove('Content-Length');
      this.remove('Transfer-Encoding');
      return;
    } // set the status


    if (!this._explicitStatus) this.status = 200; // set the content-type only if not yet set

    var setType = !this.header['content-type']; // string

    if (typeof val === 'string') {
      if (setType) this.type = /^\s*</.test(val) ? 'html' : 'text';
      this.length = Buffer.byteLength(val);
      return;
    } // buffer


    if (Buffer.isBuffer(val)) {
      if (setType) this.type = 'bin';
      this.length = val.length;
      return;
    } // stream


    if (typeof val.pipe === 'function') {
      (0, _onFinished.default)(this.response, _destroy.default.bind(null, val));
      (0, _errorInject.default)(val, function (err) {
        return _this.ctx.onerror(err);
      }); // overwriting

      if (original != null && original !== val) this.remove('Content-Length');
      if (setType) this.type = 'bin';
      return;
    } // json


    this.remove('Content-Length');
    this.type = 'json';
  },

  /**
   * Set Content-Length field to `n`.
   *
   * @param {Number} n
   * @api public
   */
  set length(n) {
    this.setHeader('Content-Length', n);
  },

  get length() {
    var len = this.header['content-length'];
    var body = this.body;

    if (len == null) {
      if (!body) return;
      if (typeof body === 'string') return Buffer.byteLength(body);
      if (Buffer.isBuffer(body)) return body.length;
      if ((0, _index.isJSON)(body)) return Buffer.byteLength(JSON.stringify(body));
      return;
    }

    return Math.trunc(len) || 0;
  },

  get headerSent() {
    return this.response.headersSent;
  },

  vary: function vary(field) {
    if (this.headerSent) return;
    (0, _vary2.default)(this.response, field);
  },
  redirect: function redirect(url, alt) {
    // location
    if (url === 'back') url = this.ctx.get('Referrer') || alt || '/';
    this.setHeader('Location', url); // status

    if (!_statuses.default.redirect[this.status]) this.status = 302; // html

    if (this.ctx.accepts('html')) {
      url = (0, _escapeHtml.default)(url);
      this.type = 'text/html; charset=utf-8';
      this.body = "Redirecting to <a href=\"" + String(url) + "\">" + String(url) + "</a>.";
      return;
    } // text


    this.type = 'text/plain; charset=utf-8';
    this.body = "Redirecting to " + String(url) + ".";
  },
  attachment: function attachment(filename, options) {
    if (filename) this.type = extname(filename);
    this.setHeader('Content-Disposition', (0, _contentDisposition.default)(filename, options));
  },

  set type(type) {
    type = (0, _cacheContentType.default)(type);

    if (type) {
      this.setHeader('Content-Type', type);
    } else {
      this.removeHeader('Content-Type');
    }
  },

  set lastModified(val) {
    if (typeof val === 'string') val = new Date(val);
    this.setHeader('Last-Modified', val.toUTCString());
  },

  get lastModified() {
    var date = this.getHeader('last-modified');
    return date ? new Date(date) : false;
  },

  set etag(val) {
    if (!/^(W\/)?"/.test(val)) val = "\"" + String(val) + "\"";
    this.setHeader('ETag', val);
  },

  get etag() {
    return this.getHeader('ETag');
  },

  get type() {
    var type = this.getHeader('Content-Type');
    if (!type) return '';
    return type.split(';', 1)[0];
  },

  is: function is(types) {
    var type = this.type;
    if (!types) return type || false;

    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    if (!Array.isArray(types)) types = [types].concat(args);
    return typeis(type, types);
  },
  getHeader: function getHeader(field) {
    return this.header[field.toLowerCase()] || '';
  },
  setHeader: function setHeader(field, val) {
    var _this2 = this;

    if (this.headerSent) return;

    if (_typeof(field) === 'object' && !val) {
      Object.entries(field).forEach(function (_ref) {
        var _ref2 = _slicedToArray(_ref, 2),
            k = _ref2[0],
            v = _ref2[1];

        return _this2.setHeader(k, v);
      });
    } else if (typeof field === 'string' && field && val) {
      if (Array.isArray(val)) val = val.map(function (v) {
        return typeof v === 'string' ? v : String(v);
      });else if (typeof val !== 'string') val = String(val);
      this.response.setHeader(field, val);
    }
  },
  append: function append(field, val) {
    var prev = this.getHeader(field);

    if (prev) {
      val = Array.isArray(prev) ? prev.concat(val) : [prev].concat(val);
    }

    return this.setHeader(field, val);
  },
  removeHeader: function removeHeader(field) {
    if (this.headerSent) return;
    this.response.removeHeader(field);
  },

  get writable() {
    // can't write any more after response finished
    if (this.response.finished) return false;
    var socket = this.response.socket; // There are already pending outgoing response, but still writable
    // https://github.com/nodejs/node/blob/v4.4.7/lib/_http_server.js#L486

    if (!socket) return true;
    return socket.writable;
  },

  inspect: function inspect() {
    if (!this.response) return;
    var o = this.toJSON();
    o.body = this.body;
    return o;
  },
  toJSON: function toJSON() {
    return (0, _index.only)(this, ['status', 'message', 'header']);
  },

  /**
   * Flush any set headers, and begin the body
   */
  flushHeaders: function flushHeaders() {
    this.response.flushHeaders();
  }
};
/**
 * Custom inspection implementation for newer Node.js versions.
 *
 * @return {Object}
 * @api public
 */

if (_util.default.inspect.custom) {
  _response[_util.default.inspect.custom] = _response.inspect;
}

var _default = _response;
exports.default = _default;