/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role */
import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { FixedSizeList as List } from 'react-window';
import { noop } from 'lodash';

import PaginationFoundation, {
    AdapterPageList,
    KeyDownHandler,
    PageList, PaginationAdapter
} from '@douyinfe/semi-foundation/pagination/foundation';
import { cssClasses, numbers } from '@douyinfe/semi-foundation/pagination/constants';
import '@douyinfe/semi-foundation/pagination/pagination.scss';
import { numbers as popoverNumbers } from '@douyinfe/semi-foundation/popover/constants';
import { IconChevronLeft, IconChevronRight } from '@douyinfe/semi-icons';
import warning from '@douyinfe/semi-foundation/utils/warning';

import ConfigContext, { ContextValue } from '../configProvider/context';
import LocaleConsumer from '../locale/localeConsumer';
import { Locale } from '../locale/interface';
import Select from '../select/index';
import InputNumber from '../inputNumber/index';
import BaseComponent from '../_base/baseComponent';
import Popover from '../popover/index';
import { Position } from '../tooltip';

const prefixCls = cssClasses.PREFIX;
const { Option } = Select;

export interface PaginationProps {
    total?: number;
    showTotal?: boolean;
    pageSize?: number;
    pageSizeOpts?: Array<number>;
    size?: 'small' | 'default';
    currentPage?: number;
    defaultCurrentPage?: number;
    onPageChange?: (currentPage: number) => void;
    onPageSizeChange?: (newPageSize: number) => void;
    onChange?: (currentPage: number, pageSize: number) => void;
    prevText?: React.ReactNode;
    nextText?: React.ReactNode;
    showSizeChanger?: boolean;
    showQuickJumper?: boolean;
    popoverZIndex?: number;
    popoverPosition?: PopoverPosition;
    style?: React.CSSProperties;
    className?: string;
    hideOnSinglePage?: boolean;
    hoverShowPageSelect?: boolean;
    disabled?: boolean
}

export interface PaginationState {
    total: number;
    showTotal: boolean;
    currentPage: number;
    pageSize: number;
    pageList: PageList;
    prevDisabled: boolean;
    quickJumpPage: string | number;
    nextDisabled: boolean;
    restLeftPageList: number[];
    restRightPageList: number[];
    allPageNumbers: number[]
}

export type PaginationLocale = Locale['Pagination'];
export type PopoverPosition = Position;
export type { PageList };

export default class Pagination extends BaseComponent<PaginationProps, PaginationState> {
    static contextType = ConfigContext;

    static propTypes = {
        total: PropTypes.number,
        showTotal: PropTypes.bool,
        pageSize: PropTypes.number,
        pageSizeOpts: PropTypes.array,
        size: PropTypes.string,
        currentPage: PropTypes.number,
        defaultCurrentPage: PropTypes.number,
        onPageChange: PropTypes.func,
        onPageSizeChange: PropTypes.func,
        onChange: PropTypes.func,
        prevText: PropTypes.node,
        nextText: PropTypes.node,
        showSizeChanger: PropTypes.bool,
        popoverZIndex: PropTypes.number,
        popoverPosition: PropTypes.string,
        style: PropTypes.object,
        className: PropTypes.string,
        hideOnSinglePage: PropTypes.bool,
        hoverShowPageSelect: PropTypes.bool,
        showQuickJumper: PropTypes.bool,
        disabled: PropTypes.bool,
    };

    static defaultProps = {
        total: 1,
        popoverZIndex: popoverNumbers.DEFAULT_Z_INDEX,
        showTotal: false,
        pageSize: null as null,
        pageSizeOpts: numbers.PAGE_SIZE_OPTION,
        defaultCurrentPage: 1,
        size: 'default',
        onPageChange: noop,
        onPageSizeChange: noop,
        onChange: noop,
        showSizeChanger: false,
        className: '',
        hideOnSinglePage: false,
        showQuickJumper: false,
        disabled: false,
    };

