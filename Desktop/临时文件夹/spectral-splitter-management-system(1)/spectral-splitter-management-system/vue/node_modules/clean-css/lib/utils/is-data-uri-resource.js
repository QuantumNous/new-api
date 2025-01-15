var DATA_URI_PATTERN = /^data:(\S{0,31}?)?(;charset=(?:(?!;charset=)[^;])+)?(;[^,]+?)?,(.+)/;

function isDataUriResource(uri) {
  return DATA_URI_PATTERN.test(uri);
}

module.exports = isDataUriResource;
