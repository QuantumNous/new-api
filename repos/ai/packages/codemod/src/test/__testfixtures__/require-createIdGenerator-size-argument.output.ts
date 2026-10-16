// @ts-nocheck
import { createIdGenerator } from 'ai';

// Case 1: createIdGenerator() with size passed to generator call
const generator = createIdGenerator({
  prefix: 'msg',
  size: 16
});
const id2 = generator();

// Case 2: createIdGenerator() without options, size passed to generator call
const generator2 = createIdGenerator({
  size: 32
});
const id3 = generator2();

// Case 3: Multiple calls with same size
const generator3 = createIdGenerator({
  prefix: 'user',
  size: 8
});
const id4 = generator3();
const id5 = generator3();

// Case 4: Generator without size argument (should remain unchanged)
const generator4 = createIdGenerator({ size: 24 });
const id6 = generator4();

// Case 5: Multiple generators
const msgGenerator = createIdGenerator({
  prefix: 'msg',
  size: 16
});
const userGenerator = createIdGenerator({
  prefix: 'user',
  size: 12
});
const msgId = msgGenerator();
const userId = userGenerator();

// Case 6: Generator assigned later
let laterGenerator;
laterGenerator = createIdGenerator({
  size: 20
});
const laterId = laterGenerator();