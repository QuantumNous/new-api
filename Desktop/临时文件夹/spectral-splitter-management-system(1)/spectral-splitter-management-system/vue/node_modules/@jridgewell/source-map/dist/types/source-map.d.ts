import { AnyMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { GenMapping, maybeAddMapping, toDecodedMap, toEncodedMap, setSourceContent } from '@jridgewell/gen-mapping';
import type { TraceMap, SectionedSourceMapInput } from '@jridgewell/trace-mapping';
export type { TraceMap, SectionedSourceMapInput };
import type { Mapping, EncodedSourceMap, DecodedSourceMap } from '@jridgewell/gen-mapping';
export type { Mapping, EncodedSourceMap, DecodedSourceMap };
export declare class SourceMapConsumer {
    private _map;
    file: TraceMap['file'];
    names: TraceMap['names'];
    sourceRoot: TraceMap['sourceRoot'];
    sources: TraceMap['sources'];
    sourcesContent: TraceMap['sourcesContent'];
    constructor(map: ConstructorParameters<typeof AnyMap>[0], mapUrl: Parameters<typeof AnyMap>[1]);
    originalPositionFor(needle: Parameters<typeof originalPositionFor>[1]): ReturnType<typeof originalPositionFor>;
    destroy(): void;
}
export declare class SourceMapGenerator {
    private _map;
    constructor(opts: ConstructorParameters<typeof GenMapping>[0]);
    addMapping(mapping: Parameters<typeof maybeAddMapping>[1]): ReturnType<typeof maybeAddMapping>;
    setSourceContent(source: Parameters<typeof setSourceContent>[1], content: Parameters<typeof setSourceContent>[2]): ReturnType<typeof setSourceContent>;
    toJSON(): ReturnType<typeof toEncodedMap>;
    toDecodedMap(): ReturnType<typeof toDecodedMap>;
}
