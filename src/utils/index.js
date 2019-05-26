export const isJSON = (body) => {
  if (!body) return false;
  if (typeof body === 'string') return false;
  if (typeof body.pipe === 'function') return false;

  return !Buffer.isBuffer(body);
};

export const only = (obj, keys) => {
  obj = obj || {};
  if (typeof keys === 'string') keys = keys.split(/ +/);

  return keys.reduce((ret, key) => {
    if (obj[key] == null) return ret;
    ret[key] = obj[key];

    return ret;
  }, {});
};
