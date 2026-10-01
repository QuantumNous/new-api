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
const SplitLoader = async () => fetch(apiUrl);
export { SplitLoader as loader };
const SplitComponent = () => <div>Timeout: {timeout}</div>;
export { SplitComponent as component };