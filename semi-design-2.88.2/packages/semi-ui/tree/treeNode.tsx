import React, { PureComponent } from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { cssClasses } from '@douyinfe/semi-foundation/tree/constants';
import isEnterPress from '@douyinfe/semi-foundation/utils/isEnterPress';
import { debounce, isFunction, isString, get, isEmpty } from 'lodash';
import { IconTreeTriangleDown, IconFile, IconFolder, IconFolderOpen } from '@douyinfe/semi-icons';
import { Checkbox } from '../checkbox';
import TreeContext, { TreeContextValue } from './treeContext';
import Spin from '../spin';
import { TreeNodeProps, TreeNodeState } from './interface';
import Highlight from '../highlight';
import Indent from './indent';

const prefixcls = cssClasses.PREFIX_OPTION;

export default class TreeNode extends PureComponent<TreeNodeProps, TreeNodeState> {
    static contextType = TreeContext;

    static propTypes = {
        expanded: PropTypes.bool,
        selected: PropTypes.bool,
        checked: PropTypes.bool,
        halfChecked: PropTypes.bool,
        active: PropTypes.bool,
        disabled: PropTypes.bool,
        loaded: PropTypes.bool,
        loading: PropTypes.bool,
        isLeaf: PropTypes.bool,
        pos: PropTypes.string,
        children: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
        icon: PropTypes.node,
        directory: PropTypes.bool,
        keyword: PropTypes.string,
        treeNodeFilterProp: PropTypes.string,
        selectedKey: PropTypes.string,
        motionKey: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
        isEnd: PropTypes.arrayOf(PropTypes.bool),
        showLine: PropTypes.bool,
        expandIcon: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
    };

    static defaultProps = {
        selectedKey: '',
        motionKey: '',
    };

    debounceSelect: any;
    refNode: HTMLElement;
    context: TreeContextValue;

    constructor(props: TreeNodeProps) {
        super(props);
        this.state = {};
        this.debounceSelect = debounce(this.onSelect, 500, {
            leading: true,
            trailing: false
        });
    }

    onSelect = (e: React.MouseEvent | React.KeyboardEvent) => {
        const { onNodeSelect } = this.context;
        onNodeSelect(e, this.props);
    };

    onExpand = (e: React.MouseEvent | React.KeyboardEvent) => {
        const { onNodeExpand } = this.context;
        e && e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        onNodeExpand(e, this.props);
    };

    onCheck = (e: React.MouseEvent | React.KeyboardEvent) => {
        if (this.isDisabled()) {
            return;
        }
        const { onNodeCheck } = this.context;
        e.stopPropagation();
        e.nativeEvent?.stopImmediatePropagation?.();
        onNodeCheck(e, this.props);
    };

    /**
     * A11y: simulate checkbox click
     */
    handleCheckEnterPress = (e: React.KeyboardEvent) => {
        if (isEnterPress(e)) {
            this.onCheck(e);
        }
    }

    onContextMenu = (e: React.MouseEvent) => {
        const { onNodeRightClick } = this.context;
        onNodeRightClick(e, this.props);
    };

    onClick = (e: React.MouseEvent | React.KeyboardEvent) => {
        const { expandAction } = this.context;
        if (expandAction === 'doubleClick') {
            this.debounceSelect(e);
            return;
        }
        this.onSelect(e);
        if (expandAction === 'click') {
            this.onExpand(e);
        }
    };

    /**
     * A11y: simulate li click
     */
    handleliEnterPress = (e: React.KeyboardEvent) => {
        if (isEnterPress(e)) {
            this.onClick(e);
        }
    }

    onDoubleClick = (e: React.MouseEvent) => {
        const { expandAction, onNodeDoubleClick } = this.context;
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        if (isFunction(onNodeDoubleClick)) {
            onNodeDoubleClick(e, this.props);
        }
        if (expandAction === 'doubleClick') {
            this.onExpand(e);
        }
    };

    onDragStart = (e: React.DragEvent<HTMLLIElement>) => {
        const { onNodeDragStart } = this.context;
        e.stopPropagation();
        onNodeDragStart(e, { ...this.props, nodeInstance: this.refNode });

        try {
            // ie throw error
            // firefox-need-it
            e.dataTransfer.setData('text/plain', '');
        } catch (error) {
            // empty
        }
    };

    onDragEnter = (e: React.DragEvent<HTMLLIElement>) => {
        const { onNodeDragEnter } = this.context;
        e.preventDefault();
        e.stopPropagation();
        onNodeDragEnter(e, { ...this.props, nodeInstance: this.refNode });
    };

    onDragOver = (e: React.DragEvent<HTMLLIElement>) => {
        const { onNodeDragOver } = this.context;
        e.preventDefault();
        e.stopPropagation();
        onNodeDragOver(e, { ...this.props, nodeInstance: this.refNode });
    };

    onDragLeave = (e: React.DragEvent<HTMLLIElement>) => {
        const { onNodeDragLeave } = this.context;
        e.stopPropagation();
        onNodeDragLeave(e, { ...this.props, nodeInstance: this.refNode });
    };

