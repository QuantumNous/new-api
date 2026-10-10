const {
  apiUrl,
  timeout
} = getConfig();
function getConfig() {
  return {
    apiUrl: '/api',
    timeout: 5000
  };
}
export { apiUrl, getConfig, timeout };