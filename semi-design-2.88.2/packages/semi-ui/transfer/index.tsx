import React from 'react';
import cls from 'classnames';
import PropTypes from 'prop-types';
import { isEqual, noop, omit, isEmpty, isArray, pick } from 'lodash';
import TransferFoundation, { TransferAdapter, BasicDataItem, OnSortEndProps } from '@douyinfe/semi-foundation/transfer/foundation';
import { _generateDataByType, _generateSelectedItems } from '@douyinfe/semi-foundation/transfer/transferUtils';
import { cssClasses, strings } from '@douyinfe/semi-foundation/transfer/constants';
import '@douyinfe/semi-foundation/transfer/transfer.scss';
import BaseComponent from '../_base/baseComponent';
import LocaleConsumer from '../locale/localeConsumer';
import { Locale } from '../locale/interface';
import { Checkbox } from '../checkbox/index';
import Input, { InputProps } from '../input/index';
import Spin from '../spin';
import Button from '../button';
import Tree from '../tree';
import { IconClose, IconSearch, IconHandle } from '@douyinfe/semi-icons';
import { Value as TreeValue, TreeProps } from '../tree/interface';
import { RenderItemProps, Sortable } from '../_sortable';
import { verticalListSortingStrategy } from '@dnd-kit/sortable';

export interface DataItem extends BasicDataItem {
    label?: React.ReactNode;
    style?: React.CSSProperties
}

export interface GroupItem {
    title?: string;
    children?: Array<DataItem>
}

export interface TreeItem extends DataItem {
    children: Array<TreeItem>
}

export interface RenderSourceItemProps extends DataItem {
    checked: boolean;
    onChange?: () => void
}

export interface RenderSelectedItemProps extends DataItem {
    onRemove?: () => void;
    sortableHandle?: any
}

export interface EmptyContent {
    left?: React.ReactNode;
    right?: React.ReactNode;
    search?: React.ReactNode
}

export type Type = 'list' | 'groupList' | 'treeList';

export interface SourcePanelProps {
    value: Array<string | number>;
    /* Loading */
    loading: boolean;
    /* Whether there are no items that match the current search value */
    noMatch: boolean;
    /* Items that match the current search value */
    filterData: Array<DataItem>;
    /* All items */
    sourceData: Array<DataItem>;
    /* transfer props' dataSource */
    propsDataSource: DataSource;
    /* Whether to select all */
    allChecked: boolean;
    /* Number of filtered results */
    showNumber: number;
    /* Input search box value */
    inputValue: string;
    /* The function that should be called when the search box changes */
    onSearch: (searchString: string) => void;
    /* The function that should be called when all the buttons on the left are clicked */
    onAllClick: () => void;
    /* Selected item on the left */
    selectedItems: Map<string | number, DataItem>;
    /* The function that should be called when selecting or deleting a single option */
    onSelectOrRemove: (item: DataItem) => void;
    /* The function that should be called when selecting an option, */
    onSelect: (value: Array<string | number>) => void
}

export type OnSortEnd = ({ oldIndex, newIndex }: OnSortEndProps) => void;

export interface SelectedPanelProps {
    /* Number of selected options */
    length: number;
    /* Collection of all selected options */
    selectedData: Array<DataItem>;
    /* Callback function that should be called when click to clear */
    onClear: () => void;
    /* The function that should be called when a single option is deleted */
    onRemove: (item: DataItem) => void;
    /* The function that should be called when reordering the results */
    onSortEnd: OnSortEnd
}

export interface ResolvedDataItem extends DataItem {
    _parent?: {
        title: string
    };
    _optionKey?: string | number
}

export interface DraggableResolvedDataItem {
    key?: string | number;
    index?: number;
    item?: ResolvedDataItem
}

export type DataSource = Array<DataItem> | Array<GroupItem> | Array<TreeItem>;

interface HeaderConfig {
    totalContent: string;
    allContent: string;
    onAllClick: () => void;
    type: string;
    showButton: boolean;
    num: number;
    allChecked?: boolean
}

