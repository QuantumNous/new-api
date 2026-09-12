import { formatMessage } from './message';

const marker = 'inline-marker';

self.onmessage = ({ data }) => {
  self.postMessage({
    marker,
    name: self.name,
    text: data === 'unicode' ? '\u2022pong\u2022' : formatMessage(data),
  });
};
