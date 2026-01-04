import React, { ReactNode, MouseEvent, DragEvent, KeyboardEvent } from 'react';
import { Virtualize, ExpandAction } from '@douyinfe/semi-foundation/tree/foundation';
import {
    TreeNodeData,
    KeyEntities,
    TreeNodeProps,
    FlattenNode,
    RenderFullLabelProps
} from './interface';

export interface TreeContextValue {
    treeDisabled?: boolean;
    treeIcon?: ReactNode | ((props: TreeNodeProps) => ReactNode);
    motion?: boolean;
    motionKeys?: Set<string>;
    motionType?: string;
    filterTreeNode?: boolean | ((inputValue: string, treeNodeString: string) => void);
    keyEntities?: KeyEntities;
    onNodeClick?: any;
    onNodeExpand?: (e: MouseEvent | KeyboardEvent, treeNode: TreeNodeProps) => void;
    onNodeSelect?: (e: MouseEvent | KeyboardEvent, treeNode: TreeNodeProps) => void;
    onNodeCheck?: (e: MouseEvent | KeyboardEvent, treeNode: TreeNodeProps) => void;
    onNodeRightClick?: (e: MouseEvent, treeNode: TreeNodeProps) => void;
    onNodeDoubleClick?: (e: MouseEvent, treeNode: TreeNodeProps) => void;
    renderTreeNode?: (treeNode: FlattenNode, ind?: number, style?: React.CSSProperties) => ReactNode;
    onNodeDragStart?: (e: DragEvent<HTMLLIElement>, treeNode: TreeNodeProps) => void;
    onNodeDragEnter?: (e: DragEvent<HTMLLIElement>, treeNode: TreeNodeProps) => void;
    onNodeDragOver?: (e: DragEvent<HTMLLIElement>, treeNode: TreeNodeProps) => void;
    onNodeDragLeave?: (e: DragEvent<HTMLLIElement>, treeNode: TreeNodeProps) => void;
    onNodeDragEnd?: (e: DragEvent<HTMLLIElement>, treeNode: TreeNodeProps) => void;
    onNodeDrop?: (e: DragEvent<HTMLLIElement>, treeNode: TreeNodeProps) => void;
    expandAction?: ExpandAction;
    directory?: boolean;
    multiple?: boolean;
    showFilteredOnly?: boolean;
    isSearching?: boolean;
    loadData?: (treeNode?: TreeNodeData) => Promise<void>;
    onNodeLoad?: (data: TreeNodeData) => Promise<unknown>;
    renderLabel?: (label?: ReactNode, treeNode?: TreeNodeData, searchWord?: string) => ReactNode;
    draggable?: boolean;
    renderFullLabel?: (renderFullLabelProps: RenderFullLabelProps) => React.ReactNode;
    dragOverNodeKey?: string | string[];
    dropPosition?: number | null;
    labelEllipsis?: boolean | Virtualize
}

const TreeContext = React.createContext<TreeContextValue>(null);

export default TreeContext;