type SourceHeaderProps = {
    num: number;
    showButton: boolean;
    allChecked: boolean;
    onAllClick: () => void
}

type SelectedHeaderProps = {
    num: number;
    showButton: boolean;
    onClear: () => void
}

export interface TransferState {
    data: Array<ResolvedDataItem>;
    selectedItems: Map<number | string, ResolvedDataItem>;
    searchResult: Set<number | string>;
    inputValue: string
}

export interface TransferProps {
    style?: React.CSSProperties;
    className?: string;
    disabled?: boolean;
    dataSource?: DataSource;
    filter?: boolean | ((sugInput: string, item: DataItem) => boolean);
    defaultValue?: Array<string | number>;
    value?: Array<string | number>;
    inputProps?: InputProps;
    type?: Type;
    emptyContent?: EmptyContent;
    draggable?: boolean;
    treeProps?: Omit<TreeProps, 'value' | 'ref' | 'onChange'>;
    showPath?: boolean;
    loading?: boolean;
    onChange?: (values: Array<string | number>, items: Array<DataItem>) => void;
    onSelect?: (item: DataItem) => void;
    onDeselect?: (item: DataItem) => void;
    onSearch?: (sunInput: string) => void;
    renderSourceItem?: (item: RenderSourceItemProps) => React.ReactNode;
    renderSelectedItem?: (item: RenderSelectedItemProps) => React.ReactNode;
    renderSourcePanel?: (sourcePanelProps: SourcePanelProps) => React.ReactNode;
    renderSelectedPanel?: (selectedPanelProps: SelectedPanelProps) => React.ReactNode;
    renderSourceHeader?: (headProps: SourceHeaderProps) => React.ReactNode;
    renderSelectedHeader?: (headProps: SelectedHeaderProps) => React.ReactNode
}

const prefixCls = cssClasses.PREFIX;
class Transfer extends BaseComponent<TransferProps, TransferState> {
    static propTypes = {
        style: PropTypes.object,
        className: PropTypes.string,
        disabled: PropTypes.bool,
        dataSource: PropTypes.array,
        filter: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
        onSearch: PropTypes.func,
        inputProps: PropTypes.object,
        value: PropTypes.array,
        defaultValue: PropTypes.array,
        onChange: PropTypes.func,
        onSelect: PropTypes.func,
        onDeselect: PropTypes.func,
        renderSourceItem: PropTypes.func,
        renderSelectedItem: PropTypes.func,
        loading: PropTypes.bool,
        type: PropTypes.oneOf(['list', 'groupList', 'treeList']),
        treeProps: PropTypes.object,
        showPath: PropTypes.bool,
        emptyContent: PropTypes.shape({
            search: PropTypes.node,
            left: PropTypes.node,
            right: PropTypes.node,
        }),
        renderSourcePanel: PropTypes.func,
        renderSelectedPanel: PropTypes.func,
        draggable: PropTypes.bool,
    };

    static defaultProps = {
        type: strings.TYPE_LIST,
        dataSource: [] as DataSource,
        onSearch: noop,
        onChange: noop,
        onSelect: noop,
        onDeselect: noop,
        onClear: noop,
        defaultValue: [] as Array<string | number>,
        emptyContent: {},
        showPath: false,
    };

    _treeRef: Tree = null;

    constructor(props: TransferProps) {
        super(props);
        const { defaultValue = [], dataSource, type } = props;
        this.foundation = new TransferFoundation<TransferProps, TransferState>(this.adapter);
        this.state = {
            data: [],
            selectedItems: new Map(),
            searchResult: new Set(),
            inputValue: '',
        };
        if (Boolean(dataSource) && isArray(dataSource)) {
            // @ts-ignore Avoid reporting errors this.state.xxx is read-only
            this.state.data = _generateDataByType(dataSource, type);
        }
        if (Boolean(defaultValue) && isArray(defaultValue)) {
            // @ts-ignore Avoid reporting errors this.state.xxx is read-only
            this.state.selectedItems = _generateSelectedItems(defaultValue, this.state.data);
        }

        this.onSelectOrRemove = this.onSelectOrRemove.bind(this);
        this.onInputChange = this.onInputChange.bind(this);
        this.onSortEnd = this.onSortEnd.bind(this);
    }

