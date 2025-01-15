import Browser, { BrowserConfig } from './lib/browser';
import Service, { ServiceConfig, ServiceReferer } from './lib/service';
export declare class Bonjour {
    private server;
    private registry;
    constructor(opts?: ServiceConfig | undefined, errorCallback?: Function | undefined);
    publish(opts: ServiceConfig): Service;
    unpublishAll(callback?: CallableFunction | undefined): void;
    find(opts?: BrowserConfig | undefined, onup?: (service: Service) => void): Browser;
    findOne(opts?: BrowserConfig | undefined, timeout?: number, callback?: CallableFunction): Browser;
    destroy(): void;
}
export { Service, ServiceReferer, ServiceConfig, Browser, BrowserConfig };
export default Bonjour;
