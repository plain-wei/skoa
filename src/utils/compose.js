/** ************************
 const f1 = async (ctx, next) => {await next(); console.warn('F1')};
 const f2 = async (ctx, next) => {await next(); console.warn('F2')};
 const f3 = async (ctx, next) => {await next(); console.warn('F3')};
 const f4 = async (ctx, next) => {await next(); console.warn('F4')};

 const fns = [f1,f2,f3,f4]
 const fnm = compose(fns)

 fnm() => print F4 F3 F2 F1

 */

const compose = (middleware) => {
  if (!Array.isArray(middleware)) throw new Error('the middleware must be an Array!');
  if (middleware.some((fn) => typeof fn !== 'function')) throw new Error('the middleware\'item must be Function!');

  return (ctx, next) => {
    let dispatchTimes = -1;
    const dispatch = (i) => {
      if (dispatchTimes >= i) return Promise.reject(new Error('next can be called only once'));
      dispatchTimes++;
      let fn = middleware[i];

      if (i === middleware.length && next) fn = next;

      return fn ? Promise.resolve(fn(ctx, dispatch.bind(null, i + 1))) : Promise.resolve();
    };

    return dispatch(0);
  };
};

export default compose;
