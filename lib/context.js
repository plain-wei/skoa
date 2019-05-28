"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _util = _interopRequireDefault(require("util"));

var _httpErrors = _interopRequireDefault(require("http-errors"));

var _httpAssert = _interopRequireDefault(require("http-assert"));

var _delegates = _interopRequireDefault(require("delegates"));

var _statuses = _interopRequireDefault(require("statuses"));

var _cookies2 = _interopRequireDefault(require("cookies"));

var _this = void 0;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var COOKIES = Symbol('context#cookies');
var context = {
  inspect: function inspect() {
    return _this === context ? _this : _this.toJSON();
  },
  toJSON: function toJSON() {
    return {
      request: this.request.toJSON(),
      response: this.response.toJSON(),
      app: this.app.toJSON(),
      originalUrl: this.originalUrl,
      req: '<original node req>',
      res: '<original node res>',
      socket: '<original node socket>'
    };
  },
  assert: _httpAssert.default,
  throw: function _throw() {
    throw _httpErrors.default.apply(void 0, arguments);
  },

  get cookies() {
    // 获取 Cookies
    if (!this[COOKIES]) {
      this[COOKIES] = new _cookies2.default(this.req, this.res, {
        keys: this.app.keys,
        secure: this.request.secure
      });
    }

    return this[COOKIES];
  },

  set cookies(_cookies) {
    // 设置 cookies
    this[COOKIES] = _cookies;
  },

  onError: function onError(error) {
    if (!error) return;
    if (!(error instanceof Error)) error = new Error(_util.default.format('non-error thrown: %j', error));
    var headerSent = false;

    if (this.headerSent || !this.writeable) {
      error.headerSent = true;
      headerSent = true;
    }

    this.app.emit('error', error, this);
    if (headerSent) return;
    var response = this.response; // 清空 header

    if (typeof response.getHeaderNames === 'function') {
      response.getHeaderNames().forEach(function (name) {
        return response.removeHeader(name);
      });
    } else {
      response._headers = {};
    }

    response.setHeader(error.headers);
    response.type = 'text';
    if (error.code === 'ENOENT') error.status = 404;
    if (typeof error.status !== 'number' || !_statuses.default[error.status]) error.status = 500;
    var code = _statuses.default[error.status];
    var message = error.expose ? error.message : code; // 是否将错误返回给客户端

    response.status = error.status;
    response.length = Buffer.byteLength(message);
    response.send(message);
  }
};

if (_util.default.inspect.custom) {
  context[_util.default.inspect.custom] = context.inspect;
}

(0, _delegates.default)(context, 'response').method('attachment').method('redirect').method('removeHeader').method('vary').method('setHeader').method('append').method('flushHeaders').access('status').access('message').access('body').access('length').access('type').access('lastModified').access('etag').getter('headerSent').getter('writable');
(0, _delegates.default)(context, 'request').method('acceptsLanguages').method('acceptsEncodings').method('acceptsCharsets').method('accepts').method('getHeader').method('is').access('querystring').access('idempotent').access('socket').access('search').access('method').access('query').access('path').access('url').access('accept').getter('origin').getter('href').getter('subdomains').getter('protocol').getter('host').getter('hostname').getter('URL').getter('header').getter('headers').getter('secure').getter('stale').getter('fresh').getter('ips').getter('ip');
var _default = context;
exports.default = _default;