    static getDerivedStateFromProps(props: TransferProps, state: TransferState) {
        const { value, dataSource, type, filter } = props;
        const mergedState = {} as TransferState;
        let newData = state.data;
        let newSelectedItems = state.selectedItems;
        if (Boolean(dataSource) && Array.isArray(dataSource)) {
            newData = _generateDataByType(dataSource, type);
            mergedState.data = newData;
        }
        if (Boolean(value) && Array.isArray(value)) {
            newSelectedItems = _generateSelectedItems(value, newData);
            mergedState.selectedItems = newSelectedItems;
        }
        if (!isEqual(state.data, newData)) {
            if (typeof state.inputValue === 'string' && state.inputValue !== '') {
                const filterFunc = typeof filter === 'function' ?
                    (item: DataItem) => filter(state.inputValue, item) :
                    (item: DataItem) => typeof item.label === 'string' && item.label.includes(state.inputValue);
                const searchData = newData.filter(filterFunc);
                const searchResult = new Set(searchData.map(item => item.key));
                mergedState.searchResult = searchResult;
            }
        }

        return isEmpty(mergedState) ? null : mergedState;
    }

    get adapter(): TransferAdapter<TransferProps, TransferState> {
        return {
            ...super.adapter,
            getSelected: () => new Map(this.state.selectedItems),
            updateSelected: selectedItems => {
                this.setState({ selectedItems });
            },
            notifyChange: (values, items) => {
                this.props.onChange(values, items);
            },
            notifySearch: input => {
                this.props.onSearch(input);
            },
            notifySelect: item => {
                this.props.onSelect(item);
            },
            notifyDeselect: item => {
                this.props.onDeselect(item);
            },
            updateInput: input => {
                this.setState({ inputValue: input });
            },
            updateSearchResult: searchResult => {
                this.setState({ searchResult });
            },
            searchTree: keyword => {
                this._treeRef && (this._treeRef as any).search(keyword); // TODO check this._treeRef.current?
            }
        };
    }

    onInputChange(value: string) {
        this.foundation.handleInputChange(value, true);
    }

    search(value: string) {
        // The search method is used to provide the user with a manually triggered search
        // Since the method is manually called by the user, setting the second parameter to false does not trigger the onSearch callback to notify the user
        this.foundation.handleInputChange(value, false);
    }

    onSelectOrRemove(item: ResolvedDataItem) {
        this.foundation.handleSelectOrRemove(item);
    }

    onSortEnd(callbackProps: OnSortEndProps) {
        this.foundation.handleSortEnd(callbackProps);
    }

    renderFilter(locale: Locale['Transfer']) {
        const { inputProps, filter, disabled } = this.props;
        if (typeof filter === 'boolean' && !filter) {
            return null;
        }
        return (
            <div role="search" aria-label="Transfer filter" className={`${prefixCls}-filter`}>
                <Input
                    prefix={<IconSearch />}
                    placeholder={locale.placeholder}
                    showClear
                    value={this.state.inputValue}
                    disabled={disabled}
                    onChange={this.onInputChange}
                    {...inputProps}
                />
            </div>
        );
    }

    renderHeader(headerConfig: HeaderConfig) {
        const { disabled, renderSourceHeader, renderSelectedHeader } = this.props;
        const { totalContent, allContent, onAllClick, type, showButton } = headerConfig;
        const headerCls = cls({
            [`${prefixCls}-header`]: true,
            [`${prefixCls}-right-header`]: type === 'right',
            [`${prefixCls}-left-header`]: type === 'left',
        });

        if (type === 'left' && typeof renderSourceHeader === 'function') {
            const { num, showButton, allChecked, onAllClick } = headerConfig;
            return renderSourceHeader({ num, showButton, allChecked, onAllClick });
        }
        
        if (type === 'right' && typeof renderSelectedHeader === 'function') {
            const { num, showButton, onAllClick: onClear } = headerConfig;
            return renderSelectedHeader({ num, showButton, onClear });                 
        }

        return (
            <div className={headerCls}>
                <span className={`${prefixCls}-header-total`}>{totalContent}</span>
                {showButton ? (
                    <Button
                        theme="borderless"
                        disabled={disabled}
                        type="tertiary"
                        size="small"
                        className={`${prefixCls}-header-all`}
                        onClick={onAllClick}
                    >
                        {allContent}
                    </Button>
                ) : null}
            </div>
        );
    }

