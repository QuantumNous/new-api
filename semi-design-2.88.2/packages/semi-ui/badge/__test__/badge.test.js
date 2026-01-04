import Badge from '../index';
import Avatar from '../../avatar/index';
import ConfigProvider from '../../configProvider';

function getBadge(props) {
    if (!props.optionList && !props.children) {
        props.children = <Avatar color='blue'>Semi</Avatar>
    }

    return mount(<Badge {...props} />);
}


describe('badge', () => {
    it('badge with custom className & style', () => {
        let props = {
            className: 'test',
            countStyle: {
                color: 'red'
            },
            count: 5
        }
        let badge = getBadge(props);
        expect(badge.hasClass('test')).toEqual(true);
        expect(badge.find('.test .semi-badge-count')).toHaveStyle('color', 'red');
        badge.unmount();
    });

    it('badge children', () => {
        let children = (<div>semi design</div>)
        let props = {
            children
        };
        let badge = getBadge(props);
        expect(badge.contains(children)).toEqual(true);
    });
 
    it('badge count', () => {
        let props = {
            count: 5
        };
        let badge = getBadge(props);
        expect(badge.find('.semi-badge-count').text()).toEqual("5");
        expect(badge.exists('.semi-badge-dot')).toEqual(false);
        let stringProps = {
            count: 'semi'
        }
        let stringBadge = getBadge(stringProps);
        expect(stringBadge.find('.semi-badge-count').text()).toEqual("semi");
        expect(stringBadge.exists('.semi-badge-dot')).toEqual(false);
    });

    it('badge dot', () => {
        let props = {
            dot: true
        };
        let badge = getBadge(props);
        expect(badge.exists('.semi-badge-dot')).toEqual(true);
        expect(badge.exists('.semi-badge-count')).toEqual(false);
    });

    it('badge overflowCount', () => {
        let props = {
            count: 99,
            overflowCount: 5
        };
        let badge = getBadge(props);
        expect(badge.find('.semi-badge-count').text()).toEqual('5+');
    });

    it('badge type & theme', () => {
        let types = ['primary', 'secondary', 'tertiary', 'warning', 'danger'];
        let themes = ['solid', 'light', 'inverted'];
        let props = {
            type: types[0],
            theme: themes[0]
        }
        let badge = getBadge(props)
        expect(badge.exists(`.semi-badge-${types[0]}`)).toEqual(true);
        badge.setProps({ type: types[1] });
        badge.update();
        expect(badge.exists(`.semi-badge-${types[1]}`)).toEqual(true);
        badge.setProps({ type: types[2] });
        badge.update();
        expect(badge.exists(`.semi-badge-${types[2]}`)).toEqual(true);
        badge.setProps({ type: types[3] });
        badge.update();
        expect(badge.exists(`.semi-badge-${types[3]}`)).toEqual(true);
        badge.setProps({ type: types[4] });
        badge.update();
        expect(badge.exists(`.semi-badge-${types[4]}`)).toEqual(true);
        badge.setProps({ theme: themes[1] });
        badge.update();
        expect(badge.exists(`.semi-badge-${themes[1]}`)).toEqual(true);
        badge.setProps({ theme: themes[2] });
        badge.update();
        expect(badge.exists(`.semi-badge-${themes[2]}`)).toEqual(true);
    });

    it('badge position', () => {
        let leftTop = { position: 'leftTop' };
        let leftBottom = { position: 'leftBottom' };
        let rightTop = { } //rightTop is default position
        let rightBottom = { position: 'rightBottom' };
        let leftTopBadge = getBadge(leftTop);
        let leftBottomBadge = getBadge(leftBottom);
        let rightTopBadge = getBadge(rightTop);
        let rightBottomBadge = getBadge(rightBottom);
        expect(leftTopBadge.exists('.semi-badge-leftTop')).toEqual(true);
        expect(leftBottomBadge.exists('.semi-badge-leftBottom')).toEqual(true);
        expect(rightTopBadge.exists('.semi-badge-rightTop')).toEqual(true);
        expect(rightBottomBadge.exists('.semi-badge-rightBottom')).toEqual(true);
    });

    it('badge in rtl mode', ()=>{
        let rtlWrapper = mount(
            <ConfigProvider direction='rtl'>
                <Badge count={5}>Semi</Badge>
            </ConfigProvider>
        )
        // when in rtl mode, default position is 'rightTop'
        expect(rtlWrapper.exists('.semi-badge-leftTop')).toEqual(true);
    })
});
