const BASE_URL = 'https://api.example.com';
const config = {
  url: BASE_URL,
  timeout: 5000
};
const fetcher = (path: string) => fetch(`${config.url}${path}`);
const SplitLoader = async () => {
  return fetcher('/data');
};
export { SplitLoader as loader };
const SplitComponent = () => <div>Timeout: {config.timeout}</div>;
export { SplitComponent as component };