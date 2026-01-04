import { Image } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';


describe('Image', () => {
    it('custom imgCls & imgStyle', () => {
        let spyOnClick = sinon.spy(() => { });
        const imageComponent = (<Image 
            imgCls="custom-img-cls"
            imgStyle={{ maxWidth: 300}}
            src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg"
        />);
        const image = mount(imageComponent, { attachTo: document.getElementById('container') });
        expect(image.find(`.${BASE_CLASS_PREFIX}-image-img`).at(0).hasClass('custom-img-cls')).toBe(true);
        expect(image.find(`.${BASE_CLASS_PREFIX}-image-img`).at(0).getDOMNode().style.maxWidth).toBe('300px');
    });
})
