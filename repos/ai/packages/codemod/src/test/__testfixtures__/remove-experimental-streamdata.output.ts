// @ts-nocheck
import { StreamData } from 'ai';
import { experimental_StreamData as StreamDataLegacy } from 'other-pkg';

// Should rename - class extension
class CustomStream extends StreamData {
  // Custom implementation
}

// Should rename - type usage
const createStream = (): StreamData => {
  return new StreamData();
};

// Should rename - instance check
const isStreamData = (obj: unknown): obj is StreamData => {
  return obj instanceof StreamData;
};

// Should NOT rename - different package
class OtherStream extends StreamDataLegacy {
  // Custom implementation
}
