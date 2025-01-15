import Server from './mdns-server';
import Service, { ServiceConfig } from './service';
export declare class Registry {
    private server;
    private services;
    constructor(server: Server);
    publish(config: ServiceConfig): Service;
    unpublishAll(callback: CallableFunction | undefined): void;
    destroy(): void;
    private probe;
    private announce;
    private teardown;
}
export default Registry;
