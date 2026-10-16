export declare const findHierarchyNode: <T>(hierarchyData: T[], key: string, keyField?: string, childrenField?: string) => T;
export declare const findHierarchyNodeParent: <T>(hierarchyData: T[], key: string, keyField?: string, childrenField?: string) => T;
export declare const findHierarchyPath: <T>(hierarchyData: T[], key: string, keyField?: string, childrenField?: string) => string[];
export declare function isHierarchyItem(item: Object, valueField?: string, childrenField?: string): boolean;
export declare function filterHierarchyDataByRange(data: any[], minValue: number, maxValue: number, valueField?: string, childrenField?: string): any[];
