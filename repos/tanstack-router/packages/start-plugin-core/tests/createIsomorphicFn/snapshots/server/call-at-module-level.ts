const getEnvironment = () => {
  console.log('[SERVER] getEnvironment called');
  return 'server';
};
const moduleLevel = getEnvironment();