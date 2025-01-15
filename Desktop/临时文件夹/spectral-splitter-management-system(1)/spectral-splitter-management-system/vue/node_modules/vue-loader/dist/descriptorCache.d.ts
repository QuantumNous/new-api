import type { SFCDescriptor } from 'vue/compiler-sfc';
export declare const descriptorCache: Map<string, SFCDescriptor>;
export declare function setDescriptor(filename: string, entry: SFCDescriptor): void;
export declare function getDescriptor(filename: string): SFCDescriptor;
