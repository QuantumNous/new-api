export default <T>(fieldValues: T[], index: number, value: T) => {
  fieldValues[index] = value;
  return fieldValues;
};
