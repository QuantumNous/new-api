import React, { ReactNode, MouseEvent } from 'react';
import {
    BasicTreeProps,
    BasicExpandedOtherProps,
    BasicRenderFullLabelProps,
    BasicSearchRenderProps,
    BasicTreeInnerData,
    BasicKeyEntities,
    BasicKeyEntity,
    BasicTreeNodeProps,
    BasicFlattenNode,
    BasicTreeNodeData,
    BasicOnDragProps,
    KeyMapProps,
} from '@douyinfe/semi-foundation/tree/foundation';

/* Tree */
export type Value = string | number | TreeNodeData | Array<TreeNodeData | number | string>;


export interface DragTreeNode extends TreeNodeData {
    expanded: boolean;
    /**
     * The positional relationship of the current node in the entire
     * treeData, such as the 0th node of the 2nd node of the 1st node
     * of the 0th layer: '0-1-2-0'
     */
    pos: string
}
export interface DragProps {
    event: MouseEvent;
    node: DragTreeNode
}
export interface OnDragProps extends BasicOnDragProps {
    event: MouseEvent;
    node: DragTreeNode;
    dragNode: DragTreeNode
}

export interface DragEnterProps extends DragProps {
    expandedKeys?: string[]
}

export interface ExpandedOtherProps extends BasicExpandedOtherProps {
    node: TreeNodeData
}
export interface RenderFullLabelProps extends BasicRenderFullLabelProps {
    onClick: (e: MouseEvent) => void;
    onContextMenu: (e: MouseEvent) => void;
    onDoubleClick: (e: MouseEvent) => void;
    onExpand: (e: MouseEvent) => void;
    data: TreeNodeData;
    style: React.CSSProperties;
    onCheck: (e: MouseEvent) => void;
    expandIcon: ReactNode
}
export interface SearchRenderProps extends BasicSearchRenderProps {
    prefix: ReactNode
}
export interface TreeProps extends BasicTreeProps {
    children?: ReactNode;
    defaultValue?: Value;
    emptyContent?: ReactNode;
    filterTreeNode?: boolean | ((inputValue: string, treeNodeString: string, data?: TreeNodeData) => boolean);
    searchRender?: ((searchRenderProps: SearchRenderProps) => ReactNode) | false;
    searchStyle?: React.CSSProperties;
    style?: React.CSSProperties;
    treeData?: TreeNodeData[];
    value?: Value;
    icon?: ReactNode | ((props: TreeNodeProps) => ReactNode);
    keyMaps?: KeyMapProps;
    loadData?: (treeNode?: TreeNodeData) => Promise<void>;
    onChange?: (value?: Value) => void;
    onDoubleClick?: (e: MouseEvent, node: TreeNodeData) => void;
    onDragEnd?: (dragProps: DragProps) => void;
    onDragLeave?: (dragProps: DragProps) => void;
    onDragOver?: (dragProps: DragProps) => void;
    onDragStart?: (dragProps: DragProps) => void;
    onDragEnter?: (dragEnterProps: DragEnterProps) => void;
    onDrop?: (onDragProps: OnDragProps) => void;
    onExpand?: (expandedKeys: string[], expandedOtherProps: ExpandedOtherProps) => void;
    onLoad?: (loadedKeys?: Set<string>, treeNode?: TreeNodeData) => void;
    onContextMenu?: (e: MouseEvent, node: TreeNodeData) => void;
    onSelect?: (selectedKey: string, selected: boolean, selectedNode: TreeNodeData) => void;
    renderDraggingNode?: (nodeInstance: HTMLElement, node: TreeNodeData) => HTMLElement;
    renderFullLabel?: (renderFullLabelProps: RenderFullLabelProps) => ReactNode;
    renderLabel?: (label?: ReactNode, treeNode?: TreeNodeData, searchWord?: string) => ReactNode;
    autoMergeValue?: boolean;
    expandIcon?: ReactNode
}
export interface OptionProps {
    index: number;
    style: React.CSSProperties;
    data: KeyEntity
}
export interface KeyEntities extends BasicKeyEntities {
    [key: string]: KeyEntity
}
export interface KeyEntity extends BasicKeyEntity {
    children?: KeyEntities;
    data?: TreeNodeData;
    parent?: undefined | KeyEntity
}
export interface TreeState extends BasicTreeInnerData {
    keyEntities: KeyEntities;
    treeData: TreeNodeData[];
    flattenNodes: FlattenNode[];
    prevProps: null | TreeProps;
    cachedFlattenNodes: FlattenNode[] | undefined
}

/* TreeNode */
export interface TreeNodeProps extends BasicTreeNodeProps {
    children?: TreeNodeData[];
    icon?: ReactNode;
    isEnd?: boolean[];
    expandIcon?: ReactNode | ((props: {
        onClick: (e: MouseEvent) => void;
        className: string;
        expanded: boolean
    }) => ReactNode)
}
export interface TreeNodeState {
    [x: string]: any
}

/* NodeList */
export interface TreeNodeData extends BasicTreeNodeData {
    label?: ReactNode;
    icon?: ReactNode;
    children?: TreeNodeData[]
}
export interface FlattenNode extends BasicFlattenNode {
    children?: FlattenNode[];
    data?: BasicTreeNodeData;
    label?: ReactNode;
    parent?: null | FlattenNode;
    isEnd?: boolean[]
}
export interface NodeListProps {
    [x: string]: any;
    flattenNodes: FlattenNode[];
    motionKeys: Set<string>;
    motionType: string;
    flattenList: FlattenNode[] | undefined;
    searchTargetIsDeep?: boolean;
    renderTreeNode: (treeNode: FlattenNode, ind?: number, style?: React.CSSProperties) => ReactNode
}
export type TransitionNodes<T> = Array<T | Array<T>>;
export interface NodeListState {
    transitionNodes: TransitionNodes<FlattenNode>;
    cachedMotionKeys?: Set<string>;
    cachedData?: FlattenNode[]
}

export interface ScrollData {
    key: string;
    // The align parameter is consistent with react-window
    align?: 'center' | 'start' | 'end' | 'smart' | 'auto'
}
