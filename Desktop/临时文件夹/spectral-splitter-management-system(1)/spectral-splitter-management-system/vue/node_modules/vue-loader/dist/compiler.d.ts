declare module 'vue/compiler-sfc' {
    interface SFCDescriptor {
        id: string;
    }
}
import * as _compiler from 'vue/compiler-sfc';
export declare let compiler: typeof _compiler;
