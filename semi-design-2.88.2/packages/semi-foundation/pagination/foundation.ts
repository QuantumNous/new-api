import BaseFoundation, { DefaultAdapter } from '../base/foundation';
import { numbers } from './constants';

export interface PaginationAdapter<P = Record<string, any>, S = Record<string, any>> extends DefaultAdapter<P, S> {
    setPageList: (pageListState: AdapterPageList) => void;
    setDisabled: (prevIsDisabled: boolean, nextIsDisabled: boolean) => void;
    updateTotal: (total: number) => void;
    updatePageSize: (pageSize: number) => void;
    updateQuickJumpPage: (quickJumpPage: string | number) => void;
    updateAllPageNumbers: (allPageNumbers: number[]) => void;
    setCurrentPage: (pageIndex: number) => void;
    registerKeyDownHandler: (handler: KeyDownHandler) => void;
    unregisterKeyDownHandler: (handler: KeyDownHandler) => void;
    notifyPageChange: (pageIndex: number) => void;
    notifyPageSizeChange: (pageSize: number) => void;
    notifyChange: (pageIndex: number, pageSize: number) => void
}

export type PageRenderText = number | '...';
export type PageList = PageRenderText[];

export interface AdapterPageList {
    pageList: PageRenderText[];
    restLeftPageList: number[];
    restRightPageList: number[]
}

export type KeyDownHandler = any;

class PaginationFoundation<P = Record<string, any>, S = Record<string, any>> extends BaseFoundation<PaginationAdapter<P, S>, P, S> {
    constructor(adapter: PaginationAdapter<P, S>) {
        super({ ...adapter });
    }

    init() {
        const { currentPage, total, pageSize } = this.getStates();
        // If pageSize is set, pageSizeOpts does not work
        this._updateDisabled({ currentPage, total, pageSize });
        this._updatePageList({ currentPage, total, pageSize });
        this._registerEventHandler();
    }

    destroy() {
        this._unregisterEventHandler();
    }

    _registerEventHandler() {
        this._adapter.registerKeyDownHandler(this.handleKeyDown);
    }

    _unregisterEventHandler() {
        this._adapter.unregisterKeyDownHandler(this.handleKeyDown);
    }

    _updateDisabled(pageInfo: { currentPage: number; total: number; pageSize: number }) {
        const { currentPage, total, pageSize } = pageInfo;
        const totalPageNum = this._getTotalPageNumber(total, pageSize);
        let prevIsDisabled = false;
        let nextIsDisabled = false;
        if (currentPage === 1) {
            prevIsDisabled = true;
            nextIsDisabled = totalPageNum < 2;
        } else if (currentPage === totalPageNum) {
            prevIsDisabled = false;
            nextIsDisabled = true;
        }
        this._adapter.setDisabled(prevIsDisabled, nextIsDisabled);
    }

    goPage(targetPageIndex: number | '...') {
        if (targetPageIndex === '...') {
            return;
        }
        const { pageSize, currentPage } = this.getStates();
        const isControlComponent = this._isInProps('currentPage');

        if (targetPageIndex === currentPage) {
            return;
        }

        if (!isControlComponent) {
            this.updatePage(targetPageIndex);
            this._adapter.notifyPageChange(targetPageIndex);
            this._adapter.notifyChange(targetPageIndex, pageSize);
        } else {
            this._adapter.notifyPageChange(targetPageIndex);
            this._adapter.notifyChange(targetPageIndex, pageSize);
        }
    }

    updatePage(targetPageIndex = 1, total?: number, pageSize?: number) {
        // maybe undefined or null
        if (total === null || typeof total === 'undefined') {
            total = this.getState('total');
        }
        if (pageSize === null || typeof pageSize === 'undefined') {
            pageSize = this.getState('pageSize');
        }
        this._updateDisabled({ currentPage: targetPageIndex, total, pageSize });
        this._updatePageList({ currentPage: targetPageIndex, total, pageSize });
        this._adapter.updateTotal(total);
        this._adapter.setCurrentPage(targetPageIndex);
        this._adapter.updatePageSize(pageSize);
    }

    updateAllPageNumbers(total: number, pageSize: number) {
        // only need to update in small size

        const { size, hoverShowPageSelect, disabled } = this.getProps();
        if (size !== 'small' || !hoverShowPageSelect || disabled) {
            return;
        } else {
            const pageNumbers = Array.from({ length: Math.ceil(total / pageSize) }, (v, i) => i + 1);
            this._adapter.updateAllPageNumbers(pageNumbers);
        }
    }

    goPrev() {
        const { currentPage } = this.getStates();
        if (currentPage > 1) {
            this.goPage(currentPage - 1);
        }
    }

    goNext() {
        const { currentPage, total, pageSize } = this.getStates();
        const totalPageNum = this._getTotalPageNumber(total, pageSize);
        if (currentPage <= totalPageNum - 1) {
            this.goPage(currentPage as number + 1);
        }
    }

