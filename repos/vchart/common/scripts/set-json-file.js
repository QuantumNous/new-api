function setJsonFileByKey(file, json, keys, newValue) {
  const prevValue = keys.reduce((res, k) => {
    return res[k];
  }, json);

  if (prevValue !== newValue) {
    let startIndex = 0;

    keys.forEach(k => {
      const keyStr = `"${k}"`;
      const index = file.indexOf(keyStr, startIndex);

      if (index >= 0) {
        startIndex = index + keyStr.length + 1;
      }
    })

    const leftIndex = file.indexOf('"', startIndex);
    const rightIndex = leftIndex >= 0 ? file.indexOf('"', leftIndex +1) : -1;

    if (leftIndex >= 0 && rightIndex >= 0) {
      return `${file.slice(0, leftIndex)}"${newValue}"${file.slice(rightIndex + 1)}`
    }
  }

  return file;
}

module.exports = setJsonFileByKey;

