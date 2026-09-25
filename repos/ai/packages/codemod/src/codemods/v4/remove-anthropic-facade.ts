import { removeFacade } from '../lib/remove-facade';

export default removeFacade({
  packageName: 'anthropic',
  className: 'Anthropic',
  createFnName: 'createAnthropic',
});