    renderLeftItem(item: ResolvedDataItem, index: number) {
        const { renderSourceItem, disabled } = this.props;
        const { selectedItems } = this.state;
        const checked = selectedItems.has(item.key);
        if (renderSourceItem) {
            return renderSourceItem({ ...item, checked, onChange: () => this.onSelectOrRemove(item) });
        }
        const leftItemCls = cls({
            [`${prefixCls}-item`]: true,
            [`${prefixCls}-item-disabled`]: item.disabled,
        });
        return (
            <Checkbox
                key={index}
                disabled={item.disabled || disabled}
                className={leftItemCls}
                checked={checked}
                role="listitem"
                onChange={() => this.onSelectOrRemove(item)}
                x-semi-children-alias={`dataSource[${index}].label`}
            >
                {item.label}
            </Checkbox>
        );
    }

    renderLeft(locale: Locale['Transfer']) {
        const { data, selectedItems, inputValue, searchResult } = this.state;
        const { loading, type, emptyContent, renderSourcePanel, dataSource } = this.props;
        const totalToken = locale.total;
        const inSearchMode = inputValue !== '';
        const showNumber = inSearchMode ? searchResult.size : data.length;
        const filterData = inSearchMode ? data.filter(item => searchResult.has(item.key)) : data;
        // Whether to select all should be a judgment, whether the filtered data on the left is a subset of the selected items
        // For example, the filtered data on the left is 1, 3, 4;
        // The selected option is 1,2,3,4, it is true
        // The selected option is 2,3,4, then it is false
        let filterDataAllDisabled = true;
        const leftContainsNotInSelected = Boolean(filterData.find(f => {
            if (f.disabled) {
                return false;
            } else {
                if (filterDataAllDisabled) {
                    filterDataAllDisabled = false;
                }
                return !selectedItems.has(f.key);
            }
        }));

        const totalText = totalToken.replace('${total}', `${showNumber}`);

        const headerConfig: HeaderConfig = {
            totalContent: totalText,
            allContent: leftContainsNotInSelected ? locale.selectAll : locale.clearSelectAll,
            onAllClick: () => this.foundation.handleAll(leftContainsNotInSelected),
            type: 'left',
            showButton: type !== strings.TYPE_TREE_TO_LIST && !filterDataAllDisabled,
            num: showNumber,
            allChecked: !leftContainsNotInSelected
        };
        const inputCom = this.renderFilter(locale);
        const headerCom = this.renderHeader(headerConfig);
        const noMatch = inSearchMode && searchResult.size === 0;
        const emptySearch = emptyContent.search ? emptyContent.search : locale.emptySearch;
        const emptyLeft = emptyContent.left ? emptyContent.left : locale.emptyLeft;
        const emptyDataCom = this.renderEmpty('left', emptyLeft);
        const emptySearchCom = this.renderEmpty('left', emptySearch);

        const loadingCom = <Spin />;

        let content: React.ReactNode = null;
        switch (true) {
            case loading:
                content = loadingCom;
                break;
            case noMatch:
                content = emptySearchCom;
                break;
            case data.length === 0:
                content = emptyDataCom;
                break;
            case type === strings.TYPE_TREE_TO_LIST:
                content = (
                    <>
                        {headerCom}
                        {this.renderLeftTree()}
                    </>
                );
                break;
            case !noMatch && (type === strings.TYPE_LIST || type === strings.TYPE_GROUP_LIST):
                content = (
                    <>
                        {headerCom}
                        {this.renderLeftList(filterData)}
                    </>
                );
                break;
            default:
                content = null;
                break;
        }

        const { values } = this.foundation.getValuesAndItemsFromMap(selectedItems);

        const renderProps: SourcePanelProps = {
            loading,
            noMatch,
            filterData,
            sourceData: data,
            propsDataSource: dataSource,
            allChecked: !leftContainsNotInSelected,
            showNumber,
            inputValue,
            selectedItems,
            value: values,
            onSelect: this.foundation.handleSelect.bind(this.foundation),
            onAllClick: () => this.foundation.handleAll(leftContainsNotInSelected),
            onSearch: this.onInputChange,
            onSelectOrRemove: (item: ResolvedDataItem) => this.onSelectOrRemove(item),
        };

        if (renderSourcePanel) {
            return renderSourcePanel(renderProps);
        }

        return (
            <section className={`${prefixCls}-left`}>
                {inputCom}
                {content}
            </section>
        );
    }

