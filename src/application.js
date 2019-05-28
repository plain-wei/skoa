/* eslint-disable no-multi-assign */
import http from 'http';
import util from 'util';
import Debug from 'debug';
import onFinished from 'on-finished';
import statuses from 'statuses';
import Stream from 'stream';

import compose from './utils/compose';
import _context from './context';
import _request from './request';
import _response from './response';

import { isJSON, only } from './utils';

const debug = Debug('skoa:application');

const EventEmitter = require('events');

module.exports = class Application extends EventEmitter {
  constructor() {
    super();
    this.trustProxy = false;
    this.middleware = [];
    this.subdomainOffset = 2;
    this.env = process.env.NODE_ENV || 'development';
    this.context = Object.create(_context);
    this.request = Object.create(_request);
    this.response = Object.create(_response);

    if (util.inspect.custom) this[util.inspect.custom] = this.inspect;
  }

  createContext(req, res) {
    const context = Object.create(this.context);
    const request = context.request = Object.create(this.request);
    const response = context.response = Object.create(this.response);

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
    // 如果没有错误事件监听，则在这里监听

    if (!this.listenerCount('error')) this.on('error', this.onError);

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

  toJSON() {
    return only(this, [
      'subdomainOffset',
      'proxy',
      'env',
    ]);
  }

  inspect() {
    return this.toJSON();
  }

  onError(err) {
    if (!(err instanceof Error)) throw new TypeError(util.format('non-error thrown: %j', err));

    if (err.status === 404 || err.expose) return;
    if (this.silent) return;

    const msg = err.stack || err.toString();

    console.error();
    console.error(msg.replace(/^/gm, '  '));
    console.error();
  }
};

function respond(ctx) {
// allow bypassing koa
  if (ctx.respond === false || !ctx.writable) return;

  const { res } = ctx;

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
