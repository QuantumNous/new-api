import { removeFacade } from '../lib/remove-facade';

export default removeFacade({
  packageName: 'openai',
  className: 'OpenAI',
  createFnName: 'createOpenAI',
});
