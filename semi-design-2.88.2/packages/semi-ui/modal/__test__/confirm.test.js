import { Icon, Modal } from '../../index';
// import toJson from 'enzyme-to-json';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

import { IconSend } from '@douyinfe/semi-icons';


function getModal(modalProps, children) {
    let props = modalProps ? modalProps : {};
    return (
        <Modal
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
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('confirm title/contentß', () => {

        Modal.confirm({ 'title': 'Semi', 'content': 'Content' });
        let modal = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm`);
        expect(modal.querySelector(`.${BASE_CLASS_PREFIX}-modal-title`).textContent).toEqual('Semi');
        expect(modal.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm-content`).textContent).toEqual('Content');
        let portal = document.querySelector(`.${BASE_CLASS_PREFIX}-portal`);
        if (portal) {
            document.body.removeChild(portal);
        }

        Modal.error({ 'title': 'Semi', 'content': 'Content' });
        modal = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm`);
        debugger
        expect(modal.querySelector(`.${BASE_CLASS_PREFIX}-modal-error-icon`)).not.toEqual(null);

        portal = document.querySelector(`.${BASE_CLASS_PREFIX}-portal`);
        if (portal) {
            document.body.removeChild(portal);
        }

        Modal.success({ 'title': 'Semi', 'content': 'Content' });
        modal = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm`);
        expect(modal.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm-icon`).classList.contains(`${BASE_CLASS_PREFIX}-modal-success-icon`)).toEqual(true);
        portal = document.querySelector(`.${BASE_CLASS_PREFIX}-portal`);
        if (portal) {
            document.body.removeChild(portal);
        }

        Modal.info({ 'title': 'Semi', 'content': 'Content' });
        modal = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm`);
        expect(modal.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm-icon`).classList.contains(`${BASE_CLASS_PREFIX}-modal-info-icon`)).toEqual(true);
        portal = document.querySelector(`.${BASE_CLASS_PREFIX}-portal`);
        if (portal) {
            document.body.removeChild(portal);
        }

        Modal.warning({ 'title': 'Semi', 'content': 'Content' });
        modal = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm`);
        expect(modal.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm-icon`).classList.contains(`${BASE_CLASS_PREFIX}-modal-warning-icon`)).toEqual(true);
        portal = document.querySelector(`.${BASE_CLASS_PREFIX}-portal`);
        if (portal) {
            document.body.removeChild(portal);
        }
    });

    it('custom icon', () => {
        Modal.confirm({ 'title': 'Semi', 'content': 'Content', icon: <IconSend /> });
        let modal = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm`);
        expect(modal.querySelector(`.${BASE_CLASS_PREFIX}-icon-send`)).not.toEqual(null);
    });

    it('confirm callback', () => {
        let onCancel = () => { };
        let onOk = () => { };
        let spyOnCancel = sinon.spy(onCancel);
        let spyOnOk = sinon.spy(onOk);
        Modal.confirm({ 'title': 'Semi', 'content': 'Content', onOk: spyOnOk, onCancel: spyOnCancel });
        let modal = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm`);
        let btn = modal.querySelectorAll(`.${BASE_CLASS_PREFIX}-button`)
        btn[0].click();
        btn[1].click();
        btn[2].click();
        expect(modal.querySelectorAll(`.${BASE_CLASS_PREFIX}-button`)[1].classList.contains(`${BASE_CLASS_PREFIX}-button-loading`)).toEqual(false);
        expect(modal.querySelectorAll(`.${BASE_CLASS_PREFIX}-button`)[2].classList.contains(`${BASE_CLASS_PREFIX}-button-loading`)).toEqual(false);
        expect(spyOnCancel.calledTwice).toBe(true);
        expect(spyOnOk.calledOnce).toBe(true);
    });

    it('confirm ok callback promise loading', (done) => {
        let onOk = () => new Promise(resolve => {
            setTimeout(() => {
                resolve();
            }, 1000);
        });
        let spyOnOk = sinon.spy(onOk);
        Modal.confirm({ 'title': 'Semi', 'content': 'Content', onOk: spyOnOk });
        let modal = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm`);
        let btn = modal.querySelectorAll(`.${BASE_CLASS_PREFIX}-button`)
        btn[2].click();
        expect(spyOnOk.calledOnce).toBe(true);
        expect(modal.querySelectorAll(`.${BASE_CLASS_PREFIX}-button`)[2].classList.contains(`${BASE_CLASS_PREFIX}-button-loading`)).toEqual(true);
        setTimeout(() => {
            debugger
            expect(modal.querySelectorAll(`.${BASE_CLASS_PREFIX}-button`)[2].classList.contains(`${BASE_CLASS_PREFIX}-button-loading`)).toEqual(false);
            done();
        }, 2000);
    });

    it('confirm ok callback promise error', (done) => {
        const error = new Error('something wrong');
        let onOk = () => Promise.reject(error);
        let spyOnOk = sinon.spy(onOk);
        // let spyLog = sinon.spy(console, 'error')
        Modal.confirm({ 'title': 'Semi', 'content': 'Content', onOk: spyOnOk });
        let modal = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm`);
        let btn = modal.querySelectorAll(`.${BASE_CLASS_PREFIX}-button`)
        btn[2].click();
        setTimeout(() => {
            debugger
            // expect(spyLog.calledWithMatch(error)).toBe(true);
            expect(modal.querySelectorAll(`.${BASE_CLASS_PREFIX}-button`)[2].classList.contains(`${BASE_CLASS_PREFIX}-button-loading`)).toEqual(false);
            expect(document.querySelector(`div.${BASE_CLASS_PREFIX}-modal`)).not.toEqual(null);
            // console.error.restore();
            done();
        }, 1000);
    });

    it('confirm cancel callback promise loading', (done) => {
        let onCancel = () => new Promise(resolve => {
            setTimeout(() => {
                resolve();
            }, 1000);
        });;
        let spyOnCancel = sinon.spy(onCancel);
        Modal.confirm({ 'title': 'Semi', 'content': 'Content', onCancel: spyOnCancel });
        let modal = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm`);
        let btn = modal.querySelectorAll(`.${BASE_CLASS_PREFIX}-button`)
        btn[0].click();
        expect(spyOnCancel.calledOnce).toBe(true);
        expect(modal.querySelectorAll(`.${BASE_CLASS_PREFIX}-button`)[1].classList.contains(`${BASE_CLASS_PREFIX}-button-loading`)).toEqual(true);
        setTimeout(() => {
            expect(modal.querySelectorAll(`.${BASE_CLASS_PREFIX}-button`)[1].classList.contains(`${BASE_CLASS_PREFIX}-button-loading`)).toEqual(false);
            done();
        }, 2000);
    });

    it('confirm cancel callback promise error', (done) => {
        const error = new Error('something wrong');
        let onCancel = () => Promise.reject(error);
        let spyOnCancel = sinon.spy(onCancel);
        // let spyLog = sinon.spy(console, 'error')
        Modal.confirm({ 'title': 'Semi', 'content': 'Content', onCancel: spyOnCancel });
        let modal = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm`);
        let btn = modal.querySelectorAll(`.${BASE_CLASS_PREFIX}-button`)
        btn[1].click();
        setTimeout(() => {
            // expect(spyLog.calledWithMatch(error)).toBe(true);
            // console.error.restore();
            done();
        }, 1000);
    });

    it('modal update', () => {
        let modal = Modal.confirm({ 'title': 'Semi', 'content': 'Content' });
        let modalDom = document.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm`);
        expect(modalDom.querySelector(`.${BASE_CLASS_PREFIX}-modal-title`).textContent).toEqual('Semi');
        expect(modalDom.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm-content`).textContent).toEqual('Content');
        modal.update({ 'title': 'Updated Semi', 'content': 'Updated Content' });
        expect(modalDom.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm-title-text`).textContent).toEqual('Updated Semi');
        expect(modalDom.querySelector(`.${BASE_CLASS_PREFIX}-modal-confirm-content`).textContent).toEqual('Updated Content');
    });

    // TODO: modal destroy
    // async function destroy(modal) {
    //     modal.destroy && modal.destroy();
    //     // Allow requestAnimationFrame to be invoked before continuing
    //     await new Promise(resolve => setTimeout(resolve, 3000));
    // }

    // it('modal destroy', async done => {
    //     let modal = Modal.confirm({ 'title': 'Semi', 'content': 'Content' });
    //     expect(document.querySelector('div.${BASE_CLASS_PREFIX}-modal')).not.toEqual(null);
    //     await destroy(modal);
    //     debugger
    //     expect(document.querySelector('div.${BASE_CLASS_PREFIX}-modal')).toEqual(null);
    //     done();
    // });
})
