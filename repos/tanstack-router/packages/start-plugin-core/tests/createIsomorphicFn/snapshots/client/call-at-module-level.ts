const getEnvironment = () => {
  console.log('[CLIENT] getEnvironment called');
  return 'client';
};
const moduleLevel = getEnvironment();