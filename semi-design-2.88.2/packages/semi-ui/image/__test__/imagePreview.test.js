import { Image, ImagePreview } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

function getImagePreview(imageProps) {
    const props = imageProps ? imageProps : {};
    const srcList = [
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/abstract.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/sky.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/greenleaf.jpg",
        "https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/colorful.jpg",
    ];
    return (
        <ImagePreview {...props}>
            {srcList.map((src, index) => {
                return (
                    <Image
                        key={index}
                        src={src}
                        width={200}
                        alt={`lamp${index + 1}`}
                        style={{ marginRight: 5 }}
                    />
                );
            })}
        </ImagePreview>
    )
}

describe('ImagePreview', () => {
    it('visible', function () {
        const imageComponent = getImagePreview();
        const image = mount(imageComponent, { attachTo: document.getElementById('container') });
        expect(image.exists(`div.${BASE_CLASS_PREFIX}-image-preview`)).toEqual(false);
        image.setProps({ visible: true })
        image.update();
        expect(image.exists(`div.${BASE_CLASS_PREFIX}-image-preview`)).toEqual(true);
        expect(document.body.style.overflow).toEqual('hidden');
        image.setProps({ visible: false })
        image.update();
        expect(document.body.style.overflow).not.toEqual('hidden');
        expect(document.querySelector(`div.${BASE_CLASS_PREFIX}-image-preview`)).toEqual(null);
    });
})
