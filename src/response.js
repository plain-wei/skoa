

/**
 * Module dependencies.
 */

import contentDisposition from 'content-disposition';
import ensureErrorHandler from 'error-inject';
import getType from 'cache-content-type';
import onFinish from 'on-finished';
import escape from 'escape-html';
import TypeIs from 'type-is';
import statuses from 'statuses';
import destroy from 'destroy';
import assert from 'assert';
import Extname from 'path';
import vary from 'vary';
import util from 'util';
import { isJSON, only } from './utils/index';

const typeis = TypeIs.is;
const extname = Extname.extname;


const _response = {


  get socket() {
    return this.response.socket;
  },

  get headers() {
    const { response } = this;


    return typeof response.getHeaders === 'function'
      ? response.getHeaders()
      : response._headers || {}; // Node < 7.7
  },

  get status() {
    return this.response.statusCode;
  },

  set status(code) {
    if (this.headerSent) return;

    assert(Number.isInteger(code), 'status code must be a number');
    assert(code >= 100 && code <= 999, `invalid status code: ${code}`);
    this._explicitStatus = true;
    this.response.statusCode = code;
    if (this.request.httpVersionMajor < 2) this.response.statusMessage = statuses[code];
    if (this.body && statuses.empty[code]) this.body = null;
  },

  get message() {
    return this.response.statusMessage || statuses[this.status];
  },

  set message(msg) {
    this.response.statusMessage = msg;
  },

  get body() {
    return this._body;
  },

  set body(val) {
    const original = this._body;

    this._body = val;

    // no content
    if (val == null) {
      if (!statuses.empty[this.status]) this.status = 204;
      this.remove('Content-Type');
      this.remove('Content-Length');
      this.remove('Transfer-Encoding');

      return;
    }

    // set the status
    if (!this._explicitStatus) this.status = 200;

    // set the content-type only if not yet set
    const setType = !this.header['content-type'];

    // string
    if (typeof val === 'string') {
      if (setType) this.type = /^\s*</.test(val) ? 'html' : 'text';
      this.length = Buffer.byteLength(val);

      return;
    }

    // buffer
    if (Buffer.isBuffer(val)) {
      if (setType) this.type = 'bin';
      this.length = val.length;

      return;
    }

    // stream
    if (typeof val.pipe === 'function') {
      onFinish(this.response, destroy.bind(null, val));
      ensureErrorHandler(val, (err) => this.ctx.onerror(err));

      // overwriting
      if (original != null && original !== val) this.remove('Content-Length');

      if (setType) this.type = 'bin';

      return;
    }

    // json
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
    const len = this.header['content-length'];
    const body = this.body;

    if (len == null) {
      if (!body) return;
      if (typeof body === 'string') return Buffer.byteLength(body);
      if (Buffer.isBuffer(body)) return body.length;
      if (isJSON(body)) return Buffer.byteLength(JSON.stringify(body));

      return;
    }

    return Math.trunc(len) || 0;
  },


  get headerSent() {
    return this.response.headersSent;
  },


  vary(field) {
    if (this.headerSent) return;

    vary(this.response, field);
  },

  redirect(url, alt) {
    // location
    if (url === 'back') url = this.ctx.get('Referrer') || alt || '/';
    this.setHeader('Location', url);

    // status
    if (!statuses.redirect[this.status]) this.status = 302;

    // html
    if (this.ctx.accepts('html')) {
      url = escape(url);
      this.type = 'text/html; charset=utf-8';
      this.body = `Redirecting to <a href="${url}">${url}</a>.`;

      return;
    }

    // text
    this.type = 'text/plain; charset=utf-8';
    this.body = `Redirecting to ${url}.`;
  },


  attachment(filename, options) {
    if (filename) this.type = extname(filename);
    this.setHeader('Content-Disposition', contentDisposition(filename, options));
  },


  set type(type) {
    type = getType(type);
    if (type) {
      this.setHeader('Content-Type', type);
    }
    else {
      this.removeHeader('Content-Type');
    }
  },


  set lastModified(val) {
    if (typeof val === 'string') val = new Date(val);
    this.setHeader('Last-Modified', val.toUTCString());
  },

  get lastModified() {
    const date = this.getHeader('last-modified');

    return date ? new Date(date) : false;
  },


  set etag(val) {
    if (!/^(W\/)?"/.test(val)) val = `"${val}"`;
    this.setHeader('ETag', val);
  },

  get etag() {
    return this.getHeader('ETag');
  },


  get type() {
    const type = this.getHeader('Content-Type');

    if (!type) return '';

    return type.split(';', 1)[0];
  },


  is(types, ...args) {
    const type = this.type;

    if (!types) return type || false;
    if (!Array.isArray(types)) types = [ types, ...args ];

    return typeis(type, types);
  },

  getHeader(field) {
    return this.header[field.toLowerCase()] || '';
  },


  setHeader(field, val) {
    if (this.headerSent) return;

    if (typeof field === 'object' && !val) {
      Object.entries(field).forEach(([ k, v ]) => this.setHeader(k, v));
    }
    else if (typeof field === 'string' && field && val) {
      if (Array.isArray(val)) val = val.map((v) => (typeof v === 'string' ? v : String(v)));
      else if (typeof val !== 'string') val = String(val);
      this.response.setHeader(field, val);
    }
  },

  append(field, val) {
    const prev = this.getHeader(field);

    if (prev) {
      val = Array.isArray(prev)
        ? prev.concat(val)
        : [ prev ].concat(val);
    }

    return this.setHeader(field, val);
  },


  removeHeader(field) {
    if (this.headerSent) return;

    this.response.removeHeader(field);
  },


  get writable() {
    // can't write any more after response finished
    if (this.response.finished) return false;

    const socket = this.response.socket;
    // There are already pending outgoing response, but still writable
    // https://github.com/nodejs/node/blob/v4.4.7/lib/_http_server.js#L486

    if (!socket) return true;

    return socket.writable;
  },

  inspect() {
    if (!this.response) return;
    const o = this.toJSON();

    o.body = this.body;

    return o;
  },

  toJSON() {
    return only(this, [
      'status',
      'message',
      'header',
    ]);
  },

  /**
   * Flush any set headers, and begin the body
   */
  flushHeaders() {
    this.response.flushHeaders();
  },
};

/**
 * Custom inspection implementation for newer Node.js versions.
 *
 * @return {Object}
 * @api public
 */
if (util.inspect.custom) {
  _response[util.inspect.custom] = _response.inspect;
}

export default _response;
