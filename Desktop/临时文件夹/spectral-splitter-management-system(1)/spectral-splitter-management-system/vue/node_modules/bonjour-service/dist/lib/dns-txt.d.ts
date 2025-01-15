/// <reference types="node" />
import KeyValue from './KeyValue';
export declare class DnsTxt {
    private binary;
    constructor(opts?: KeyValue);
    encode(data?: KeyValue): Buffer[];
    decode(buffer: Buffer): KeyValue;
    decodeAll(buffer: Array<Buffer>): KeyValue;
}
export default DnsTxt;
