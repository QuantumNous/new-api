export const toBoolean = (value) => {
  // 兼容字符串、数字以及布尔原生类型
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    return v === 'true' || v === '1';
  }
  return false;
}; 