    renderGroupTitle(group: GroupItem, index: number) {
        const groupCls = cls(`${prefixCls }-group-title`);
        return (
            <div className={groupCls} key={`title-${index}`}>
                {group.title}
            </div>
        );
    }

    renderLeftTree() {
        const { selectedItems } = this.state;
        const { disabled, dataSource, treeProps } = this.props;
        const { values } = this.foundation.getValuesAndItemsFromMap(selectedItems);
        const onChange = (value: TreeValue) => {
            this.foundation.handleSelect(value);
        };
        const restTreeProps = omit(treeProps, ['value', 'ref', 'onChange']);
        return (
            <Tree
                disabled={disabled}
                treeData={dataSource as any}
                multiple
                disableStrictly
                value={values}
                defaultExpandAll
                leafOnly
                ref={tree => this._treeRef = tree}
                filterTreeNode
                searchRender={false}
                searchStyle={{ padding: 0 }}
                style={{ flex: 1, overflow: 'overlay' }}
                onChange={onChange}
                {...restTreeProps}
            />
        );
    }

    renderLeftList(visibileItems: Array<ResolvedDataItem>) {
        const content = [] as Array<React.ReactNode>;
        const groupStatus = new Map();

        visibileItems.forEach((item, index) => {
            const parentGroup = item._parent;
            const optionContent = this.renderLeftItem(item, index);
            if (parentGroup && groupStatus.has(parentGroup.title)) {
                // group content already insert
                content.push(optionContent);
            } else if (parentGroup) {
                const groupContent = this.renderGroupTitle(parentGroup, index);
                groupStatus.set(parentGroup.title, true);
                content.push(groupContent);
                content.push(optionContent);
            } else {
                content.push(optionContent);
            }
        });
        return <div className={`${prefixCls}-left-list`} role="list" aria-label="Option list">{content}</div>;
    }

    renderRightItem = (item: ResolvedDataItem, sortableHandle?: any): React.ReactNode => {
        const { renderSelectedItem, draggable, type, showPath } = this.props;
        const onRemove = () => this.foundation.handleSelectOrRemove(item);
        const rightItemCls = cls({
            [`${prefixCls}-item`]: true,
            [`${prefixCls}-right-item`]: true,
            [`${prefixCls}-right-item-draggable`]: draggable
        });
        const shouldShowPath = type === strings.TYPE_TREE_TO_LIST && showPath === true;

        const label = shouldShowPath ? this.foundation._generatePath(item) : item.label;

        if (renderSelectedItem) {
            return renderSelectedItem({ ...item, onRemove, sortableHandle });
        }

        const DragHandle = sortableHandle && sortableHandle(() => (
            <IconHandle role="button" aria-label="Drag and sort" className={`${prefixCls}-right-item-drag-handler`} />
        ));

        return (
            // https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex
            <div role="listitem" className={rightItemCls} key={item.key}>
                {draggable && sortableHandle ? <DragHandle /> : null}
                <div className={`${prefixCls}-right-item-text`}>{label}</div>
                <IconClose
                    onClick={onRemove}
                    aria-disabled={item.disabled}
                    className={cls(`${prefixCls}-item-close-icon`, {
                        [`${prefixCls}-item-close-icon-disabled`]: item.disabled
                    })}
                />
            </div>
        );
    }

