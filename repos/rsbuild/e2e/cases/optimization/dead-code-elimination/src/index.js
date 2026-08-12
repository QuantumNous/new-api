import { test as testExportedMutator } from './lib';
import { test as testExportedState } from './exported-state';

console.log(testExportedMutator(), testExportedState());
