import type { IMark } from '../mark/interface';
import type { IMorphConfig } from '../animation/spec';
export declare const morph: (prevMarks: IMark[], nextMarks: IMark[], morphConfig?: IMorphConfig) => boolean;
