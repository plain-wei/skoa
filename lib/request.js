"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _url = _interopRequireDefault(require("url"));

var _net = _interopRequireDefault(require("net"));

var _accepts = _interopRequireDefault(require("accepts"));

var _contentType = _interopRequireDefault(require("content-type"));

var _parseurl = _interopRequireDefault(require("parseurl"));

var _querystring = _interopRequireDefault(require("querystring"));

var _typeIs = _interopRequireDefault(require("type-is"));

var _fresh = _interopRequireDefault(require("fresh"));

var _util = _interopRequireDefault(require("util"));

var _index = require("./utils/index");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Module dependencies.
 */
var URL = _url.default.URL;
var stringify = _url.default.format;
var IP = Symbol('context#ip');
var _request = {
  get headers() {
    return this.req.headers;
  },

  set headers(val) {
    this.req.headers = val;
  },

  get header() {
    return this.headers;
  },

  set header(val) {
    this.headers = val;
  },

  get url() {
    return this.req.url;
  },

  set url(val) {
    this.req.url = val;
  },

  get origin() {
    return String(this.protocol) + "://" + String(this.host);
  },

  get href() {
    // support: `GET http://example.com/foo`
    if (/^https?:\/\//i.test(this.originalUrl)) return this.originalUrl;
    return this.origin + this.originalUrl;
  },

  get method() {
    return this.req.method;
  },

  set method(val) {
    this.req.method = val;
  },

  get path() {
    return (0, _parseurl.default)(this.req).pathname;
  },

  set path(path) {
    var requestUrl = (0, _parseurl.default)(this.req);
    if (requestUrl.pathname === path) return;
    requestUrl.pathname = path;
    requestUrl.path = null;
    this.url = stringify(requestUrl);
  },

  get query() {
    var str = this.querystring;
    this._querycache = this._querycache || {};
    var c = this._querycache;
    c[str] = c[str] || _querystring.default.parse(str);
    return c[str];
  },

  set query(obj) {
    this.querystring = _querystring.default.stringify(obj);
  },

  get querystring() {
    if (!this.req) return '';
    return (0, _parseurl.default)(this.req).query || '';
  },

  set querystring(str) {
    var requestUrl = (0, _parseurl.default)(this.req);
    if (requestUrl.search === "?" + String(str)) return;
    requestUrl.search = str;
    requestUrl.path = null;
    this.url = stringify(requestUrl);
  },

  get search() {
    if (!this.querystring) return '';
    return "?" + String(this.querystring);
  },

  set search(str) {
    this.querystring = str;
  },

  get host() {
    var trustProxy = this.app.trustProxy;
    var host = trustProxy && this.getHeader('X-Forwarded-Host');

    if (!host) {
      if (this.req.httpVersionMajor >= 2) host = this.getHeader(':authority');
      if (!host) host = this.getHeader('Host');
    }

    if (!host) return '';
    return host.split(/\s*,\s*/, 1)[0];
  },

  get hostname() {
    var host = this.host;
    if (!host) return '';
    if (host[0] === '[') return this.URL.hostname || ''; // IPv6

    return host.split(':', 1)[0]; // 去掉端口
  },

  get URL() {
    /* istanbul ignore else */
    if (!this.memoizedURL) {
      var protocol = this.protocol;
      var host = this.host;
      var originalUrl = this.originalUrl || ''; // avoid undefined in template string

      try {
        this.memoizedURL = new URL(String(protocol) + "://" + String(host) + String(originalUrl));
      } catch (err) {
        this.memoizedURL = Object.create(null);
      }
    }

    return this.memoizedURL;
  },

  get fresh() {
    var method = this.method;
    var s = this.ctx.status; // GET or HEAD for weak freshness validation only

    if (method !== 'GET' && method !== 'HEAD') return false; // 2xx or 304 as per rfc2616 14.26

    if (s >= 200 && s < 300 || s === 304) {
      return (0, _fresh.default)(this.header, this.response.header);
    }

    return false;
  },

  get stale() {
    return !this.fresh;
  },

  get idempotent() {
    var methods = ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE'];
    return methods.indexOf(this.method) > -1;
  },

  get socket() {
    return this.req.socket;
  },

  get charset() {
    try {
      var _contentType$parse = _contentType.default.parse(this.req),
          parameters = _contentType$parse.parameters;

      return parameters.charset || '';
    } catch (e) {
      return '';
    }
  },

  get length() {
    var len = this.getHeader('Content-Length');
    if (len === '') return;
    return Math.trunc(len) || 0;
  },

  get protocol() {
    if (this.socket.encrypted) return 'https';
    if (!this.app.proxy) return 'http';
    var proto = this.getHeader('X-Forwarded-Proto');
    return proto ? proto.split(/\s*,\s*/, 1)[0] : 'http';
  },

  get secure() {
    return this.protocol === 'https';
  },

  get ips() {
    var proxy = this.app.proxy;
    var val = this.getHeader('X-Forwarded-For');
    return proxy && val ? val.split(/\s*,\s*/) : [];
  },

  get ip() {
    if (!this[IP]) {
      this[IP] = this.ips[0] || this.socket.remoteAddress || '';
    }

    return this[IP];
  },

  set ip(_ip) {
    this[IP] = _ip;
  },

  get subdomains() {
    var offset = this.app.subdomainOffset;
    var hostname = this.hostname;
    if (_net.default.isIP(hostname)) return [];
    return hostname.split('.').reverse().slice(offset);
  },

  get accept() {
    this._accept = this._accept || (0, _accepts.default)(this.req);
    return this._accept;
  },

  set accept(obj) {
    this._accept = obj;
  },

  accepts: function accepts() {
    var _this$accept;

    return (_this$accept = this.accept).types.apply(_this$accept, arguments);
  },
  acceptsEncodings: function acceptsEncodings() {
    var _this$accept2;

    return (_this$accept2 = this.accept).encodings.apply(_this$accept2, arguments);
  },
  acceptsCharsets: function acceptsCharsets() {
    var _this$accept3;

    return (_this$accept3 = this.accept).charsets.apply(_this$accept3, arguments);
  },
  acceptsLanguages: function acceptsLanguages() {
    var _this$accept4;

    return (_this$accept4 = this.accept).languages.apply(_this$accept4, arguments);
  },
  is: function is(types) {
    if (!types) return (0, _typeIs.default)(this.req);

    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    if (!Array.isArray(types)) types = [types].concat(args);
    return (0, _typeIs.default)(this.req, types);
  },

  get type() {
    var type = this.getHeader('Content-Type');
    if (!type) return '';
    return type.split(';')[0];
  },

  getHeader: function getHeader(field) {
    var req = this.req;

    switch (field = field.toLowerCase()) {
      case 'referer':
      case 'referrer':
        return req.headers.referrer || req.headers.referer || '';

      default:
        return req.headers[field] || '';
    }
  },
  inspect: function inspect() {
    if (!this.req) return;
    return this.toJSON();
  },
  toJSON: function toJSON() {
    return (0, _index.only)(this, ['method', 'url', 'header']);
  }
};
/* istanbul ignore else */

if (_util.default.inspect.custom) {
  _request[_util.default.inspect.custom] = _request.inspect;
}

var _default = _request;
exports.default = _default;