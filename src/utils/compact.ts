export default <TValue>(value: TValue[]) =>
  Array.isArray(value) ? value.filter(Boolean) : [];