    onDragEnd = (e: React.DragEvent<HTMLLIElement>) => {
        const { onNodeDragEnd } = this.context;
        e.stopPropagation();
        onNodeDragEnd(e, { ...this.props, nodeInstance: this.refNode });
    };

    onDrop = (e: React.DragEvent<HTMLLIElement>) => {
        const { onNodeDrop } = this.context;
        e.preventDefault();
        e.stopPropagation();
        onNodeDrop(e, { ...this.props, nodeInstance: this.refNode });
    };

    getNodeChildren = () => {
        const { children } = this.props;
        return children || [];
    };

    isLeaf = () => {
        const { isLeaf, loaded } = this.props;
        const { loadData } = this.context;
        const hasChildren = this.getNodeChildren().length !== 0;

        if (isLeaf === false) {
            return false;
        }

        return isLeaf || (!loadData && !hasChildren) || (loadData && loaded && !hasChildren);
    };

    isDisabled = () => {
        const { disabled } = this.props;
        const { treeDisabled } = this.context;

        if (disabled === false) {
            return false;
        }

        return Boolean(treeDisabled || disabled);
    };

    renderArrow() {
        const showIcon = !this.isLeaf();
        const { loading, expanded, showLine, expandIcon } = this.props;
        if (loading) {
            return <Spin wrapperClassName={`${prefixcls}-spin-icon`} />;
        }
        if (showIcon) {
            if (expandIcon) {
                if (typeof expandIcon === 'function') {
                    return expandIcon({
                        onClick: this.onExpand,
                        className: `${prefixcls}-expand-icon`,
                        expanded
                    });
                } else if (React.isValidElement(expandIcon)) {
                    const className = cls(`${prefixcls}-expand-icon`, {
                        [expandIcon?.props?.className]: expandIcon?.props?.className
                    });
                    return React.cloneElement(expandIcon, {
                        onClick: this.onExpand,
                        className,
                    } as any);
                } else {
                    return expandIcon;
                }
            }
            return (
                <IconTreeTriangleDown
                    role='button'
                    aria-label={`${expanded ? 'Expand' : 'Collapse'} the tree item`}
                    className={`${prefixcls}-expand-icon`}
                    size="small"
                    onClick={this.onExpand}
                />
            );
        }
        if (showLine) {
            return this.renderSwitcher();
        }
        return (
            <span className={`${prefixcls}-empty-icon`} />
        );
    }

    renderCheckbox() {
        const { checked, halfChecked, eventKey } = this.props;
        const disabled = this.isDisabled();
        return (
            <div
                role='none'
                onClick={this.onCheck}
                onKeyPress={this.handleCheckEnterPress}
            >
                <Checkbox
                    aria-label='Toggle the checked state of checkbox'
                    value={eventKey}
                    indeterminate={halfChecked}
                    checked={checked}
                    disabled={Boolean(disabled)}
                />
            </div>
        );
    }

    // Switcher
    renderSwitcher = () => {
        if (this.isLeaf()) {
            // if switcherIconDom is null, no render switcher span
            return (<span className={cls(`${prefixcls}-switcher`)} >
                <span className={`${prefixcls}-switcher-leaf-line`} />
            </span>);

        }
        return null;
    };

    renderIcon() {
        const {
            directory,
            treeIcon
        } = this.context;
        const { expanded, icon, data } = this.props;
        if (icon) {
            return icon;
        }
        if (treeIcon) {
            return typeof treeIcon === 'function' ? treeIcon(this.props) : treeIcon;
        }
        if (directory) {
            const hasChild = !this.isLeaf();
            if (!hasChild) {
                return <IconFile className={`${prefixcls}-item-icon`} />;
            } else {
                return expanded ? <IconFolderOpen className={`${prefixcls}-item-icon`} /> : <IconFolder className={`${prefixcls}-item-icon`} />;
            }
        }
        return null;
    }

    renderEmptyNode() {
        const { emptyContent } = this.props;
        const wrapperCls = cls(prefixcls, {
            [`${prefixcls}-empty`]: true,
        });
        return (
            <ul className={wrapperCls}>
                <li className={`${prefixcls}-label ${prefixcls}-label-empty`} x-semi-prop="emptyContent">
                    {emptyContent}
                </li>
            </ul>
        );
    }

    renderRealLabel = () => {
        const { renderLabel } = this.context;
        const { label, keyword, data, filtered, treeNodeFilterProp } = this.props;
        if (isFunction(renderLabel)) {
            return renderLabel(label, data, keyword);
        } else if (isString(label) && filtered && keyword) {
            return (
                <Highlight
                    highlightClassName={`${prefixcls}-highlight`}
                    component='span'
                    sourceString={label}
                    searchWords={[keyword]}
                />
            );
        } else {
            return label;
        }
    };

    setRef = (node: HTMLElement) => {
        this.refNode = node;
    };

