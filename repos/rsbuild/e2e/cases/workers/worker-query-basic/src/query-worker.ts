import { formatMessage } from './message';

self.onmessage = () => {
  self.postMessage({
    text: formatMessage(self.name || 'worker'),
  });
};