    constructor(props: PaginationProps) {
        super(props);

        const total = props.total;

        const pageSize = props.pageSize || props.pageSizeOpts[0] || numbers.DEFAULT_PAGE_SIZE; // Use pageSize first, use the first of pageSizeOpts when not, use the default value when none

        const shouldFillAllNumber = props.size === 'small' && props.hoverShowPageSelect && !props.disabled;

        this.state = {
            total,
            showTotal: props.showTotal,
            currentPage: props.currentPage || props.defaultCurrentPage,
            pageSize,
            pageList: [],
            prevDisabled: false,
            nextDisabled: false,
            restLeftPageList: [],
            restRightPageList: [],
            quickJumpPage: '',
            allPageNumbers: shouldFillAllNumber ? Array.from({ length: Math.ceil(total / pageSize) }, (v, i) => i + 1) : [], // only need to count in smallPage mode, when props.size = small
        };
        this.foundation = new PaginationFoundation(this.adapter);
        this.renderDefaultPage = this.renderDefaultPage.bind(this);
        this.renderSmallPage = this.renderSmallPage.bind(this);
        warning(
            Boolean(props.showSizeChanger && props.hideOnSinglePage),
            '[Semi Pagination] You should not use showSizeChanger and hideOnSinglePage in ths same time. At this time, hideOnSinglePage no longer takes effect, otherwise there may be a problem that the switch entry disappears'
        );
    }

    context: ContextValue;

    get adapter(): PaginationAdapter<PaginationProps, PaginationState> {
        return {
            ...super.adapter,
            setPageList: (pageListState: AdapterPageList) => {
                const { pageList, restLeftPageList, restRightPageList } = pageListState;
                this.setState({ pageList, restLeftPageList, restRightPageList });
            },
            setDisabled: (prevIsDisabled: boolean, nextIsDisabled: boolean) => {
                this.setState({ prevDisabled: prevIsDisabled, nextDisabled: nextIsDisabled });
            },
            updateTotal: (total: number) => this.setState({ total }),
            updatePageSize: (pageSize: number) => this.setState({ pageSize }),
            updateQuickJumpPage: (quickJumpPage: string | number) => this.setState({ quickJumpPage }),
            updateAllPageNumbers: (allPageNumbers: number[]) => this.setState({ allPageNumbers }),
            setCurrentPage: (pageIndex: number) => {
                this.setState({ currentPage: pageIndex });
            },
            registerKeyDownHandler: (handler: KeyDownHandler) => {
                document.addEventListener('keydown', handler);
            },
            unregisterKeyDownHandler: (handler: KeyDownHandler) => {
                document.removeEventListener('keydown', handler);
            },
            notifyPageChange: (pageIndex: number) => {
                this.props.onPageChange(pageIndex);
            },
            notifyPageSizeChange: (pageSize: number) => {
                this.props.onPageSizeChange(pageSize);
            },
            notifyChange: (pageIndex: number, pageSize: number) => {
                this.props.onChange(pageIndex, pageSize);
            }
        };
    }

    componentDidMount() {
        this.foundation.init();
    }

    componentWillUnmount() {
        this.foundation.destroy();
    }

    componentDidUpdate(prevProps: PaginationProps) {
        const pagerProps = {
            currentPage: this.props.currentPage,
            total: this.props.total,
            pageSize: this.props.pageSize,
        };

        let pagerHasChanged = false;
        let allPageNumberNeedUpdate = false;

        if (prevProps.currentPage !== this.props.currentPage) {
            pagerHasChanged = true;
            // this.foundation.updatePage(this.props.currentPage);
        }

        if (prevProps.total !== this.props.total) {
            pagerHasChanged = true;
            allPageNumberNeedUpdate = true;
        }

        if (prevProps.pageSize !== this.props.pageSize) {
            pagerHasChanged = true;
            allPageNumberNeedUpdate = true;
        }

        if (pagerHasChanged) {
            this.foundation.updatePage(pagerProps.currentPage, pagerProps.total, pagerProps.pageSize);
        }

        if (allPageNumberNeedUpdate) {
            this.foundation.updateAllPageNumbers(pagerProps.total, pagerProps.pageSize);
        }
    }

    renderPrevBtn() {
        const { prevText, disabled } = this.props;
        const { prevDisabled } = this.state;
        const isDisabled = prevDisabled || disabled;
        const preClassName = classNames({
            [`${prefixCls}-item`]: true,
            [`${prefixCls}-prev`]: true,
            [`${prefixCls}-item-disabled`]: isDisabled,
        });
        return (
            <li
                role="button"
                aria-disabled={isDisabled ? true : false}
                aria-label="Previous"
                onClick={e => !isDisabled && this.foundation.goPrev(e)}
                className={preClassName}
                x-semi-prop="prevText"
            >
                {prevText || <IconChevronLeft size="large" />}
            </li>
        );
    }

