import { clear } from 'jest-date-mock';
import { Collapsible } from '../../index';

function getCollapsible(props, children) {
    return (<Collapsible {...(props || {})}>
        {children ? children : <div className='collapsible-test-content'>hello</div>}
    </Collapsible>);
}

describe('collapsible', () => {
    beforeEach(() => {
        // Avoid `attachTo: document.body` Warning
        const div = document.createElement('div');
        div.setAttribute('id', 'container');
        document.body.appendChild(div);
        clear();
    });

    it('keepDOM = true',  () => {
        let component = getCollapsible({ keepDOM: true, motion: false, lazyRender:true });
        let collapsible = mount(component, { attachTo: document.getElementById('container') })
        expect(collapsible.exists(`.collapsible-test-content`)).toEqual(false);
        collapsible.setProps({keepDOM: true, motion: false, lazyRender:false,isOpen:true})
        collapsible.update();
        expect(collapsible.exists(`.collapsible-test-content`)).toEqual(true);
        collapsible.unmount()
    });


    it('keepDOM = true lazyRender=false', ()=>{
        let component = getCollapsible({ keepDOM: true, motion: false, lazyRender:false });
        let collapsible = mount(component, { attachTo: document.getElementById('container') })
        expect(collapsible.exists(`.collapsible-test-content`)).toEqual(true);
        collapsible.setProps({keepDOM: true, motion: false, lazyRender:false,isOpen:true})
        collapsible.update();
        expect(collapsible.exists(`.collapsible-test-content`)).toEqual(true);
        collapsible.setProps({keepDOM: true, motion: false, lazyRender:false,isOpen:false})
        collapsible.update();
        expect(collapsible.exists(`.collapsible-test-content`)).toEqual(true);
        collapsible.unmount()
    })






    it('keepDOM  lazyRender = false', () => {
        let component = getCollapsible({ keepDOM: false,motion:false, lazyRender: false });
        let collapsible = mount(component);
        expect(collapsible.exists(`.collapsible-test-content`)).toEqual(false);
        // set true
        collapsible.setProps({ isOpen: true,motion:false,keepDOM: false, lazyRender: false });
        collapsible.update(); // 必须调用一次update
        expect(collapsible.exists(`.collapsible-test-content`)).toEqual(true);
        collapsible.setProps({ isOpen: false,motion:false,keepDOM: false, lazyRender: false });
        collapsible.update(); // 必须调用一次update

        expect(collapsible.exists(`.collapsible-test-content`)).toEqual(false);
        collapsible.unmount()
    });
});
