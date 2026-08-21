import type { DataView } from '@visactor/vdataset';
export declare const detachDataViewDependencies: (dataView?: DataView | null) => void;
export declare const releaseDataViews: (dataViews: Array<DataView | null | undefined>) => void;
export declare const releaseDataView: (dataView?: DataView | null) => void;
export declare const releaseDataViewWithDependencies: (dataView: DataView | null | undefined, shouldReleaseDependency: (dataView: DataView) => boolean) => void;
