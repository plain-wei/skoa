

/**
 * Module dependencies.
 */

import url from 'url';
import net from 'net';
import accepts from 'accepts';
import contentType from 'content-type';

import parse from 'parseurl';
import qs from 'querystring';
import typeis from 'type-is';
import fresh from 'fresh';
import util from 'util';

import { only } from './utils/index';

const { URL } = url;
const stringify = url.format;
const IP = Symbol('context#ip');

const _request = {

  get headers() { return this.req.headers; },
  set headers(val) { this.req.headers = val; },

  get header() { return this.headers; },
  set header(val) { this.headers = val; },

  get url() { return this.req.url; },
  set url(val) { this.req.url = val; },

  get origin() { return `${this.protocol}://${this.host}`; },
  get href() { // 获取完整的请求URL，包括 protocol，host 和 url。
    if (/^https?:\/\//i.test(this.originalUrl)) return this.originalUrl;

    return this.origin + this.originalUrl;
  },

  get method() { return this.req.method; },
  set method(val) { this.req.method = val; },

  // 请求路径名称
  get path() { return parse(this.req).pathname; },
  set path(path) {
    const requestUrl = parse(this.req);

    if (requestUrl.pathname === path) return;

    requestUrl.pathname = path;
    requestUrl.path = null;

    this.url = stringify(requestUrl);
  },


  get query() {
    const str = this.querystring;

    this._querycache = this._querycache || {};
    const c = this._querycache;

    c[str] = c[str] || qs.parse(str);

    return c[str];
  },


  set query(obj) {
    this.querystring = qs.stringify(obj);
  },

  get querystring() {
    if (!this.req) return '';

    return parse(this.req).query || '';
  },

  set querystring(str) {
    const requestUrl = parse(this.req);

    if (requestUrl.search === `?${str}`) return;

    requestUrl.search = str;
    requestUrl.path = null;

    this.url = stringify(requestUrl);
  },


  get search() {
    if (!this.querystring) return '';

    return `?${this.querystring}`;
  },

  set search(str) {
    this.querystring = str;
  },


  get host() {
    const trustProxy = this.app.trustProxy;

    let host = trustProxy && this.getHeader('X-Forwarded-Host');

    if (!host) {
      if (this.req.httpVersionMajor >= 2) host = this.getHeader(':authority');
      if (!host) host = this.getHeader('Host');
    }
    if (!host) return '';

    return host.split(/\s*,\s*/, 1)[0];
  },


  get hostname() {
    const host = this.host;

    if (!host) return '';
    if (host[0] === '[') return this.URL.hostname || ''; // IPv6

    return host.split(':', 1)[0]; // 去掉端口
  },


  get URL() {
    /* istanbul ignore else */
    if (!this.memoizedURL) {
      const protocol = this.protocol;
      const host = this.host;
      const originalUrl = this.originalUrl || ''; // avoid undefined in template string

      try {
        this.memoizedURL = new URL(`${protocol}://${host}${originalUrl}`);
      }
      catch (err) {
        this.memoizedURL = Object.create(null);
      }
    }

    return this.memoizedURL;
  },

  get fresh() {
    const method = this.method;
    const s = this.ctx.status;

    // GET or HEAD for weak freshness validation only
    if (method !== 'GET' && method !== 'HEAD') return false;

    // 2xx or 304 as per rfc2616 14.26
    if ((s >= 200 && s < 300) || s === 304) {
      return fresh(this.header, this.response.header);
    }

    return false;
  },

  get stale() { return !this.fresh; },

  get idempotent() {
    const methods = [ 'GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE' ];

    return methods.includes(this.method);
  },

  get socket() { return this.req.socket; },

  get charset() {
    try {
      const { parameters } = contentType.parse(this.req);


      return parameters.charset || '';
    }
    catch (e) {
      return '';
    }
  },

  get length() {
    const len = this.getHeader('Content-Length');

    if (len === '') return;

    return Math.trunc(len) || 0;
  },


  get protocol() {
    if (this.socket.encrypted) return 'https';
    if (!this.app.trustProxy) return 'http';
    const proto = this.getHeader('X-Forwarded-Proto');


    return proto ? proto.split(/\s*,\s*/, 1)[0] : 'http';
  },


  get secure() { return this.protocol === 'https'; },


  get ips() {
    if (!this.app.trustProxy) return [];

    const val = this.getHeader('X-Forwarded-For');

    return val ? val.split(/\s*,\s*/) : [];
  },
  get ip() {
    if (!this[IP]) {
      this[IP] = this.ips[0] || this.socket.remoteAddress || '';
    }

    return this[IP];
  },

  set ip(_ip) { this[IP] = _ip; },

  get subdomains() {
    const offset = this.app.subdomainOffset;
    const hostname = this.hostname;

    if (net.isIP(hostname)) return [];

    return hostname
      .split('.')
      .reverse()
      .slice(offset);
  },

  get accept() {
    this._accept = this._accept || accepts(this.req);

    return this._accept;
  },

  set accept(obj) { this._accept = obj; },


  accepts(...args) { return this.accept.types(...args); },

  acceptsEncodings(...args) { return this.accept.encodings(...args); },

  acceptsCharsets(...args) { return this.accept.charsets(...args); },
  acceptsLanguages(...args) { return this.accept.languages(...args); },


  is(types, ...args) {
    if (!types) return typeis(this.req);
    if (!Array.isArray(types)) types = [ types, ...args ];

    return typeis(this.req, types);
  },

  get type() {
    const type = this.getHeader('Content-Type');

    return type ? type.split(';')[0] : '';
  },

  getHeader(field) {
    const req = this.req;

    switch (field = field.toLowerCase()) {
      case 'referer':
      case 'referrer':
        return req.headers.referrer || req.headers.referer || '';
      default:
        return req.headers[field] || '';
    }
  },

  inspect() {
    if (!this.req) return;

    return this.toJSON();
  },

  toJSON() {
    return only(this, [
      'method',
      'url',
      'header',
    ]);
  },
};

/* istanbul ignore else */
if (util.inspect.custom) {
  _request[util.inspect.custom] = _request.inspect;
}

export default _request;
