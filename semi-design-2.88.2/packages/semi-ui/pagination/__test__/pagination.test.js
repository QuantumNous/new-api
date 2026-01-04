import Pagination from '../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

import { genAfterEach, genBeforeEach, sleep } from '../../_test_/utils';

const defaultPageSize = 10;

// Pagination中第一层结构为LocaleConsumer，如果用shallow不好使

function getPagination(props) {
    return mount(<Pagination {...props} />, { attachTo: document.getElementById('container') });
}

describe('Pagination', () => {

    // 主要验证渲染的pageItem数量，以及最后一页的页码
    it('Pagination total & pageSize', () => {
    
        let maxItemCount = 9;

        const total30 = mount(<Pagination total={30} />);
        const total70 = mount(<Pagination total={70} />);
        const total200 = mount(<Pagination total={200} />);
        const size50 = mount(<Pagination total={200} pageSize={50} />);
        
        function getPageChild(wrapper) {
            return wrapper.find('ul').children();
        }

        expect(getPageChild(total30)).toHaveLength(5);
        expect(getPageChild(total70)).toHaveLength(maxItemCount);
        expect(getPageChild(total200)).toHaveLength(maxItemCount);
        expect(getPageChild(size50)).toHaveLength(Math.ceil(200/50)+2);
    });

    it('Pagination with custom className & style', () => {
        const wrapper = mount(<Pagination className='test' style={{color: 'red'}} />);
        expect(wrapper.exists('.test')).toEqual(true);
        // 此处写ul.test 是因为如果直接find (.test)会找到两个，第一个是react instance，第二个才是真正的dom组件
        // 限定ul.test可以直接拿到真正的dom组件
        expect(wrapper.find('ul.test')).toHaveStyle('color', 'red');
    });

    it('render mini pagination', () => {
        const wrapper = mount(<Pagination size='small' total={90}></Pagination>);
        expect(wrapper.exists(`.${BASE_CLASS_PREFIX}-page-small`)).toEqual(true);
    });

    it('Pagination showTotal & showSizeChanger', () => {
        const wrapper = mount(<Pagination showTotal total={80} showSizeChanger/>);
        expect(wrapper.exists(`.${BASE_CLASS_PREFIX}-page-total`)).toEqual(true);
        expect(wrapper.exists(`.${BASE_CLASS_PREFIX}-page-switch`)).toEqual(true);
    });

    it('Pagination with defaultCurrentPage', () => {
        const wrapper = mount(<Pagination total={80} showTotal defaultCurrentPage={3}></Pagination>);
        expect(wrapper.state('currentPage')).toEqual(3);
        expect(wrapper.find('.semi-page').children().at(4).text()).toEqual('3')
    });

    it('auto disabled prev/next btn when first/last page', () => {
        const firstPage = mount(<Pagination total={30} />);
        const lastPage = mount(<Pagination total={200} defaultCurrentPage={20} />);
        const onlyOnePage = mount(<Pagination total={9} />);
        let DISABLED_CLASS = `.${BASE_CLASS_PREFIX}-page-item-disabled`;
        expect(firstPage.find('ul').children().first().exists(DISABLED_CLASS)).toEqual(true);
        expect(firstPage.find('ul').children().last().exists(DISABLED_CLASS)).toEqual(false);
        expect(lastPage.find('ul').children().first().exists(DISABLED_CLASS)).toEqual(false);
        expect(lastPage.find('ul').children().last().exists(DISABLED_CLASS)).toEqual(true);
        expect(onlyOnePage.find('ul').children().first().exists(DISABLED_CLASS)).toEqual(true);
        expect(onlyOnePage.find('ul').children().last().exists(DISABLED_CLASS)).toEqual(true);
    });

    it('hideOnSingePage', () => {
        let props = {
            total: 10,
            hideOnSingePage: true,
        };
        const pag = getPagination(props);
        expect(pag.exists('.semi-age')).toEqual(false);
    });

    it('nextText & prevText', () => {
        let props = {
            total: 200,
            nextText: 'next',
            prevText: 'prev',
        };
        const pag = getPagination(props);
        expect(pag.find('.semi-page-next').text()).toEqual('next');
        expect(pag.find('.semi-page-prev').text()).toEqual('prev');
    });

    it('showTotal &  showSizeChanger', () => {
        let props = {
            total: 200,
            showTotal: true,
            showSizeChanger: true,
        };
        const pag = getPagination(props);
        expect(pag.exists('.semi-page-total')).toEqual(true);
        expect(pag.find('.semi-page-total').text()).toEqual('总页数：20')
        expect(pag.exists('.semi-page-switch')).toEqual(true);
    })

    it('dynamic change pageSize', () => {
        // let map = {
        //     10: 40,
        //     40: 100,
        //     100: 20,
        //     100: 10
        // }
        let props = {
            total: 200,
            showSizeChanger: true,
            pageSize: 10
        }
        const pag = getPagination(props);
        // pageSize 10 -> 40
        pag.setProps({ pageSize: 40 });
        pag.update();
        expect(pag.state().pageSize).toEqual(40);
        expect(pag.find('.semi-select-selection-text').children(0).text()).toEqual('每页条数：40');
        expect(pag.find('.semi-page-item').children().length).toEqual((200/40) + 2);
        // pageSize 40 -> 100
        pag.setProps({ pageSize: 100 });
        pag.update();
        expect(pag.state().pageSize).toEqual(100);
        expect(pag.find('.semi-select-selection-text').children(0).text()).toEqual('每页条数：100');
        expect(pag.find('.semi-page-item').children().length).toEqual((200/100) + 2);
        // pageSize 100 -> 20
        pag.setProps({ pageSize: 20 });
        pag.update();
        expect(pag.state().pageSize).toEqual(20);
        expect(pag.find('.semi-select-selection-text').children(0).text()).toEqual('每页条数：20');
        // show ..., always 9
        expect(pag.find('.semi-page-item').children().length).toEqual(9);
    });

    it('onPageChange', () => {
        let tagetPage = 7;
        let onPageChange = value => {
            // debugger
            // console.log(value);
        };
        let spyOnPageChange = sinon.spy(onPageChange);
        const pag = mount(<Pagination total={70} onPageChange={spyOnPageChange} />);
        pag.find('li').at(7).simulate('click');
        expect(spyOnPageChange.calledOnce).toBe(true);
        expect(spyOnPageChange.calledWithMatch(tagetPage)).toBe(true);
    });

    // TODO select没有留出props控制是否自动打开，这块不太好测
    it('pageSizeOpts', () => {
        let props = {
            pageSizeOpts: [10, 20, 30],
            showSizeChanger: true,
        };
        const pag = getPagination(props);
    });

    // it('popoverPosition & popoverZIndex', () => {
    //     let props = {
    //         popoverPosition: 'right',
    //         popoverZIndex: 888,
    //         total: 200,
    //     };
    //     const pag = getPagination(props);
    //     let rest = pag.find('.semi-page-item').children().at(5);
        // rest.simulate('mouseEnter');
    // });

    // TODO 不太好测，事件不好模拟触发
    // it('onPageSizeChange', async () => {
    //     let onPageSizeChange = value => {};
    //     let spyOnPageSizeChange = sinon.spy(onPageSizeChange);
    //     let props = {
    //         onPageSizeChange: spyOnPageSizeChange,
    //         showSizeChanger: true,
    //         total: 200,
    //     }
    //     const pag = getPagination(props);
    //     const select = pag.find('.semi-select');
    //     select.simulate('click');
    //     // await sleep(200);
    //     const optionList = document.querySelector('.semi-select-option-list');
    //     done();
    //     // pagination.find('li').at(7).simulate('click');
    //     // expect(spyOnPageChange.calledOnce).toBe(true);
    //     // expect(spyOnPageChange.calledWithMatch(tagetPage)).toBe(true);
    // });

    it('uncontrol mode - onChange', () => {
        let tagetPage = 20;
        let onChange = value => {};
        let spyOnChange = sinon.spy(onChange);
        let props = {
            onChange: spyOnChange,
            total: 200,
        };
        const pagination = getPagination(props);
        pagination.find('.semi-page-item').at(7).simulate('click');
        expect(spyOnChange.calledWithMatch(tagetPage)).toBe(true);
    });

    it('currentPage & onChange in controlled mode', () => {
        let onChange = value => {};
        let spyOnChange = sinon.spy(onChange);
        let props = {
            currentPage: 3,
            total: 200,
            onChange: spyOnChange
        };
        const pag = getPagination(props);
        pag.find('.semi-page-item').at(7).simulate('click');
        expect(spyOnChange.calledWithMatch(20)).toBe(true);
        expect(pag.state().currentPage).toEqual(3);
        pag.setProps({ currentPage: 4 });
        expect(pag.state().currentPage).toEqual(4);
        expect(pag.find('.semi-page-item-active').text()).toEqual("3");
    });

    it('showQuickJumper', () => {
        let spyOnChange = sinon.spy(() => {});
        let props = {
            total: 200,
            onChange: spyOnChange,
            showQuickJumper: true,
        };
        let quickJumpPage = 5;
        const pag = mount(<Pagination {...props} />);
        const jumper = pag.find('.semi-page .semi-page-quickjump-input-number.semi-input-number input');
        jumper.simulate('focus');
        jumper.simulate('change', { target: { value: quickJumpPage }});
        jumper.simulate('blur');
        expect(spyOnChange.calledWithMatch(quickJumpPage)).toBe(true);
        expect(pag.state().currentPage).toEqual(quickJumpPage);

        jumper.simulate('focus');
        jumper.simulate('change', { target: { value: props.total / 10 + 1 }});
        jumper.simulate('blur');
        expect(pag.state().currentPage).toEqual(props.total / 10);

        jumper.simulate('focus');
        jumper.simulate('change', { target: { value: NaN }});
        jumper.simulate('keypress', { key: 'Enter' });
        expect(pag.state().currentPage).toEqual(props.total / 10);

        jumper.simulate('focus');
        jumper.simulate('change', { target: { value: -1 }});
        jumper.simulate('keypress', { key: 'Enter' });
        expect(pag.state().currentPage).toEqual(1);
        pag.unmount();
    });
})
