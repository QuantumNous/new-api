import type { StatisticOperations } from '../../data/transforms/interface';
export declare const appendHierarchyFields: (fields: {
    key: string;
    operations: StatisticOperations;
}[], catField: string, valueField: string) => {
    key: string;
    operations: StatisticOperations;
}[];
