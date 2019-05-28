"use strict";

var _http = _interopRequireDefault(require("http"));

var _util = _interopRequireDefault(require("util"));

var _debug = _interopRequireDefault(require("debug"));

var _onFinished = _interopRequireDefault(require("on-finished"));

var _statuses = _interopRequireDefault(require("statuses"));

var _stream = _interopRequireDefault(require("stream"));

var _compose = _interopRequireDefault(require("./utils/compose"));

var _context2 = _interopRequireDefault(require("./context"));

var _request2 = _interopRequireDefault(require("./request"));

var _response2 = _interopRequireDefault(require("./response"));

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

var debug = (0, _debug.default)('skoa:application');

var EventEmitter = require('events');

module.exports =
/*#__PURE__*/
function (_EventEmitter) {
  _inherits(Application, _EventEmitter);

  function Application() {
    var _this;

    _classCallCheck(this, Application);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(Application).call(this));
    _this.trustProxy = false;
    _this.middleware = [];
    _this.subdomainOffset = 2;
    _this.env = process.env.NODE_ENV || 'development';
    _this.context = Object.create(_context2.default);
    _this.request = Object.create(_request2.default);
    _this.response = Object.create(_response2.default);
    if (_util.default.inspect.custom) _this[_util.default.inspect.custom] = _this.inspect;
    return _this;
  }

  _createClass(Application, [{
    key: "createContext",
    value: function createContext(req, res) {
      var context = Object.create(this.context);
      var request = context.request = Object.create(this.request);
      var response = context.response = Object.create(this.response);
      context.app = request.app = response.app = this;
      context.req = request.req = response.req = req;
      context.res = request.res = response.res = res;
      request.ctx = response.ctx = context;
      request.response = response;
      response.request = request;
      context.originalUrl = request.originalUrl = req.url;
      context.state = {};
      return context;
    }
  }, {
    key: "listen",
    value: function listen() {
      debug('listen');

      var server = _http.default.createServer(this.callback());

      server.listen.apply(server, arguments);
    }
  }, {
    key: "use",
    value: function use(fn) {
      // 添加中间件
      if (typeof fn !== 'function') throw new TypeError('middleware must be a function!');
      this.middleware.push(fn); // 将相应的方法添加到中间件中去

      return this;
    }
  }, {
    key: "callback",
    value: function callback() {
      var _this2 = this;

      var fn = (0, _compose.default)(this.middleware); // 如果没有错误事件监听，则在这里监听

      if (!this.listenerCount('error')) this.on('error', this.onError);
      return function (req, res) {
        var ctx = _this2.createContext(req, res);

        return _this2.handleRequest(ctx, fn);
      };
    }
  }, {
    key: "handleRequest",
    value: function handleRequest(ctx, middlewareFn) {
      var onError = function onError(error) {
        return ctx.onError(error);
      };

      var handleResponse = function handleResponse() {
        return respond(ctx);
      };

      ctx.response.statusCode = 404;
      (0, _onFinished.default)(ctx.response, onError);
      return middlewareFn(ctx).then(handleResponse).catch(onError);
    }
  }, {
    key: "toJSON",
    value: function toJSON() {
      return (0, _utils.only)(this, ['subdomainOffset', 'proxy', 'env']);
    }
  }, {
    key: "inspect",
    value: function inspect() {
      return this.toJSON();
    }
  }, {
    key: "onError",
    value: function onError(err) {
      if (!(err instanceof Error)) throw new TypeError(_util.default.format('non-error thrown: %j', err));
      if (err.status === 404 || err.expose) return;
      if (this.silent) return;
      var msg = err.stack || err.toString();
      console.error();
      console.error(msg.replace(/^/gm, '  '));
      console.error();
    }
  }]);

  return Application;
}(EventEmitter);

function respond(ctx) {
  // allow bypassing koa
  if (ctx.respond === false || !ctx.writable) return;
  var res = ctx.res;
  var body = ctx.body;
  var code = ctx.status; // ignore body

  if (_statuses.default.empty[code]) {
    // 返回的状态码为空，将 body置为空
    // strip headers
    ctx.body = null;
    return res.end();
  }

  if (ctx.method === 'HEAD') {
    // 当请求的methods为 'HEAD' 的时候
    if (!res.headersSent && (0, _utils.isJSON)(body)) {
      // 判断响应头是否发送 body 是否为 JSON
      ctx.length = Buffer.byteLength(JSON.stringify(body)); // 设置相应的 Content-Length
    }

    return res.end();
  } // status body


  if (body == null) {
    // 当响应body为空的时候
    if (ctx.req.httpVersionMajor >= 2) {
      // 表示连接到的服务器的 HTTP 版本
      body = String(code); // 将 body 设置为状态码
    } else {
      body = ctx.message || String(code); // 将 body 设置为哦相应信息 或者 状态码
    }

    if (!res.headersSent) {
      // 当响应头还未发送的时候
      ctx.type = 'text'; // 设置 Content-type

      ctx.length = Buffer.byteLength(body); // 设置 Content-Length
    }

    return res.end(body); // 发送body
  } // 对不同的响应body进行处理
  // responses


  if (Buffer.isBuffer(body)) return res.end(body); // buffer

  if (typeof body === 'string') return res.end(body); // string

  if (body instanceof _stream.default) return body.pipe(res); // Stream
  // body: json

  body = JSON.stringify(body);

  if (!res.headersSent) {
    ctx.length = Buffer.byteLength(body);
  }

  res.end(body);
}