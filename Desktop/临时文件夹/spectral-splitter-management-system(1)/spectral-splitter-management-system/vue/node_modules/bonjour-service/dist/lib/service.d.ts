/// <reference types="node" />
import KeyValue from './KeyValue';
import { EventEmitter } from 'events';
export interface ServiceConfig {
    name: string;
    type: string;
    port: number;
    protocol?: 'tcp' | 'udp';
    host?: string;
    fqdn?: string;
    subtypes?: Array<string>;
    txt?: KeyValue;
    probe?: boolean;
}
export interface ServiceRecord {
    name: string;
    type: 'PTR' | 'SRV' | 'TXT' | 'A' | 'AAAA';
    ttl: number;
    data: KeyValue | string | any;
}
export interface ServiceReferer {
    address: string;
    family: 'IPv4' | 'IPv6';
    port: number;
    size: number;
}
export declare class Service extends EventEmitter {
    name: string;
    type: string;
    protocol: 'tcp' | 'udp';
    port: number;
    host: string;
    fqdn: string;
    txt?: any;
    subtypes?: Array<string>;
    addresses?: Array<string>;
    referer?: ServiceReferer;
    probe: boolean;
    published: boolean;
    activated: boolean;
    destroyed: boolean;
    start?: any;
    stop?: any;
    private txtService;
    constructor(config: ServiceConfig);
    records(): Array<ServiceRecord>;
    private RecordPTR;
    private RecordSubtypePTR;
    private RecordSRV;
    private RecordTXT;
    private RecordA;
    private RecordAAAA;
}
export default Service;
