"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
const array_flatten_1 = __importDefault(require("array-flatten"));
const es6_1 = __importDefault(require("fast-deep-equal/es6"));
const multicast_dns_1 = __importDefault(require("multicast-dns"));
const dns_equal_1 = __importDefault(require("dns-equal"));
class Server {
    constructor(opts, errorCallback) {
        this.registry = {};
        this.mdns = (0, multicast_dns_1.default)(opts);
        this.mdns.setMaxListeners(0);
        this.mdns.on('query', this.respondToQuery.bind(this));
        this.errorCallback = errorCallback !== null && errorCallback !== void 0 ? errorCallback : function (err) { throw err; };
    }
    register(records) {
        const shouldRegister = (record) => {
            var subRegistry = this.registry[record.type];
            if (!subRegistry) {
                subRegistry = this.registry[record.type] = [];
            }
            else if (subRegistry.some(this.isDuplicateRecord(record))) {
                return;
            }
            subRegistry.push(record);
        };
        if (Array.isArray(records)) {
            records.forEach(shouldRegister);
        }
        else {
            shouldRegister(records);
        }
    }
    unregister(records) {
        const shouldUnregister = (record) => {
            let type = record.type;
            if (!(type in this.registry)) {
                return;
            }
            this.registry[type] = this.registry[type].filter((i) => i.name !== record.name);
        };
        if (Array.isArray(records)) {
            records.forEach(shouldUnregister);
        }
        else {
            shouldUnregister(records);
        }
    }
    respondToQuery(query) {
        let self = this;
        query.questions.forEach((question) => {
            var type = question.type;
            var name = question.name;
            var answers = type === 'ANY'
                ? array_flatten_1.default.depth(Object.keys(self.registry).map(self.recordsFor.bind(self, name)), 1)
                : self.recordsFor(name, type);
            if (answers.length === 0)
                return;
            var additionals = [];
            if (type !== 'ANY') {
                answers.forEach((answer) => {
                    if (answer.type !== 'PTR')
                        return;
                    additionals = additionals
                        .concat(self.recordsFor(answer.data, 'SRV'))
                        .concat(self.recordsFor(answer.data, 'TXT'));
                });
                additionals
                    .filter(function (record) {
                    return record.type === 'SRV';
                })
                    .map(function (record) {
                    return record.data.target;
                })
                    .filter(this.unique())
                    .forEach(function (target) {
                    additionals = additionals
                        .concat(self.recordsFor(target, 'A'))
                        .concat(self.recordsFor(target, 'AAAA'));
                });
            }
            self.mdns.respond({ answers: answers, additionals: additionals }, (err) => {
                if (err) {
                    this.errorCallback(err);
                }
            });
        });
    }
    recordsFor(name, type) {
        if (!(type in this.registry)) {
            return [];
        }
        return this.registry[type].filter((record) => {
            var _name = ~name.indexOf('.') ? record.name : record.name.split('.')[0];
            return (0, dns_equal_1.default)(_name, name);
        });
    }
    isDuplicateRecord(a) {
        return (b) => {
            return a.type === b.type &&
                a.name === b.name &&
                (0, es6_1.default)(a.data, b.data);
        };
    }
    unique() {
        var set = [];
        return (obj) => {
            if (~set.indexOf(obj))
                return false;
            set.push(obj);
            return true;
        };
    }
}
exports.Server = Server;
exports.default = Server;
//# sourceMappingURL=mdns-server.js.map