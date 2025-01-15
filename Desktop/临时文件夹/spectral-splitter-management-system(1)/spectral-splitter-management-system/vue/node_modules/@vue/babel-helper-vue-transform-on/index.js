const transformOn = (obj) => {
  const result = {};
  Object.keys(obj).forEach((evt) => {
    result[`on${evt[0].toUpperCase()}${evt.slice(1)}`] = obj[evt];
  });
  return result;
};

module.exports = transformOn;
