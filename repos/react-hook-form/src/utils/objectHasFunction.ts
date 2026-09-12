import isFunction from './isFunction';

export default <T>(data: T): boolean => {
  for (const key in data) {
    if (isFunction(data[key])) {
      return true;
    }
  }
  return false;
};
