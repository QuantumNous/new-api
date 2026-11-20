import { formatMessage } from './message';

self.onmessage = ({ data }) => {
  self.postMessage({
    text: formatMessage(self.name, data),
  });
};
