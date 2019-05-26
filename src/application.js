import http from 'http';
import util from 'util';
import Debug from 'debug';
import onFinished from 'on-finished';

import compose from './utils/compose';
import context from './context';
import request from './request';
import response from './response';

const debug = Debug('skoa:application');

const EventEmitter = require('events');

export default class Application extends EventEmitter {
  constructor() {
    super();
    this.trustProxy = false;
    this.middlemare = [];
    this.subdomainOffset = 2;
    this.env = process.env.NODE_ENV || 'development';
    this.context = Object.create(context);
    this.request = Object.create(request);
    this.response = Object.create(response);

    if (util.inspect.custom) this[util.inspect.custom] = this.inspect;
  }

  createContext() {
    // const
  }

  listen(...args) {
    debug('listen');
    const server = http.createServer(this.callback());

    server.listen(...args);
  }

  callback() {
    const fn = compose(this.middlemare);

    const handleRequest = (request, response) => {
      const ctx = this.createContext();

      return this.handleRequest(ctx, fn);
    };


    return handleRequest;
  }

  handleRequest(ctx, middlewareFn) {
    const { response } = ctx;
    const onError = (error) => ctx.onError(error);
    const handleResponse = () => respond(ctx);

    response.statusCode = 404;
    onFinished(response, onError);

    return middlewareFn(ctx).then(handleResponse).catch(onError);
  }

  inspect() {
    return this.toJSON();
  }
}

function respond(ctx) {

}
