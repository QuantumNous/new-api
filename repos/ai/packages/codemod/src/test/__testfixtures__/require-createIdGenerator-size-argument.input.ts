// @ts-nocheck
import { createIdGenerator } from 'ai';

// Case 1: createIdGenerator() with size passed to generator call
const generator = createIdGenerator({ prefix: 'msg' });
const id2 = generator(16);

// Case 2: createIdGenerator() without options, size passed to generator call
const generator2 = createIdGenerator();
const id3 = generator2(32);

// Case 3: Multiple calls with same size
const generator3 = createIdGenerator({ prefix: 'user' });
const id4 = generator3(8);
const id5 = generator3(8);

// Case 4: Generator without size argument (should remain unchanged)
const generator4 = createIdGenerator({ size: 24 });
const id6 = generator4();

// Case 5: Multiple generators
const msgGenerator = createIdGenerator({ prefix: 'msg' });
const userGenerator = createIdGenerator({ prefix: 'user' });
const msgId = msgGenerator(16);
const userId = userGenerator(12);

// Case 6: Generator assigned later
let laterGenerator;
laterGenerator = createIdGenerator();
const laterId = laterGenerator(20);