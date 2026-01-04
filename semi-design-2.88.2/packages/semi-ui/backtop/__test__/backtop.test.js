import { BackTop } from '../../index';
import sinon from 'sinon';

describe('BackTop', () => {
    beforeEach(() => {
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => cb());
      });
      
    afterEach(() => {
        window.requestAnimationFrame.mockRestore();
    });

    it('test className & style', () => {
        const props = {
            className: 'test',
            style: {
                color: 'red',
            },
            visibilityHeight: -1,
        };
        const demo = mount(
            <div>
                <div style={{height: 1600, width: 300, background: 'grey'}}></div>
                <BackTop {...props}></BackTop>
            </div>
        );
        expect(demo.exists(`.semi-backtop.test`)).toEqual(true);
        expect(demo.find(`.semi-backtop`)).toHaveStyle('color', 'red');
        demo.unmount();
    });

    it('test onClick', () => {
        const onClick = sinon.spy(() => {});
        const props = {
            onClick,
            className: 'test',
            visibilityHeight: -1,
        };
        const demo = mount(
            <div>
                <div style={{height: 1600, width: 300, background: 'grey'}}></div>
                <BackTop {...props}></BackTop>
            </div>
        );
        demo.find('.semi-backtop.test').simulate('click');
        expect(onClick.calledOnce).toEqual(true);
        demo.unmount();
    });
});