    renderNextBtn() {
        const { nextText, disabled } = this.props;
        const { nextDisabled } = this.state;
        const isDisabled = nextDisabled || disabled;
        const nextClassName = classNames({
            [`${prefixCls}-item`]: true,
            [`${prefixCls}-item-disabled`]: isDisabled,
            [`${prefixCls}-next`]: true,
        });
        return (
            <li
                role="button"
                aria-disabled={isDisabled ? true : false}
                aria-label="Next"
                onClick={e => !isDisabled && this.foundation.goNext(e)}
                className={nextClassName}
                x-semi-prop="nextText"
            >
                {nextText || <IconChevronRight size="large" />}
            </li>
        );
    }

    renderPageSizeSwitch(locale: PaginationLocale) {
        // rtl modify the default position
        const { direction } = this.context;
        const defaultPopoverPosition = direction === 'rtl' ? 'bottomRight' : 'bottomLeft';
        const { showSizeChanger, popoverPosition = defaultPopoverPosition, disabled, popoverZIndex } = this.props;
        const { pageSize } = this.state;
        const switchCls = classNames(`${prefixCls}-switch`);
        if (!showSizeChanger) {
            return null;
        }

        const newPageSizeOpts = this.foundation.pageSizeInOpts();

        const pageSizeToken = locale.pageSize;
        // Display pageSize in a specific language format order
        const options = newPageSizeOpts.map((size: number) => (
            <Option value={size} key={size}>
                <span>
                    {pageSizeToken.replace('${pageSize}', size.toString())}
                </span>
            </Option>
        ));
        return (
            <div className={switchCls}>
                <Select
                    aria-label="Page size selector"
                    disabled={disabled}
                    onChange={newPageSize => this.foundation.changePageSize(newPageSize)}
                    value={pageSize}
                    key={pageSize + pageSizeToken}
                    position={popoverPosition || 'bottomRight'}
                    clickToHide
                    zIndex={popoverZIndex}
                    dropdownClassName={`${prefixCls}-select-dropdown`}
                >
                    {options}
                </Select>
            </div>
        );
    }

    renderQuickJump(locale: PaginationLocale) {
        const { showQuickJumper, disabled } = this.props;
        const { quickJumpPage, total, pageSize } = this.state;
        if (!showQuickJumper) {
            return null;
        }
        const totalPageNum = this.foundation._getTotalPageNumber(total, pageSize);
        const isDisabled = (totalPageNum === 1) || disabled;
        const quickJumpCls = classNames({
            [`${prefixCls}-quickjump`]: true,
            [`${prefixCls}-quickjump-disabled`]: isDisabled
        });

        return (
            <div className={quickJumpCls}>
                <span>{locale.jumpTo}</span>
                <InputNumber
                    value={quickJumpPage}
                    className={`${prefixCls}-quickjump-input-number`}
                    hideButtons
                    disabled={isDisabled}
                    onBlur={(e: React.FocusEvent) => this.foundation.handleQuickJumpBlur()}
                    onEnterPress={(e: React.KeyboardEvent) => this.foundation.handleQuickJumpEnterPress((e.target as any).value)}
                    onChange={(v: string | number) => this.foundation.handleQuickJumpNumberChange(v)}
                />
                <span>{locale.page}</span>
            </div>
        );
    }

    renderPageList() {
        const {
            pageList,
            currentPage,
            restLeftPageList,
            restRightPageList,
        } = this.state;
        const { popoverPosition, popoverZIndex, disabled } = this.props;

        return pageList.map((page, i) => {
            const pageListClassName = classNames(`${prefixCls}-item`, {
                [`${prefixCls}-item-active`]: currentPage === page,
                [`${prefixCls}-item-all-disabled`]: disabled,
                [`${prefixCls}-item-all-disabled-active`]: currentPage === page && disabled,
                // [`${prefixCls}-item-rest-opening`]: (i < 3 && isLeftRestHover && page ==='...') || (i > 3 && isRightRestHover && page === '...')
            });
            const pageEl = (
                <li
                    key={`${page}${i}`}
                    onClick={() => !disabled && this.foundation.goPage(page, i)}
                    className={pageListClassName}
                    aria-label={page === '...' ? 'More' : `Page ${page}`}
                    aria-current={currentPage === page ? "page" : false}
                >
                    {page}
                </li>
            );
            if (page === '...' && !disabled) {
                let content;
                i < 3 ? (content = restLeftPageList) : (content = restRightPageList);
                return (
                    <Popover
                        rePosKey={this.props.currentPage}
                        trigger="hover"
                        // onVisibleChange={visible=>this.handleRestHover(visible, i < 3 ? 'left' : 'right')}
                        content={this.renderRestPageList(content)}
                        key={`${page}${i}`}
                        position={popoverPosition}
                        zIndex={popoverZIndex}
                    >
                        {pageEl}
                    </Popover>
                );
            }
            return pageEl;
        });
    }

