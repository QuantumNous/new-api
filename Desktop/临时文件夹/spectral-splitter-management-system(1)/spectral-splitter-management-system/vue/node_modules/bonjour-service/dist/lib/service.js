"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Service = void 0;
const os_1 = __importDefault(require("os"));
const dns_txt_1 = __importDefault(require("./dns-txt"));
const events_1 = require("events");
const service_types_1 = require("./service-types");
const TLD = '.local';
class Service extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.probe = true;
        this.published = false;
        this.activated = false;
        this.destroyed = false;
        this.txtService = new dns_txt_1.default();
        if (!config.name)
            throw new Error('ServiceConfig requires `name` property to be set');
        if (!config.type)
            throw new Error('ServiceConfig requires `type` property to be set');
        if (!config.port)
            throw new Error('ServiceConfig requires `port` property to be set');
        this.name = config.name.split('.').join('-');
        this.protocol = config.protocol || 'tcp';
        this.type = (0, service_types_1.toString)({ name: config.type, protocol: this.protocol });
        this.port = config.port;
        this.host = config.host || os_1.default.hostname();
        this.fqdn = `${this.name}.${this.type}${TLD}`;
        this.txt = config.txt;
        this.subtypes = config.subtypes;
    }
    records() {
        var records = [this.RecordPTR(this), this.RecordSRV(this), this.RecordTXT(this)];
        for (let subtype of this.subtypes || []) {
            records.push(this.RecordSubtypePTR(this, subtype));
        }
        let ifaces = Object.values(os_1.default.networkInterfaces());
        for (let iface of ifaces) {
            let addrs = iface;
            for (let addr of addrs) {
                if (addr.internal || addr.mac === '00:00:00:00:00:00')
                    continue;
                switch (addr.family) {
                    case 'IPv4':
                        records.push(this.RecordA(this, addr.address));
                        break;
                    case 'IPv6':
                        records.push(this.RecordAAAA(this, addr.address));
                        break;
                }
            }
        }
        return records;
    }
    RecordPTR(service) {
        return {
            name: `${service.type}${TLD}`,
            type: 'PTR',
            ttl: 28800,
            data: service.fqdn
        };
    }
    RecordSubtypePTR(service, subtype) {
        return {
            name: `_${subtype}._sub.${service.type}${TLD}`,
            type: 'PTR',
            ttl: 28800,
            data: `${service.name}.${service.type}${TLD}`
        };
    }
    RecordSRV(service) {
        return {
            name: service.fqdn,
            type: 'SRV',
            ttl: 120,
            data: {
                port: service.port,
                target: service.host
            }
        };
    }
    RecordTXT(service) {
        return {
            name: service.fqdn,
            type: 'TXT',
            ttl: 4500,
            data: this.txtService.encode(service.txt)
        };
    }
    RecordA(service, ip) {
        return {
            name: service.host,
            type: 'A',
            ttl: 120,
            data: ip
        };
    }
    RecordAAAA(service, ip) {
        return {
            name: service.host,
            type: 'AAAA',
            ttl: 120,
            data: ip
        };
    }
}
exports.Service = Service;
exports.default = Service;
//# sourceMappingURL=service.js.map