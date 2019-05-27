import http from 'http';
import util from 'util';
import Debug from 'debug';
import onFinished from 'on-finished';
import statuses from 'statuses';
import Stream from 'stream';

import compose from './utils/compose';
import context from './context';
import request from './request';
import response from './response';

import { isJSON } from './utils';

const debug = Debug('skoa:application');

const EventEmitter = require('events');

module.exports = class Application extends EventEmitter {
  constructor() {
    super();
    this.trustProxy = false;
    this.middleware = [];
    this.subdomainOffset = 2;
    this.env = process.env.NODE_ENV || 'development';
    this.context = Object.create(context);
    this.request = Object.create(request);
    this.response = Object.create(response);

    if (util.inspect.custom) this[util.inspect.custom] = this.inspect;
  }

  createContext(req, res) {
    const ctx = Object.create(this.context);

    ctx.request = Object.create(this.request);
    ctx.response = Object.create(this.response);

    const _request = ctx.request;
    const _response = ctx.response;

    // request
    _request.app = this;
    _request.request = req;
    _request.response = res;
    _request.ctx = ctx;
    _request.response = res;
    _request.originalUrl = req.url;

    // response
    _response.app = this;
    _response.request = req;
    _response.response = res;
    _response.ctx = ctx;
    _request.request = req;

    // context
    ctx.app = this;
    ctx.request = req;
    ctx.response = res;
    ctx.originalUrl = req.url;
    ctx.state = {};

    return ctx;
  }

  listen(...args) {
    debug('listen');
    const server = http.createServer(this.callback());

    server.listen(...args);
  }

  use(fn) { // 添加中间件
    if (typeof fn !== 'function') throw new TypeError('middleware must be a function!');
    this.middleware.push(fn); // 将相应的方法添加到中间件中去

    return this;
  }

  callback() {
    const fn = compose(this.middleware);

    return (req, res) => {
      const ctx = this.createContext(req, res);

      return this.handleRequest(ctx, fn);
    };
  }

  handleRequest(ctx, middlewareFn) {
    const onError = (error) => ctx.onError(error);
    const handleResponse = () => respond(ctx);

    ctx.response.statusCode = 404;
    onFinished(ctx.response, onError);

    return middlewareFn(ctx).then(handleResponse).catch(onError);
  }

  inspect() {
    return this.toJSON();
  }
};

function respond(ctx) {
// allow bypassing koa
  if (ctx.respond === false || !ctx.writable) return;

  const res = ctx.response;

  let body = ctx.body;
  const code = ctx.status;

  // ignore body
  if (statuses.empty[code]) { // 返回的状态码为空，将 body置为空
    // strip headers
    ctx.body = null;

    return res.end();
  }

  if (ctx.method === 'HEAD') { // 当请求的methods为 'HEAD' 的时候
    if (!res.headersSent && isJSON(body)) { // 判断响应头是否发送 body 是否为 JSON
      ctx.length = Buffer.byteLength(JSON.stringify(body)); // 设置相应的 Content-Length
    }

    return res.end();
  }

  // status body
  if (body == null) { // 当响应body为空的时候
    if (ctx.req.httpVersionMajor >= 2) { // 表示连接到的服务器的 HTTP 版本
      body = String(code); // 将 body 设置为状态码
    }
    else {
      body = ctx.message || String(code); // 将 body 设置为哦相应信息 或者 状态码
    }
    if (!res.headersSent) { // 当响应头还未发送的时候
      ctx.type = 'text'; // 设置 Content-type
      ctx.length = Buffer.byteLength(body); // 设置 Content-Length
    }

    return res.end(body); // 发送body
  }

  // 对不同的响应body进行处理
  // responses
  if (Buffer.isBuffer(body)) return res.end(body); // buffer
  if (typeof body === 'string') return res.end(body); // string
  if (body instanceof Stream) return body.pipe(res); // Stream

  // body: json
  body = JSON.stringify(body);
  if (!res.headersSent) {
    ctx.length = Buffer.byteLength(body);
  }
  res.end(body);
}
