import { Carousel } from '../../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';


function getCarousel(carouselProps) {
    const contentStyle = {
        display:'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#fff',
        background: 'lightBlue',
    };

    return <Carousel style={{ width: '600px', height: '240px'}} {...carouselProps}>
      <div style={contentStyle}>
        <h3>index0</h3>
      </div>
      <div style={contentStyle}>
        <h3>index1</h3>
      </div>
      <div style={contentStyle}>
        <h3>index2</h3>
      </div>
    </Carousel>
}

function getSingleCarousel(carouselProps) {
    const contentStyle = {
        display:'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#fff',
        background: 'lightBlue',
    };

    return <Carousel style={{ width: '600px', height: '240px'}} {...carouselProps}>
      <div style={contentStyle}>
        <h3>index0</h3>
      </div>
    </Carousel>
}

describe('Carousel', () => {

    it('Carousel render basicly', () => {
        let props = {};
        const carousel = mount(getCarousel(props))
        expect(carousel.find(`.${BASE_CLASS_PREFIX}-carousel-content`).children().length).toEqual(3);
        expect(carousel.find(`.${BASE_CLASS_PREFIX}-carousel-content-item-active`).text()).toEqual('index0');
        carousel.unmount();
    });

    it('Carousel with custom className & style', () => {
        let props = {
            className: 'test',
            style: {
                color: 'red'
            }
        };
        const carousel = shallow(getCarousel(props));
        expect(carousel.exists('.test')).toEqual(true);
        expect(carousel.find('div.test')).toHaveStyle('color', 'red');
    });

    it('Carousel with defaultActiveIndex', () => {
        let props = {
            defaultActiveIndex: 2
        };
        const carousel = mount(getCarousel(props));
        const carouselContent = carousel.find(`.${BASE_CLASS_PREFIX}-carousel-content-item-active`).text();
        expect(carouselContent).toEqual('index2');
    });

    it('different theme', () => {
        let primary = mount(getCarousel({ theme: 'primary' }));
        let light = mount(getCarousel({ theme: 'light' }));
        let dark = mount(getCarousel({ theme: 'dark' }));
        expect(primary.exists(`.${BASE_CLASS_PREFIX}-carousel-arrow-primary`)).toEqual(true);
        expect(primary.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-item-primary`)).toEqual(true);
        expect(light.exists(`.${BASE_CLASS_PREFIX}-carousel-arrow-light`)).toEqual(true);
        expect(light.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-item-light`)).toEqual(true);
        expect(dark.exists(`.${BASE_CLASS_PREFIX}-carousel-arrow-dark`)).toEqual(true);
        expect(dark.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-item-dark`)).toEqual(true);
    });

    it('different indicator type', () => {
        let dot = mount(getCarousel({ indicatorType: 'dot' }));
        let line = mount(getCarousel({ indicatorType: 'line' }));
        let columnar = mount(getCarousel({ indicatorType: 'columnar' }));
        expect(dot.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-dot`)).toEqual(true);
        expect(dot.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-line`)).toEqual(false);
        expect(line.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-line`)).toEqual(true);
        expect(line.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-columnar`)).toEqual(false);
        expect(columnar.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-columnar`)).toEqual(true);
        expect(columnar.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-dot`)).toEqual(false);
    });

    it('different indicator position', () => {
        let left = mount(getCarousel({ indicatorPosition: 'left' }));
        let center = mount(getCarousel({ indicatorPosition: 'center' }));
        let right = mount(getCarousel({ indicatorPosition: 'right' }));
        expect(left.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-left`)).toEqual(true);
        expect(left.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-center`)).toEqual(false);
        expect(center.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-center`)).toEqual(true);
        expect(center.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-right`)).toEqual(false);
        expect(right.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-right`)).toEqual(true);
        expect(right.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-left`)).toEqual(false);
    });

    it('different indicator size', () => {
        let small = mount(getCarousel({ indicatorSize: 'small' }));
        let medium = mount(getCarousel({ indicatorSize: 'medium' }));
        expect(small.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-item-small`)).toEqual(true);
        expect(small.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-item-medium`)).toEqual(false);
        expect(medium.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-item-medium`)).toEqual(true);
        expect(medium.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator-item-small`)).toEqual(false);
    });

    it('show arrow and arrow change', () => {
        let spyOnChange = sinon.spy(() => {})
        let show = mount(getCarousel({ onChange: spyOnChange }));
        let hide = mount(getCarousel({ showArrow: false }));
        let hover = mount(getCarousel({ arrowType: 'hover' }));

        expect(show.exists(`.${BASE_CLASS_PREFIX}-carousel-arrow`)).toEqual(true);
        expect(hide.exists(`.${BASE_CLASS_PREFIX}-carousel-arrow`)).toEqual(false);
        expect(hover.exists(`.${BASE_CLASS_PREFIX}-carousel-arrow-hover`)).toEqual(true);

        show.find(`.${BASE_CLASS_PREFIX}-carousel-arrow-prev`).simulate('click');
        expect(spyOnChange.calledOnce).toBe(true);
        expect(show.find(`.${BASE_CLASS_PREFIX}-carousel-content-item-active`).text()).toEqual('index2');

        show.find(`.${BASE_CLASS_PREFIX}-carousel-arrow-next`).simulate('click');
        expect(show.find(`.${BASE_CLASS_PREFIX}-carousel-content-item-active`).text()).toEqual('index0');
        
    });

    it('indicator change with click or trigger', () => {
        let spyOnChange = sinon.spy(() => {})
        let carousel = mount(getCarousel({ onChange: spyOnChange }));
        carousel.find(`.${BASE_CLASS_PREFIX}-carousel-indicator-item`).at(2).simulate('click');
        expect(spyOnChange.calledOnce).toBe(true);
        expect(carousel.find(`.${BASE_CLASS_PREFIX}-carousel-content-item-active`).text()).toEqual('index2');

        let spyOnChangeHover = sinon.spy(() => {})
        let carouselHover = mount(getCarousel({ onChange: spyOnChangeHover, trigger: 'hover' }));
        carouselHover.find(`.${BASE_CLASS_PREFIX}-carousel-indicator-item`).at(2).simulate('mouseEnter', {});
        expect(spyOnChangeHover.calledOnce).toBe(true);
        expect(carouselHover.find(`.${BASE_CLASS_PREFIX}-carousel-content-item-active`).text()).toEqual('index2');
    });

    it('single index', () => {
        let carousel = mount(getSingleCarousel({}));
        expect(carousel.exists(`.${BASE_CLASS_PREFIX}-carousel-indicator`)).toEqual(false);
        expect(carousel.exists(`.${BASE_CLASS_PREFIX}-carousel-arrow`)).toEqual(false);
        carousel.unmount();
    });

})