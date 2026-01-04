import { Banner } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';


// function render(props) {
//     return mount(
//         <Banner
//             {...props}
//         />,
//         {
//             attachTo: document.getElementById('container')
//         }
//     );
// }


describe('Banner', () => {

    // beforeEach(() => {
    //     // Avoid `attachTo: document.body` Warning
    //     const div = document.createElement('div');
    //     div.setAttribute('id', 'container');
    //     document.body.appendChild(div);
    // });

    // afterEach(() => {
    //     const div = document.getElementById('container');
    //     if (div) {
    //         document.body.removeChild(div);
    //     }
    // });

    it('different type banner', () => {
        const defaultBanner = mount(<Banner />);
        const dangerBanner = mount(<Banner type='danger' />);
        const successBanner = mount(<Banner type='success' />);
        const warningBanner = mount(<Banner type='warning' />);
        expect(dangerBanner.exists(`.${BASE_CLASS_PREFIX}-banner-danger`)).toEqual(true);
        expect(defaultBanner.exists(`.${BASE_CLASS_PREFIX}-banner`)).toEqual(true);
        expect(successBanner.exists(`.${BASE_CLASS_PREFIX}-banner-success`)).toEqual(true);
        expect(warningBanner.exists(`.${BASE_CLASS_PREFIX}-banner-warning`)).toEqual(true);
    });

    it('custom className & style', () => {
        const wrapper = mount(<Banner className='test' style={{ color: 'red' }} />, { attachTo: document.getElementById('container') });
        expect(wrapper.find('div.test')).toHaveStyle('color', 'red');
    });

    it('call onClose', () => {
        const onClose = () => { };
        let spyOnClose = sinon.spy(onClose);
        const wrapper = mount(<Banner onClose={spyOnClose} />);
        wrapper.find(`.${BASE_CLASS_PREFIX}-button`).simulate('click', { target: { value: 'test' }});
        expect(spyOnClose.calledOnce).toBe(true);
        // 验证回调参数是否正确
        expect(spyOnClose.getCall(0).args[0].target.value).toEqual('test');
    });
});
