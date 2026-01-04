import { Modal } from '../../index';
// import toJson from 'enzyme-to-json';
import { clear } from 'jest-date-mock';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

import { cssClasses } from '@douyinfe/semi-foundation/icons/constants';
import { IconEyeClosed } from '@douyinfe/semi-icons';

const prefixCls = cssClasses.PREFIX;

function getModal(modalProps, children) {
    let props = modalProps ? modalProps : {};
    return (
        <Modal
            motion={false}
            {...props}
        >
            {children ? children : <p>This is content of basic modal</p>}
        </Modal>
    );
}

function mountToBody(component) {
    return mount(component, { attachTo: document.getElementById('container') });
}

describe('modal', () => {
    beforeEach(() => {
        // Avoid `attachTo: document.body` Warning
        const div = document.createElement('div');
        div.setAttribute('id', 'container');
        document.body.appendChild(div);
        clear();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('className / style / maskStyle / bodyStyle / zIndex', () => {
        let component = getModal({
            className: 'test',
            style: { color: 'red' },
            visible: true,
            maskStyle: { color: 'grey' },
            bodyStyle: { color: 'pink' },
            zIndex: 500,
        });
        let modal = mount(component, { attachTo: document.getElementById('container') });
        // let modal = mount(component, { attachTo: document.body });
        // test className
        expect(modal.exists('div.test')).toEqual(true);
        // test style
        expect(modal.find(`.${BASE_CLASS_PREFIX}-modal`)).toHaveStyle('color', 'red')
        // test bodyStyle
        expect(modal.find(`.${BASE_CLASS_PREFIX}-modal-body`)).toHaveStyle('color', 'pink');
        // test maskStyle
        expect(modal.find(`.${BASE_CLASS_PREFIX}-modal-mask`)).toHaveStyle('color', 'grey');
        // test zIndex
        expect(document.querySelector(`.${BASE_CLASS_PREFIX}-portal`).style.zIndex).toEqual("500");
        modal.unmount();
    });

    it('visible', (done) => {
        let component = getModal();
        let modal = mount(component, { attachTo: document.getElementById('container') });
        expect(modal.exists(`div.${BASE_CLASS_PREFIX}-modal`)).toEqual(false);
        // set true
        modal.setProps({ visible: true });
        modal.update(); // 必须调用一次update
        expect(modal.exists(`div.${BASE_CLASS_PREFIX}-modal`)).toEqual(true);
        expect(document.body.style.overflow).toEqual('hidden');
        // set false
        modal.setProps({ visible: false });
        modal.update(); // 必须调用一次update
        expect(document.body.style.overflow).not.toEqual('hidden');
        setTimeout(() => {
            expect(document.querySelector(`div.${BASE_CLASS_PREFIX}-modal`)).toEqual(null);
            done();
        }, 2000);
    });

    it('render basic content', () => {
        let com = getModal({ title: 'SemiTitle', visible: true })
        let modal = mount(com, { attachTo: document.getElementById('container') });
        // test title
        let sheetTitle = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-title`);
        expect(sheetTitle.textContent).toEqual('SemiTitle');
        // test content
        let sheetContent = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-body`);
        // the content in getModal could not be overwritten
        expect(sheetContent.textContent).toEqual('This is content of basic modal');
        modal.unmount();
    });

    it('footer / header', () => {
        let com = getModal({ header: (<p>This is a header</p>), footer: (<p>This is a footer</p>), visible: true })
        let modal = mount(com, { attachTo: document.getElementById('container') });
        expect(modal.find(`.${BASE_CLASS_PREFIX}-modal-content`).children().at(0).html()).toEqual('<p>This is a header</p>');
        expect(modal.find(`.${BASE_CLASS_PREFIX}-modal-footer`).contains(<p>This is a footer</p>)).toEqual(true);
        // test null
        modal.setProps({ header: null, footer: null });
        let content = modal.find(`.${BASE_CLASS_PREFIX}-modal-content`).children();
        expect(content.length).toEqual(1);
        expect(content.text()).toEqual('This is content of basic modal')
        modal.unmount();
    });

    it('height / width', () => {
        let com = getModal({ width: '413px', height: '613px', visible: true })
        let modal = mount(com, { attachTo: document.getElementById('container') });
        let dom = modal.find(`.${BASE_CLASS_PREFIX}-modal`).getDOMNode();
        expect(window.getComputedStyle(dom).width).toEqual('413px')
        expect(window.getComputedStyle(dom).height).toEqual('613px')
        modal.unmount();
    });

    it('size', () => {
        let com = getModal({ size: 'small', visible: true })
        let modal = mount(com, { attachTo: document.getElementById('container') });

        expect(modal.exists(`.${BASE_CLASS_PREFIX}-modal-small`)).toEqual(true);
        // test medium size
        modal.setProps({ size: 'medium' });
        expect(modal.exists(`.${BASE_CLASS_PREFIX}-modal-medium`)).toEqual(true);
        // test large size
        modal.setProps({ size: 'large' });
        expect(modal.exists(`.${BASE_CLASS_PREFIX}-modal-large`)).toEqual(true);
        // test full-width
        modal.setProps({ size: 'full-width' });
        expect(modal.exists(`.${BASE_CLASS_PREFIX}-modal-full-width`)).toEqual(true);
        modal.unmount();
    });

    it('closable', () => {
        let closeCom = getModal({ closable: true, visible: true });
        let nocloseCom = getModal({ closable: false, visible: true });
        let modal = mount(closeCom, { attachTo: document.getElementById('container') });
        expect(modal.exists(`.${BASE_CLASS_PREFIX}-modal-close`)).toEqual(true);
        modal.unmount();

        let notClosableSideSheet = mount(nocloseCom, { attachTo: document.getElementById('container') });
        expect(notClosableSideSheet.exists(`.${BASE_CLASS_PREFIX}-modal-close`)).toEqual(false);
        notClosableSideSheet.unmount();
    });

    it('getPopupContainer', () => {
        let containedcom = (
            <div
                style={{
                    height: 320,
                    overflow: 'hidden',
                    position: 'relative',
                }}
                className='modal-container'
            >
                <Modal
                    visible={true}
                    getPopupContainer={() => document.querySelector('.modal-container')}
                />
            </div>
        )
        let wrapper = mount(containedcom, { attachTo: document.getElementById('container') });
        let container = document.querySelector('.modal-container').querySelector(`.${BASE_CLASS_PREFIX}-modal`);
        expect(wrapper.find(`div.${BASE_CLASS_PREFIX}-modal`).html()).toEqual(container.outerHTML);
    });

    it('maskClosable', () => {
        let onCancel = () => { };
        let spyOnCancel = sinon.spy(onCancel);
        let spyOnCancel2 = sinon.spy(onCancel);
        let closeCom = getModal({
            maskClosable: true,
            visible: true,
            onCancel: spyOnCancel
        });
        let modal = mount(closeCom, { attachTo: document.getElementById('container') });
        // maskClosable
        modal.find(`.${BASE_CLASS_PREFIX}-modal-wrap`).simulate('click');
        expect(spyOnCancel.calledOnce).toBe(true);
        modal.unmount();

        // mask not closable
        let notMaskClosableSideSheet = mount(getModal({
            maskClosable: false,
            visible: true,
            onCancel: spyOnCancel2
        }), { attachTo: document.getElementById('container') });
        notMaskClosableSideSheet.find(`.${BASE_CLASS_PREFIX}-modal-wrap`).simulate('click');
        expect(spyOnCancel2.calledOnce).toBe(false);
        notMaskClosableSideSheet.unmount();
    });

    it('button props: cancelText / okText / okButtonProps / cancelButtonProps / hasCancel / confirmLoading ', () => {
        let component = getModal({
            cancelText: 'cancel',
            okText: 'ok',
            okType: 'secondary',
            visible: true,
            // remove close btn to avoid selected by selector
            closable: false,
        });
        let modal = mount(component, { attachTo: document.getElementById('container') });

        let footerBtn = modal.find(`.${BASE_CLASS_PREFIX}-button`)
        expect(footerBtn.at(0).text()).toEqual('cancel');
        expect(footerBtn.at(1).text()).toEqual('ok');
        expect(footerBtn.at(1)).toHaveClassName(`${BASE_CLASS_PREFIX}-button-secondary`);
        // test passing props
        modal.setProps({
            okButtonProps: { size: 'small', type: 'warning' },
            cancelButtonProps: { size: 'small', disabled: true }
        });
        footerBtn = modal.find(`.${BASE_CLASS_PREFIX}-button`)
        expect(footerBtn.at(0)).toHaveClassName(`${BASE_CLASS_PREFIX}-button-disabled ${BASE_CLASS_PREFIX}-button-size-small`);
        expect(footerBtn.at(1)).toHaveClassName(`${BASE_CLASS_PREFIX}-button-warning ${BASE_CLASS_PREFIX}-button-size-small`);
        // ok Btn loading, no cancel
        modal.setProps({
            hasCancel: false,
            confirmLoading: true,
        });
        footerBtn = modal.find(`.${BASE_CLASS_PREFIX}-button`)
        expect(footerBtn.length).toEqual(1);
        expect(footerBtn.at(0)).toHaveClassName(`${BASE_CLASS_PREFIX}-button-loading`);
    });

    it('onCancel / onOk', () => {
        // onCancel on close btn
        // debugger
        let onCancel = () => { };
        let onOk = () => { };
        let spyOnCancel = sinon.spy(onCancel);
        let spyOnOk = sinon.spy(onOk);
        let closeCom = getModal({
            visible: true,
            onCancel: spyOnCancel,
            onOk: spyOnOk
        });
        let modal = mount(closeCom, { attachTo: document.getElementById('container') });
        let btn = modal.find(`.${BASE_CLASS_PREFIX}-button`)
        modal.find(`button.${BASE_CLASS_PREFIX}-modal-close`).simulate('click');
        btn.at(1).simulate('click');
        btn.at(2).simulate('click');
        expect(spyOnCancel.calledTwice).toBe(true);
        expect(spyOnOk.calledOnce).toBe(true);
    });

    it('no mask', () => {
        let com = getModal({
            mask: false,
            visible: true,
        });
        let modal = mount(com, { attachTo: document.getElementById('container') });
        expect(modal.exists(`.${BASE_CLASS_PREFIX}-modal-mask`)).toEqual(false);
    });

    it('closeIcon', () => {
        let com = getModal({
            visible: true,
            closeIcon: (<IconEyeClosed />)
        });
        let modal = mount(com, { attachTo: document.getElementById('container') });
        expect(modal.find(`.${BASE_CLASS_PREFIX}-icon-eye_closed`).length).toBe(1);
    });


    it('motion false', () => {
        let com = getModal({ visible: true, motion: false });
        let modal = mount(com, { attachTo: document.getElementById('container') });
        expect(modal.find(`div.${BASE_CLASS_PREFIX}-modal`)).not.toHaveStyle('transform');
        // visible false
        modal.setProps({ visible: false });
        modal.update(); // 必须调用一次update
        expect(document.querySelector(`div.${BASE_CLASS_PREFIX}-modal`)).toEqual(null);
    });

    it('centered', (done) => {
        let com = getModal({ centered: true, visible: true, motion: true });
        let modal = mount(com, { attachTo: document.getElementById('container') });
        setTimeout(() => {
            modal.update();
            expect(modal.find(`div.${BASE_CLASS_PREFIX}-modal-content`)).toHaveClassName(`semi-modal-content-animate-show`);
            done();
        }, 2000);
    });

    it('centered without motion', () => {
        let com = getModal({ centered: true, visible: true, motion: false });
        let modal = mount(com, { attachTo: document.getElementById('container') });
        expect(modal.find(`div.${BASE_CLASS_PREFIX}-modal-wrap`)).toHaveClassName(`${BASE_CLASS_PREFIX}-modal-wrap-center`)
    });

    it('keepDOM', () => {
        let component = getModal({ keepDOM: true });
        let modal = mount(component, { attachTo: document.getElementById('container') });
        expect(modal.exists(`div.${BASE_CLASS_PREFIX}-modal`)).toEqual(false);
        // set true
        modal.setProps({ visible: true });
        modal.update(); // 必须调用一次update
        expect(modal.exists(`div.${BASE_CLASS_PREFIX}-modal`)).toEqual(true);
        expect(document.body.style.overflow).toEqual('hidden');
        // set false but still exist
        modal.setProps({ visible: false });
        modal.update(); // 必须调用一次update
        expect(modal.state().displayNone).toEqual(true);
        expect(modal.exists(`div.${BASE_CLASS_PREFIX}-modal`)).toEqual(true);
    });

    it('keepDOM + lazyRender=false', () => {
        let component = getModal({ keepDOM: true, lazyRender: false });
        let modal = mount(component, { attachTo: document.getElementById('container') });
        expect(modal.exists(`div.${BASE_CLASS_PREFIX}-modal`)).toEqual(true);
        // set true
        modal.setProps({ visible: true });
        modal.update(); // 必须调用一次update
        expect(modal.exists(`div.${BASE_CLASS_PREFIX}-modal`)).toEqual(true);
        expect(document.body.style.overflow).toEqual('hidden');
        // set false but still exist
        modal.setProps({ visible: false });
        modal.update(); // 必须调用一次update
        expect(modal.state().displayNone).toEqual(true);
        expect(modal.exists(`div.${BASE_CLASS_PREFIX}-modal`)).toEqual(true);
    });

    it('modal render', () => {
        const testClass = 'modal-render-test'
        let com = getModal({
            visible: true,
            modalRender: (modal) => (
                <div className={testClass}>
                    {modal}
                </div>
            )
        });
        let modal = mount(com, { attachTo: document.getElementById('container') });
        expect(modal.exists(`div.${testClass}`)).toEqual(true);
        modal.unmount();
    });
})
