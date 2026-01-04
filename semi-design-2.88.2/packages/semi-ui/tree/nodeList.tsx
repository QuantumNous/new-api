import React, { PureComponent } from 'react';
import { isEqual } from 'lodash';
import TreeContext from './treeContext';
import { FlattenNode, NodeListProps, NodeListState, TransitionNodes } from './interface';
import NodeCollapsible from './nodeCollapsible';

const getTreeNodeKey = (treeNode: FlattenNode) => {
    return treeNode.key;
};

export default class NodeList extends PureComponent<NodeListProps, NodeListState> {
    static contextType = TreeContext;

    constructor(props: NodeListProps) {
        super(props);
        this.state = {
            transitionNodes: [],
        };
    }

    static getDerivedStateFromProps(props: NodeListProps, prevState: NodeListState) {
        const { flattenNodes = [], motionKeys, motionType, flattenList = [] } = props;
        const hasChanged = !isEqual(prevState.cachedMotionKeys, motionKeys) ||
        !isEqual(prevState.cachedData.map(i => i.key), flattenNodes.map(i => i.key));
        const motionArr = [...motionKeys];
        if (!hasChanged || !motionArr.length) {
            return null;
        }
        const transitionNodes: TransitionNodes<FlattenNode> = [];
        const transitionRange: FlattenNode[] = [];
        let rangeStart = 0;
        let newState = {};
        const lookUpTarget = motionType === 'hide' && flattenList ? flattenList : flattenNodes;
        lookUpTarget.forEach((treeNode, ind) => {
            const nodeKey = getTreeNodeKey(treeNode);
            if (motionKeys.has(nodeKey)) {
                transitionRange.push(treeNode);
                if (nodeKey === motionArr[0]) {
                    rangeStart = ind;
                }
            } else {
                transitionNodes.push(treeNode);
            }
        });
        transitionNodes.splice(rangeStart, 0, transitionRange);
        newState = {
            transitionNodes,
            cachedData: flattenNodes,
            cachedMotionKeys: motionKeys,
            cachedMotionType: motionType
        };
        return newState;
    }

    onMotionEnd = () => {
        typeof this.props.onMotionEnd === 'function' && this.props.onMotionEnd();
        this.setState({ transitionNodes: [] });
    };

    render() {
        const { flattenNodes, motionType, searchTargetIsDeep, renderTreeNode } = this.props;
        const { transitionNodes } = this.state;
        const mapData = transitionNodes.length && !searchTargetIsDeep ? transitionNodes : flattenNodes;
        const options = mapData.map(treeNode => {
            const isMotionNode = Array.isArray(treeNode);
            if (isMotionNode && !(treeNode as FlattenNode[]).length) {
                return null;
            }
            if (isMotionNode && (treeNode as FlattenNode[]).length) {
                const nodeKey = getTreeNodeKey(treeNode[0]);
                return (
                    <NodeCollapsible
                        open={motionType === 'hide'}
                        duration={200}
                        motion={Boolean(motionType)}
                        key={`motion-${nodeKey}`}
                        onMotionEnd={this.onMotionEnd}
                    >
                        {treeNode.map(node => renderTreeNode(node))}
                    </NodeCollapsible>
                );
            }
            return renderTreeNode(treeNode as FlattenNode);
        });
        return options;
    }
}