    _updatePageList(pageListInfo: { currentPage: number; total: number; pageSize: number }) {
        const { currentPage, total, pageSize } = pageListInfo;
        let pageList: PageList = [];
        let restLeftPageList: number[] = []; // pages before ...
        let restRightPageList: number[] = []; // pages after ...
        /** Pager truncation logic (t is the total number of pages, c is the current page):
             - No need to truncate when t<=7 pages
             - When t>7
                 - When c<4, the fourth is a truncation symbol (...)
                 - When c=4, the sixth is the truncation symbol (...)
                 - When 4<c<t-3, the second and sixth are truncation symbols (...)
                 - When t-3<=c<=t, the second is the truncation symbol (...), followed by the 5th from the bottom-the 1st from the bottom
             Truncation character + number, the total number is 7

            分页器截断逻辑（t为总页数，c为当前页）：
            - t<=7 页的时候不需要截断
            - 当 t>7 时
                - 当 c<4 时，第4个为截断符号（...）
                - 当 c=4 时，第6个为截断符号（...）
                - 当 4<c<t-3 时，第2个与第6个为截断符号（...）
                - 当 t-3<=c<=t 时，第 2 个为截断符号（...），后面为倒数第5个-倒数第1个
            截断符+数字 总共个数为7个
        */
        const totalPageNum = this._getTotalPageNumber(total, pageSize);
        const { PAGE_SHOW_MAX, REST_PAGE_MAX_SIZE } = numbers;
        if (totalPageNum <= PAGE_SHOW_MAX) {
            pageList = Array.from({ length: totalPageNum }, (v, i) => i + 1);
            restLeftPageList = [];
            restRightPageList = [];
        } else {
            switch (true) {
                case currentPage < 4:
                    pageList = [1, 2, 3, 4, '...', totalPageNum - 1, totalPageNum];
                    // length: (totalPageNum - 1) - 4
                    restRightPageList = Array.from({ length: Math.min(totalPageNum - 6, REST_PAGE_MAX_SIZE) }, (v, i) => i + 5);
                    restLeftPageList = [];
                    break;
                case currentPage === 4:
                    pageList = [1, 2, 3, 4, 5, '...', totalPageNum];
                    restRightPageList = Array.from({ length: Math.min(totalPageNum - 6, REST_PAGE_MAX_SIZE) }, (v, i) => i + 6);
                    restLeftPageList = [];
                    break;
                case 4 < currentPage && currentPage < totalPageNum - 3:
                    const middle = Array.from({ length: 3 }, (v, i) => currentPage + (i - 1));
                    pageList = ([1] as PageList).concat('...', middle, '...', totalPageNum);
                    // length: total-(currentPage+1)-1
                    restRightPageList = Array.from(
                        { length: Math.min(totalPageNum - currentPage - 2, REST_PAGE_MAX_SIZE) },
                        (v, i) => currentPage + i + 2
                    );
                    restLeftPageList = Array.from({ length: Math.min(currentPage - 3, REST_PAGE_MAX_SIZE) }, (v, i) => i + 2);
                    break;
                case currentPage - 3 <= currentPage && currentPage <= totalPageNum:
                    const right = Array.from({ length: 5 }, (v, i) => totalPageNum - (4 - i));
                    pageList = [1, '...' as const].concat(right);
                    restRightPageList = [];
                    restLeftPageList = Array.from({ length: Math.min(right[0] - 2, REST_PAGE_MAX_SIZE) }, (v, i) => i + 2);
                    break;
                default:
                    break;
            }
        }
        this._adapter.setPageList({ pageList, restLeftPageList, restRightPageList });
        // this._adapter.setRestLeftPageList(restLeftPageList);
        // this._adapter.setRestRightPageList(restRightPageList);
    }

    changePageSize(newPageSize: number) {
        const { pageSize } = this.getStates();
        this._adapter.updatePageSize(newPageSize);
        this._adapter.notifyPageSizeChange(newPageSize);
        const { total, currentPage } = this.getStates();

        // After converting the switching page capacity, which page is the current page
        const currentPageFirstItemIndex = (currentPage - 1) * pageSize + 1;
        const newCurrentPage = Math.ceil(currentPageFirstItemIndex / newPageSize);
        this.updatePage(newCurrentPage, total, newPageSize);
        if (currentPage !== newCurrentPage) {
            this._adapter.notifyPageChange(newCurrentPage);
        }
        this._adapter.notifyChange(newCurrentPage, newPageSize);
    }

    // TODO handle tab/enter events
    handleKeyDown() {
    }

    // If pageSize is not in the Opts array, insert it
    pageSizeInOpts() {
        const { pageSizeOpts } = this.getProps();
        const { pageSize } = this.getStates();
        const newPageSizeOpts = [...pageSizeOpts];
        if (newPageSizeOpts.indexOf(pageSize) === -1) {
            const firstLargerIndex = newPageSizeOpts.findIndex(el => el > pageSize);
            newPageSizeOpts.splice(firstLargerIndex, 0, pageSize);
        }
        return newPageSizeOpts;
    }

    handleQuickJumpNumberChange(targetPage: string | number) {
        this._adapter.updateQuickJumpPage(targetPage);
    }


    _handleQuickJump(quickJumpPage: string | number) {
        let page = Number(quickJumpPage);
        const { pageSize, total } = this.getStates();
        const totalPageNum = this._getTotalPageNumber(total, pageSize);
        if (Number.isNaN(page)) {
            return;
        }
        // If the user input is greater than totalPage
        if (page > totalPageNum) {
            page = totalPageNum;
        }
        if (page <= 0) {
            page = 1;
        }
        // clear inputnumber
        this._adapter.updateQuickJumpPage('');
        this.goPage(page);
    }

    handleQuickJumpBlur() {
        const { quickJumpPage } = this.getStates();

        // no need to operate when inputnumber blur & quickJumpPage is empty
        if ((typeof quickJumpPage === 'string' && quickJumpPage) || typeof quickJumpPage === 'number') {
            this._handleQuickJump(quickJumpPage);
        }
    }

    handleQuickJumpEnterPress(targetPage: any) {
        this._handleQuickJump(targetPage);
    }

    _getTotalPageNumber(total: number, pageSize: number) {
        const totalPageNum = Math.ceil(total / pageSize);
        return totalPageNum;
    }
}


export default PaginationFoundation;
