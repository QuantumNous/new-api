import { clear } from 'jest-date-mock';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

import { Button } from '../../index';
import ScrollList from '../index';
import ScrollItem from '../scrollItem';

import { genAfterEach, genBeforeEach, mount, sleep } from '../../_test_/utils';

const selectedSelector = `.${BASE_CLASS_PREFIX}-scrolllist-item-selected`;

const DEFAULTS = {
    AMPM_INDEX: 1,
    HOUR_INDEX: 1,
    MINUTE_INDEX: 1,
};

const ampms = [
    {
        value: 'AM',
        transform: () => '上午',
    },
    {
        value: 'PM',
        transform: () => `下午`,
    },
];
const hours = new Array(12).fill(0).map((itm, index) => {
    return {
        value: index + 1,
    };
});
const minutes = new Array(60).fill(0).map((itm, index) => {
    return {
        value: index,
        disabled: index % 2 === 1 ? true : false,
    };
});

class Demo extends React.PureComponent {
    constructor(props) {
        super(props);
    }

    render() {
        const {
            minuteOnSelect,
            hourOnSelect,
            ampmOnSelect,
            mode = 'wheel',
            motion = true,
            selectedAmpmIndex = DEFAULTS.AMPM_INDEX,
            selectedHourIndex = DEFAULTS.HOUR_INDEX,
            selectedMinuteIndex = DEFAULTS.MINUTE_INDEX,
        } = this.props;

        const commonProps = {
            mode,
            cycled: false,
            motion,
        };

        return (
            <ScrollList
                header={'滚动列表'}
                footer={
                    <Button size="small" type="primary">
                        Ok
                    </Button>
                }
            >
                <ScrollItem
                    {...commonProps}
                    list={ampms}
                    type={1}
                    selectedIndex={selectedAmpmIndex}
                    onSelect={ampmOnSelect}
                />
                <ScrollItem
                    {...commonProps}
                    list={hours}
                    type={2}
                    selectedIndex={selectedHourIndex}
                    onSelect={hourOnSelect}
                />
                <ScrollItem
                    {...commonProps}
                    list={minutes}
                    type={3}
                    selectedIndex={selectedMinuteIndex}
                    onSelect={minuteOnSelect}
                />
            </ScrollList>
        );
    }
}

describe(`ScrollList`, () => {
    beforeEach(() => {
        clear();
        genBeforeEach()();
    });

    afterEach(genAfterEach());

    it(`test wheel mode appearance`, async () => {
        const listSelector = `.${BASE_CLASS_PREFIX}-scrolllist-list-outer`;
        const sleepMs = 200;

        const ampmOnSelect = sinon.spy();
        const hourOnSelect = sinon.spy();
        const minuteOnSelect = sinon.spy();

        const elem = mount(
            <Demo
                minuteOnSelect={minuteOnSelect}
                hourOnSelect={hourOnSelect}
                ampmOnSelect={ampmOnSelect}
                selectedAmpmIndex={DEFAULTS.AMPM_INDEX}
            />
        );

        await sleep(sleepMs);

        const all = elem.find(`${listSelector}`);

        const ampmList = all.at(0);
        const hourList = all.at(1);
        const minuteList = all.at(2);

        // check if has 3 lists
        expect(all.length).toBe(3);

        const minuteItems = minuteList.find(`ul li`);
        const firstDisabledMinuteIndex = minutes.findIndex(minute => minute.disabled);
        const nextEnabledMinuteIndex = minutes.findIndex((minute, index) => index > 1 && !minute.disabled);

        // click first disabled item
        minuteList.find('ul').simulate('click', {
            target: minuteItems.at(firstDisabledMinuteIndex).getDOMNode(),
            nativeEvent: null,
        });
        expect(minuteOnSelect.called).toBeFalsy();

        // click next enabled item
        minuteList.find('ul').simulate('click', {
            target: minuteItems.at(nextEnabledMinuteIndex).getDOMNode(),
            nativeEvent: null,
        });
        await sleep(sleepMs);
        expect(minuteOnSelect.calledOnce).toBeTruthy();
        // scroll minute list to disabled elem
        minuteList.simulate('scroll');
        await sleep(sleepMs);
        expect(minuteOnSelect.calledTwice).toBeTruthy();

        // scroll minute list to enabled elem
        // minuteList.getDOMNode().scrollTop += 2 * oneMinuteElemHeight;
        // await sleep(sleepMs);
        // expect(minuteList.getDOMNode().scrollTop).toBeGreaterThan(currentMinuteListDomScrollTop);
        // expect(minuteOnSelect.calledTwice).toBeTruthy();

        // set selected index manually
        // scrollTop is a not valid property
        const newAmpmIndex = elem.prop('selectedAmpmIndex') + ampms.length + 1;
        elem.setProps({ selectedAmpmIndex: newAmpmIndex });
        await sleep(sleepMs);
        const ampmScrollItem = elem.find(ScrollItem).at(0);
        ampmScrollItem.prop('onSelect')({});
        expect(ampmOnSelect.called).toBeTruthy();

        // scroll hour list
        hourList.simulate(`scroll`, {});
        const oneHourElemHeight = hourList
            .find(`li`)
            .at(0)
            .getDOMNode().scrollHeight;
        hourList.getDOMNode().scrollTop += oneHourElemHeight;
        await sleep(sleepMs);
        expect(hourOnSelect.called).toBeTruthy();
    });

    it(`test normal mode appearance`, async () => {
        const ampmOnSelect = sinon.spy();
        const minuteOnSelect = sinon.spy();

        const demo = mount(
            <Demo
                minuteOnSelect={minuteOnSelect}
                ampmOnSelect={ampmOnSelect}
                mode={'normal'}
                selectedAmpmIndex={DEFAULTS.AMPM_INDEX}
            />
        );

        const all = demo.find(`.${BASE_CLASS_PREFIX}-scrolllist-item`);
        const ampmList = all.at(0);
        const minuteList = all.at(2);

        // check if rendered three lists
        expect(all.length).toBe(3);

        // click next disabled item
        // const firstDisabledMinuteIndex = minutes.findIndex(minute => minute.disabled);
        const nextEnabledMinuteIndex = minutes.findIndex(
            (minute, index) => index > DEFAULTS.MINUTE_INDEX && !minute.disabled
        );

        const minuteItemDoms = minuteList.find(`li`);
        minuteItemDoms.at(nextEnabledMinuteIndex).simulate('click');
        expect(minuteOnSelect.called).toBeTruthy();

        // set AMPM
        const ampmItemDoms = ampmList.find(`li`);
        const selectedCls = `${BASE_CLASS_PREFIX}-scrolllist-item-sel`;
        let oldSelectedAmpmIndex = -1;
        let newSelectedAmpmIndex = -2;

        ampmItemDoms.forEach((el, index) => el.hasClass(selectedCls) && (oldSelectedAmpmIndex = index));
        const newAmpmIndex = demo.prop('selectedAmpmIndex') + ampms.length;
        demo.setProps({ selectedAmpmIndex: newAmpmIndex });

        ampmItemDoms.forEach((el, index) => el.hasClass(selectedCls) && (newSelectedAmpmIndex = index));
        expect(oldSelectedAmpmIndex === newSelectedAmpmIndex).toBeTruthy();
    });
});