    renderRestPageList(restList: ('...' | number)[]) {
        // The number of pages may be tens of thousands, here is virtualized with the help of react-window
        const { direction } = this.context;
        const className = classNames(`${prefixCls}-rest-item`);
        const count = restList.length;
        const row = (item: { index: number; style: React.CSSProperties }) => {
            const { index, style } = item;
            const page = restList[index];
            return (
                <div
                    role="listitem"
                    key={`${page}${index}`}
                    className={className}
                    onClick={() => this.foundation.goPage(page, index)}
                    style={style}
                    aria-label={`${page}`}
                >
                    {page}
                </div>
            );
        };
        const itemHeight = 32;
        const listHeight = count >= 5 ? itemHeight * 5 : itemHeight * count;
        return (
            // @ts-ignore skip type check cause react-window not update with @types/react 18
            <List
                className={`${prefixCls}-rest-list`}
                itemData={restList}
                itemSize={itemHeight}
                width={78}
                itemCount={count}
                height={listHeight}
                style={{ direction }}
            >
                {row}
            </List>
        );
    }


    renderSmallPageSelect(content: React.ReactNode) {
        const allPageNumbers = this.state.allPageNumbers;
        const pageList = this.renderRestPageList(allPageNumbers);
        
        return (
            <Popover
                content={pageList}
            >
                {content}
            </Popover>
        );
    }

    renderSmallPage(locale: PaginationLocale) {
        const { className, style, hideOnSinglePage, hoverShowPageSelect, showSizeChanger, disabled, ...rest } = this.props;
        const paginationCls = classNames(`${prefixCls}-small`, prefixCls, className, { [`${prefixCls}-disabled`]: disabled });
        const { currentPage, total, pageSize } = this.state;
        const totalPageNum = Math.ceil(total / pageSize);
        if (totalPageNum < 2 && hideOnSinglePage && !showSizeChanger) {
            return null;
        }

        const pageCls = classNames({
            [`${prefixCls}-item`]: true,
            [`${prefixCls}-item-small`]: true,
            [`${prefixCls}-item-all-disabled`]: disabled,
        });

        const content = (<div className={pageCls}>{currentPage}/{totalPageNum} </div>);

        return (
            <div className={paginationCls} style={style} {...this.getDataAttr(rest)}>
                {this.renderPrevBtn()}
                {
                    (hoverShowPageSelect && !disabled) ? this.renderSmallPageSelect(content) : content
                }
                {this.renderNextBtn()}
                {this.renderQuickJump(locale)}
            </div>
        );
    }

    renderDefaultPage(locale: PaginationLocale) {
        const { total, pageSize } = this.state;
        const { showTotal, className, style, hideOnSinglePage, showSizeChanger, disabled, ...rest } = this.props;
        const paginationCls = classNames(className, `${prefixCls}`, { [`${prefixCls}-disabled`]: disabled });
        const showTotalCls = `${prefixCls}-total`;
        const totalPageNum = Math.ceil(total / pageSize);
        if (totalPageNum < 2 && hideOnSinglePage && !showSizeChanger) {
            return null;
        }

        const totalNum = Math.ceil(total / pageSize);
        const totalToken = locale.total.replace('${total}', totalNum.toString());

        return (
            <ul className={paginationCls} style={style} {...this.getDataAttr(rest)}>
                {showTotal ? (
                    <span className={showTotalCls}>
                        {totalToken}
                    </span>
                ) : null}
                {this.renderPrevBtn()}
                {this.renderPageList()}
                {this.renderNextBtn()}
                {this.renderPageSizeSwitch(locale)}
                {this.renderQuickJump(locale)}
            </ul>
        );
    }

    render() {
        const { size } = this.props;
        return (
            <LocaleConsumer componentName="Pagination">
                {
                    (locale: PaginationLocale) => (
                        size === 'small' ? this.renderSmallPage(locale) : this.renderDefaultPage(locale)
                    )
                }
            </LocaleConsumer>
        );
    }
}
