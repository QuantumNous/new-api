import { removeFacade } from '../lib/remove-facade';

export default removeFacade({
  packageName: 'google',
  className: 'Google',
  createFnName: 'createGoogleGenerativeAI',
});
