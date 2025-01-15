export interface ServiceType {
    name?: string;
    protocol?: 'tcp' | 'udp' | string | null | undefined;
    subtype?: string | undefined;
}
export declare const toString: (data: ServiceType) => any;
export declare const toType: (string: string) => ServiceType;
