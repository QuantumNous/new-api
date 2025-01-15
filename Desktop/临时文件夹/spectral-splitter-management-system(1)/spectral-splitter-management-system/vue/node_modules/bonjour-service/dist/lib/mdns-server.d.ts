import { ServiceRecord } from './service';
export declare class Server {
    mdns: any;
    private registry;
    private errorCallback;
    constructor(opts: any, errorCallback?: Function | undefined);
    register(records: Array<ServiceRecord> | ServiceRecord): void;
    unregister(records: Array<ServiceRecord> | ServiceRecord): void;
    private respondToQuery;
    private recordsFor;
    private isDuplicateRecord;
    private unique;
}
export default Server;