    render() {
        const {
            eventKey,
            expanded,
            selected,
            checked,
            halfChecked,
            loading,
            active,
            level,
            empty,
            filtered,
            treeNodeFilterProp,
            display,
            style,
            isEnd,
            showLine,
            ...rest
        } = this.props;
        if (empty) {
            return this.renderEmptyNode();
        }
        const {
            multiple,
            draggable,
            renderFullLabel,
            dragOverNodeKey,
            dropPosition,
            labelEllipsis
        } = this.context;
        const isEndNode = isEnd[isEnd.length - 1];
        const disabled = this.isDisabled();
        const dragOver = dragOverNodeKey === eventKey && dropPosition === 0;
        const dragOverGapTop = dragOverNodeKey === eventKey && dropPosition === -1;
        const dragOverGapBottom = dragOverNodeKey === eventKey && dropPosition === 1;
        const nodeCls = cls(prefixcls, {
            [`${prefixcls}-level-${level + 1}`]: true,
            [`${prefixcls}-fullLabel-level-${level + 1}`]: renderFullLabel,
            [`${prefixcls}-collapsed`]: !expanded,
            [`${prefixcls}-disabled`]: Boolean(disabled),
            [`${prefixcls}-selected`]: selected,
            [`${prefixcls}-active`]: !multiple && active,
            [`${prefixcls}-ellipsis`]: labelEllipsis,
            [`${prefixcls}-drag-over`]: !disabled && dragOver,
            [`${prefixcls}-draggable`]: !disabled && draggable && !renderFullLabel,
            // When draggable + renderFullLabel is enabled, the default style
            [`${prefixcls}-fullLabel-draggable`]: !disabled && draggable && renderFullLabel,
            // When draggable + renderFullLabel is turned on, the style of dragover
            [`${prefixcls}-fullLabel-drag-over-gap-top`]: !disabled && dragOverGapTop && renderFullLabel,
            [`${prefixcls}-fullLabel-drag-over-gap-bottom`]: !disabled && dragOverGapBottom && renderFullLabel,
            [`${prefixcls}-tree-node-last-leaf`]: isEndNode,
        });
        const labelProps = {
            onClick: this.onClick,
            onContextMenu: this.onContextMenu,
            onDoubleClick: this.onDoubleClick,
            className: nodeCls,
            onExpand: this.onExpand,
            data: rest.data,
            level,
            onCheck: this.onCheck,
            style,
            expandIcon: this.renderArrow(),
            checkStatus: {
                checked,
                halfChecked,
            },
            expandStatus: {
                expanded,
                loading,
            },
            filtered,
            searchWord: rest.keyword,
        };

        const dragProps = {
            onDoubleClick: this.onDoubleClick,
            onDragStart: draggable ? this.onDragStart : undefined,
            onDragEnter: draggable ? this.onDragEnter : undefined,
            onDragOver: draggable ? this.onDragOver : undefined,
            onDragLeave: draggable ? this.onDragLeave : undefined,
            onDrop: draggable ? this.onDrop : undefined,
            onDragEnd: draggable ? this.onDragEnd : undefined,
            draggable: (!disabled && draggable) || undefined,
        };

        if (renderFullLabel) {
            const customLabel = renderFullLabel({ ...labelProps });
            if (draggable) {
                // @ts-ignore skip cloneElement type check
                return React.cloneElement(customLabel, {
                    ref: this.setRef,
                    ...dragProps
                });
            } else {
                if (isEmpty(style)) {
                    return customLabel;
                } else {
                    // In virtualization, props.style will contain location information
                    // @ts-ignore skip cloneElement type check
                    return React.cloneElement(customLabel, {
                        style: { ...get(customLabel, ['props', 'style']), ...style }
                    });
                }
            }
        }
        const labelCls = cls(`${prefixcls}-label`, {
            [`${prefixcls}-drag-over-gap-top`]: !disabled && dragOverGapTop,
            [`${prefixcls}-drag-over-gap-bottom`]: !disabled && dragOverGapBottom,
        });
        const setsize = get(rest, ['data', 'children', 'length']);
        const posinset = isString(rest.pos) ? Number(rest.pos.split('-')[level + 1]) + 1 : 1;
        return (
            <li
                className={nodeCls}
                role="treeitem"
                aria-disabled={disabled}
                aria-checked={checked}
                aria-selected={selected}
                aria-setsize={setsize}
                aria-posinset={posinset}
                aria-expanded={expanded}
                aria-level={level + 1}
                data-key={eventKey}
                onClick={this.onClick}
                onKeyPress={this.handleliEnterPress}
                onContextMenu={this.onContextMenu}
                onDoubleClick={this.onDoubleClick}
                ref={this.setRef}
                style={style}
                {...dragProps}
            >
                <Indent showLine={showLine} prefixcls={prefixcls} level={level} isEnd={isEnd} />
                {this.renderArrow()}
                <span
                    className={labelCls}
                >

                    {multiple ? this.renderCheckbox() : null}
                    {this.renderIcon()}
                    <span className={`${prefixcls}-label-text`}>{this.renderRealLabel()}</span>
                </span>
            </li>
        );
    }
}
