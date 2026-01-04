import Trigger from '../index';
import { mount } from 'enzyme';


describe('Trigger', () => {

    it('trigger normal', () => {
        
        const trigger = mount(<Trigger
                triggerRender={() => (
                    <div className="trigger-cls">trigger</div>
                )}
            />
        );
        expect(trigger.find(`.trigger-cls`).length === 1).toEqual(true);
    });
})
