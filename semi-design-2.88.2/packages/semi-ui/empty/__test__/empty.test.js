import { Empty } from '../../index';
import { sleep as baseSleep } from '../../_test_/utils';
import { IllustrationConstruction, IllustrationConstructionDark } from '@douyinfe/semi-illustrations';

describe('Empty', () => {
    it('test className & style', () => {
        let props = {
            className: 'test',
            style: {
                color: 'red',
            },
        };
        const demo = mount(<Empty {...props}></Empty>);
        expect(demo.exists(`.semi-empty.semi-empty.test`)).toEqual(true);
        expect(demo.find(`.semi-empty`)).toHaveStyle('color', 'red');
        demo.unmount();
    });

    it('test description & title', () => {
        let props = {
            title: 'empty title',
            description: 'semi design',
        };
        const demo = mount(<Empty {...props}></Empty>);
        expect(demo.find(`.semi-typography.semi-empty-title`).text()).toEqual('empty title');
        expect(demo.find(`.semi-empty .semi-empty-description`).text()).toEqual('semi design');
        demo.unmount();
    });

    it('test layout', () => {
        let props = {
            layout: 'horizontal',
        };
        const demo = mount(
            <div>
                <Empty {...props}></Empty>
                <Empty {...props} layout="vertical"></Empty>
            </div>
        );
        expect(demo.exists(`.semi-empty-vertical`)).toBe(true);
        expect(demo.exists(`.semi-empty-horizontal`)).toBe(true);
        demo.unmount();
    });

    it('test image & imageStyle', async () => {
        const imgUrl = 'abc';
        const props = {
            image: <div className="test-img">semi design</div>,
            imageStyle: { width: '150px' },
        };
        const demo = mount(
            <div>
                <Empty {...props}></Empty>
                <Empty {...props} image={imgUrl}></Empty>
                <Empty {...props} image={<IllustrationConstruction />} darkModeImage={<IllustrationConstructionDark />}></Empty>
            </div>
        );
        expect(demo.exists(`.semi-empty-image .test-img`)).toBe(true);
        expect(demo.find(`.semi-empty-image`).at(0)).toHaveStyle('width', '150px');
        expect(demo.find(`.semi-empty-image svg`).length > 0).toBe(true);
        demo.unmount();
    });
});