    renderSortItem = (props: RenderItemProps): React.ReactNode => {
        const { id, sortableHandle } = props;
        const { selectedItems } = this.state;
        const selectedData = [...selectedItems.values()];
        const item = selectedData.find(item => item.key === id);
        return this.renderRightItem(item, sortableHandle);
    }

    renderEmpty(type: string, emptyText: React.ReactNode) {
        const emptyCls = cls({
            [`${prefixCls}-empty`]: true,
            [`${prefixCls}-right-empty`]: type === 'right',
            [`${prefixCls}-left-empty`]: type === 'left',
        });
        return <div aria-label="empty" className={emptyCls}>{emptyText}</div>;
    }

    renderRightSortableList(selectedData: Array<ResolvedDataItem>) {
        const sortItems = selectedData.map(item => item.key);
        const sortList = <Sortable
            strategy={verticalListSortingStrategy} 
            onSortEnd={this.onSortEnd} 
            items={sortItems} 
            renderItem={this.renderSortItem} 
            prefix={`${prefixCls}-right-item`}
            dragOverlayCls={`${prefixCls}-right-item-drag-item-move`}
        />;
        return sortList;
    }

    renderRight(locale: Locale['Transfer']) {
        const { selectedItems } = this.state;
        const { emptyContent, renderSelectedPanel, draggable } = this.props;
        const selectedData = [...selectedItems.values()];

        // when custom render panel
        const renderProps: SelectedPanelProps = {
            length: selectedData.length,
            selectedData,
            onClear: () => this.foundation.handleClear(),
            onRemove: item => this.foundation.handleSelectOrRemove(item),
            onSortEnd: props => this.onSortEnd(props)
        };
        if (renderSelectedPanel) {
            return renderSelectedPanel(renderProps);
        }
        const selectedToken = locale.selected;
        const selectedText = selectedToken.replace('${total}', `${selectedData.length}`);
        const hasValidSelected = selectedData.findIndex(item => !item.disabled) !== -1;
        const headerConfig = {
            totalContent: selectedText,
            allContent: locale.clear,
            onAllClick: () => this.foundation.handleClear(),
            type: 'right',
            showButton: Boolean(selectedData.length) && hasValidSelected,
            num: selectedData.length,
        };
        const headerCom = this.renderHeader(headerConfig);
        const emptyCom = this.renderEmpty('right', emptyContent.right ? emptyContent.right : locale.emptyRight);
        const panelCls = `${prefixCls}-right`;

        let content = null;

        switch (true) {
            // when empty
            case !selectedData.length:
                content = emptyCom;
                break;
            case selectedData.length && !draggable:
                const list = (
                    <div className={`${prefixCls}-right-list`} role="list" aria-label="Selected list">
                        {selectedData.map(item => this.renderRightItem({ ...item }))}
                    </div>
                );
                content = list;
                break;
            case selectedData.length && draggable:
                content = this.renderRightSortableList(selectedData);
                break;
            default:
                break;
        }

        return (
            <section className={panelCls}>
                {headerCom}
                {content}
            </section>
        );
    }

    render() {
        const { className, style, disabled, renderSelectedPanel, renderSourcePanel, ...rest } = this.props;
        const transferCls = cls(prefixCls, className, {
            [`${prefixCls}-disabled`]: disabled,
            [`${prefixCls}-custom-panel`]: renderSelectedPanel && renderSourcePanel,
        });

        return (
            <LocaleConsumer componentName="Transfer">
                {(locale: Locale['Transfer']) => (
                    <div className={transferCls} style={style} {...this.getDataAttr(rest)}>
                        {this.renderLeft(locale)}
                        {this.renderRight(locale)}
                    </div>
                )}
            </LocaleConsumer>
        );
    }
}

export default Transfer;
