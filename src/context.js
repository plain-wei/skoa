import util from 'util';
import createError from 'http-errors';
import httpAssert from 'http-assert';
import delegate from 'delegates';
import statuses from 'statuses';
import Cookies from 'cookies';

const COOKIES = Symbol('context#cookies');

const context = {

  inspect : () => (this === context ? this : this.toJSON()),

  toJSON() {
    return {
      request     : this.request.toJSON(),
      response    : this.response.toJSON(),
      app         : this.app.toJSON(),
      originalUrl : this.originalUrl,
      req         : '<original node req>',
      res         : '<original node res>',
      socket      : '<original node socket>',

    };
  },
  assert : httpAssert,
  throw(...args) {
    throw createError(...args);
  },

  get cookies() { // 获取 Cookies
    if (!this[COOKIES]) {
      this[COOKIES] = new Cookies(this.req, this.res, {
        keys   : this.app.keys,
        secure : this.request.secure,
      });
    }

    return this[COOKIES];
  },

  set cookies(_cookies) { // 设置 cookies
    this[COOKIES] = _cookies;
  },

  onError(error) {
    if (!error) return;

    if (!(error instanceof Error)) error = new Error(util.format('non-error thrown: %j', error));

    let headerSent = false;

    if (this.headerSent || !this.writeable) {
      error.headerSent = true;
      headerSent = true;
    }

    this.app.emit('error', error, this);

    if (headerSent) return;

    const { response } = this;
    // 清空 header

    if (typeof response.getHeaderNames === 'function') {
      response.getHeaderNames().forEach((name) => response.removeHeader(name));
    }
    else {
      response._headers = {};
    }

    response.setHeader(error.headers);

    response.type = 'text';

    if (error.code === 'ENOENT') error.status = 404;
    if (typeof error.status !== 'number' || !statuses[error.status]) error.status = 500;
    const code = statuses[error.status];
    const message = error.expose ? error.message : code; // 是否将错误返回给客户端

    response.status = error.status;
    response.length = Buffer.byteLength(message);
    response.send(message);
  },
};

if (util.inspect.custom) {
  context[util.inspect.custom] = context.inspect;
}

delegate(context, 'response')
  .method('attachment')
  .method('redirect')
  .method('remove')
  .method('vary')
  .method('setHeader')
  .method('append')
  .method('flushHeaders')
  .access('status')
  .access('message')
  .access('body')
  .access('length')
  .access('type')
  .access('lastModified')
  .access('etag')
  .getter('headerSent')
  .getter('writable');

delegate(context, 'request')
  .method('acceptsLanguages')
  .method('acceptsEncodings')
  .method('acceptsCharsets')
  .method('accepts')
  .method('getHeader')
  .method('is')
  .access('querystring')
  .access('idempotent')
  .access('socket')
  .access('search')
  .access('method')
  .access('query')
  .access('path')
  .access('url')
  .access('accept')
  .getter('origin')
  .getter('href')
  .getter('subdomains')
  .getter('protocol')
  .getter('host')
  .getter('hostname')
  .getter('URL')
  .getter('header')
  .getter('headers')
  .getter('secure')
  .getter('stale')
  .getter('fresh')
  .getter('ips')
  .getter('ip');


export default context;
