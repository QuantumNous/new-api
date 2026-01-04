import { Icon, SideSheet, Modal } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';
import { IconEyeClosed } from '@douyinfe/semi-icons';
// import toJson from 'enzyme-to-json';

function getSideSheet(SideSheetProps, children) {
    let props = SideSheetProps ? SideSheetProps : {};
    return (
        <SideSheet
            {...props}
        >
            {children ? children : <p>This is content of basic sideSheet</p>}
        </SideSheet>
    );
}

function mountToBody(component) {
    return mount(component, { attachTo: document.getElementById('container') });
}

describe('SideSheet', () => {

    beforeEach(() => {
        // Avoid `attachTo: document.body` Warning
        const div = document.createElement('div');
        div.setAttribute('id', 'container');
        document.body.appendChild(div);
    });

    afterEach(() => {
        const div = document.getElementById('container');
        if (div) {
            document.body.removeChild(div);
        }
    });

    it('className / style / maskStyle / bodyStyle / headerStyle / zIndex', () => {
        debugger
        let component = getSideSheet({
            className: 'test',
            style: { color: 'red' },
            visible: true,
            maskStyle: { color: 'grey' },
            headerStyle: { color: 'green' },
            bodyStyle: { color: 'pink' },
            zIndex: 500,
        });
        let sideSheet = mount(component, { attachTo: document.getElementById('container') });
        // let sideSheet = mount(component, { attachTo: document.body });
        // test className
        expect(sideSheet.exists(`.${BASE_CLASS_PREFIX}-sidesheet.test`)).toEqual(true);
        // test style
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveStyle('color', 'red')
        // test bodyStyle
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-body`)).toHaveStyle('color', 'pink');
        // test headerStyle
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-header`)).toHaveStyle('color', 'green');
        // test maskStyle
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-mask`)).toHaveStyle('color', 'grey');
        // test zIndex
        expect(document.querySelector(`.${BASE_CLASS_PREFIX}-portal`).style.zIndex).toEqual("500");
        sideSheet.unmount();
    });

    it('visible', () => {
        let component = getSideSheet();
        // let sideSheet = mount(component, { attachTo: document.body }); // 如果用body的话，第一个测试用例可以过，但第二个就不行
        let sideSheet = mount(component, { attachTo: document.getElementById('container') });
        expect(sideSheet.exists(`div.${BASE_CLASS_PREFIX}-sidesheet`)).toEqual(false);
        sideSheet.setProps({ visible: true });
        sideSheet.update(); // 必须调用一次update
        expect(sideSheet.exists(`div.${BASE_CLASS_PREFIX}-sidesheet`)).toEqual(true);
        sideSheet.unmount();
    });

    it('test', () => {
        let bottomCom = getSideSheet({ placement: 'bottom', visible: true });
        let bottomSideSheet = mount(bottomCom, { attachTo: document.getElementById('container') });
        expect(bottomSideSheet.exists(`.${BASE_CLASS_PREFIX}-sidesheet-bottom`)).toEqual(true);
        bottomSideSheet.unmount();
    })

    it('different position', () => {
        let topCom = getSideSheet({ placement: 'top', visible: true });

        let sideSheet = mount(topCom, { attachTo: document.getElementById('container') });
        // top
        expect(sideSheet.exists(`.${BASE_CLASS_PREFIX}-sidesheet-top`)).toEqual(true);
      //  expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveStyle({ transform: 'translateY(-100%)', width: '100%' });
        // bottom
        sideSheet.setProps({ placement: 'bottom' });
        expect(sideSheet.exists(`.${BASE_CLASS_PREFIX}-sidesheet-bottom`)).toEqual(true);
      //  expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveStyle({ transform: 'translateY(100%)', width: '100%' });
        // left
        sideSheet.setProps({ placement: 'left' });
        expect(sideSheet.exists(`.${BASE_CLASS_PREFIX}-sidesheet-left`)).toEqual(true);
      //  expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveStyle({ transform: 'translateX(-0%)', height: '100%' });
        // right
        sideSheet.setProps({ placement: 'right' });
        expect(sideSheet.exists(`.${BASE_CLASS_PREFIX}-sidesheet-right`)).toEqual(true);
      //  expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveStyle({ transform: 'translateX(0%)', height: '100%' });
        sideSheet.unmount();
    });

    // it('onCancel', () => {

    // });

    it('render basiclly', () => {
        let com = getSideSheet({ title: 'SemiTitle', visible: true })
        let sideSheet = mount(com, { attachTo: document.getElementById('container') });
        // test title
        let sheetTitle = document.querySelector(`.${BASE_CLASS_PREFIX}-sidesheet-title`);
        expect(sheetTitle.textContent).toEqual('SemiTitle');
        // test content
        let sheetContent = document.querySelector(`.${BASE_CLASS_PREFIX}-sidesheet-body`);
        // the content in getSideSheet could not be overwritten
        expect(sheetContent.textContent).toEqual('This is content of basic sideSheet');
        sideSheet.unmount();
    });

    it('size', () => {
        let com = getSideSheet({ size: 'small', visible: true })
        let sideSheet = mount(com, { attachTo: document.getElementById('container') });
        // test small size
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveClassName("semi-sidesheet-size-small");
        // test medium size
        sideSheet.setProps({ size: 'medium' });
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveClassName("semi-sidesheet-size-medium");
        // test large size
        sideSheet.setProps({ size: 'large' });
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveClassName("semi-sidesheet-size-large");
        sideSheet.unmount();
    });

    it('height / width', () => {
        let com = getSideSheet({ width: '413px', visible: true })
        let sideSheet = mount(com, { attachTo: document.getElementById('container') });
        // test width on left
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveStyle({ width: '413px' });
        // test height on left
        sideSheet.setProps({ height: '413px' });
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveStyle({ height: '100%' });

        // test width on right
        sideSheet.setProps({ placement: 'right' });
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveStyle({ width: '413px' });
        // test height on right
        sideSheet.setProps({ height: '413px' });
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveStyle({ height: '100%' });

        // test height on top
        sideSheet.setProps({ height: '413px', placement: 'top' });
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveStyle({ height: '413px' });
        // test width on top
        sideSheet.setProps({ width: '413px' });
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveStyle({ width: '100%' });

        // test height on bottom
        sideSheet.setProps({ height: '413px', placement: 'bottom' });
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveStyle({ height: '413px' });
        // test width on bottom
        sideSheet.setProps({ width: '413px' });
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).toHaveStyle({ width: '100%' });
        sideSheet.unmount();
    });

    it('disableScroll', () => {
        let com = getSideSheet({ visible: true })
        let sideSheet = mount(com, { attachTo: document.getElementById('container') });
        // test default
        expect(document.body.style.overflow).toEqual('hidden');
        sideSheet.setProps({ visible: false });
        expect(document.body.style.overflow).not.toEqual('hidden');

        // test disableScroll
        sideSheet.setProps({ disableScroll: false, visible: true });
        expect(document.body.style.overflow).not.toEqual('hidden');
        sideSheet.unmount();
    });

    it('closable', () => {
        let closeCom = getSideSheet({ closable: true, visible: true });
        let nocloseCom = getSideSheet({ closable: false, visible: true });
        let sideSheet = mount(closeCom, { attachTo: document.getElementById('container') });
        expect(sideSheet.exists(`.${BASE_CLASS_PREFIX}-sidesheet-close`)).toEqual(true);
        sideSheet.unmount();

        let notClosableSideSheet = mount(nocloseCom, { attachTo: document.getElementById('container') });
        expect(notClosableSideSheet.exists(`.${BASE_CLASS_PREFIX}-sidesheet-close`)).toEqual(false);
        notClosableSideSheet.unmount();
    });

    it('maskClosable', () => {
        let onCancel = () => { };
        let spyOnCancel = sinon.spy(onCancel);
        let spyOnCancel2 = sinon.spy(onCancel);
        let closeCom = getSideSheet({
            maskClosable: true,
            visible: true,
            onCancel: spyOnCancel
        });
        let sideSheet = mount(closeCom, { attachTo: document.getElementById('container') });
        // maskClosable
        sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-mask`).simulate('click');
        expect(spyOnCancel.calledOnce).toBe(true);
        sideSheet.unmount();

        // mask not closable
        let notMaskClosableSideSheet = mount(getSideSheet({
            maskClosable: false,
            visible: true,
            onCancel: spyOnCancel2
        }), { attachTo: document.getElementById('container') });
        notMaskClosableSideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-mask`).simulate('click');
        expect(spyOnCancel2.calledOnce).toBe(false);
        notMaskClosableSideSheet.unmount();
    });

    it('onCancel', () => {
        // onCancel on mask tested in [maskClosable]
        // onCancel on close btn
        // debugger
        let onCancel = () => { };
        let spyOnCancel = sinon.spy(onCancel);
        let closeCom = getSideSheet({
            visible: true,
            onCancel: spyOnCancel
        });
        let sideSheet = mount(closeCom, { attachTo: document.getElementById('container') });
        // let dom = sideSheet.find('div.${BASE_CLASS_PREFIX}-sidesheet-close').getDOMNode();
        sideSheet.find(`button.${BASE_CLASS_PREFIX}-sidesheet-close`).simulate('click');
        expect(spyOnCancel.calledOnce).toBe(true);
        sideSheet.unmount();
    });

    it('no mask', () => {
        let com = getSideSheet({
            mask: false
        });
        let sideSheet = mount(com, { attachTo: document.getElementById('container') });
        expect(sideSheet.exists(`.${BASE_CLASS_PREFIX}-modal-mask`)).toEqual(false);
        // TODO: add a button to see if could be clicked
        sideSheet.unmount();
    });

    it('getPopupContainer', () => {
        debugger
        let containedcom = (
            <div
                style={{
                    height: 320,
                    overflow: 'hidden',
                    position: 'relative',
                }}
                className='sidesheet-container'
            >
                <SideSheet
                    visible={true}
                    getPopupContainer={() => document.querySelector('.sidesheet-container')}
                />
            </div>
        )
        let wrapper1 = mount(containedcom, { attachTo: document.getElementById('container') });
        let container1 = document.querySelector('.sidesheet-container').querySelector(`.${BASE_CLASS_PREFIX}-sidesheet`);
        expect(wrapper1.find(`div.${BASE_CLASS_PREFIX}-sidesheet`).html()).toEqual(container1.outerHTML);
        // get popup container no body overflow
        debugger
        expect(document.body.style.overflow).not.toEqual('hidden');
        wrapper1.unmount();

        // no getPopupContainer
        let com = (
            <div
                style={{
                    height: 320,
                    overflow: 'hidden',
                    position: 'relative',
                }}
                className='sidesheet-container'
            >
                <SideSheet
                    visible={true}
                />
            </div>
        )
        let wrapper2 = mount(com, { attachTo: document.getElementById('container') });
        let container2 = document.querySelector('.sidesheet-container').querySelector(`.${BASE_CLASS_PREFIX}-sidesheet`);
        expect(container2).toEqual(null);
        wrapper2.unmount();
    });

    it('motion false', () => {
        let topCom = getSideSheet({ placement: 'top', visible: true, motion: false });

        let sideSheet = mount(topCom, { attachTo: document.getElementById('container') });
        // top
        expect(sideSheet.exists(`.${BASE_CLASS_PREFIX}-sidesheet-top`)).toEqual(true);
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).not.toHaveStyle({ transform: 'translateY(-100%)' });
        // bottom
        sideSheet.setProps({ placement: 'bottom' });
        expect(sideSheet.exists(`.${BASE_CLASS_PREFIX}-sidesheet-bottom`)).toEqual(true);
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).not.toHaveStyle({ transform: 'translateY(100%)' });
        // left
        sideSheet.setProps({ placement: 'left' });
        expect(sideSheet.exists(`.${BASE_CLASS_PREFIX}-sidesheet-left`)).toEqual(true);
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).not.toHaveStyle({ transform: 'translateX(-0%)' });
        // right
        sideSheet.setProps({ placement: 'right' });
        expect(sideSheet.exists(`.${BASE_CLASS_PREFIX}-sidesheet-right`)).toEqual(true);
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-sidesheet-inner`)).not.toHaveStyle({ transform: 'translateX(0%)' });

        // visible false
        sideSheet.setProps({ visible: false });
        sideSheet.update(); // 必须调用一次update
        expect(sideSheet.exists(`div.${BASE_CLASS_PREFIX}-sidesheet`)).toEqual(false);
        sideSheet.unmount();
    });

    it('closeIcon', () => {
        let com = getSideSheet({
            visible: true,
            closeIcon: (<IconEyeClosed />)
        });
        let sideSheet = mount(com, { attachTo: document.getElementById('container') });
        expect(sideSheet.find(`.${BASE_CLASS_PREFIX}-icon-eye_closed`).length).toBe(1);
    });

})
