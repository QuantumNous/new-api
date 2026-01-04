import React from 'react';
import { DatePicker, Space, Button } from '../../../index';
import type { BaseDatePicker } from '../../index';

class FeatRefClass extends React.Component {
    ref: React.RefObject<BaseDatePicker>;
    constructor(props) {
        super(props);
        this.ref = React.createRef();
    }

    handleFocus() {
        console.log('focus');
    }

    render() {
        return (
            <Space vertical align={'start'}>
                <Space>
                    <Button onClick={() => this.ref.current.open()}>open</Button>
                    <Button onClick={() => this.ref.current.close()}>close</Button>
                </Space>
                <div>
                    <DatePicker motion={false} type="dateTime" needConfirm ref={this.ref} />
                </div>
            </Space>
        );
    }
}

Demo.storyName = 'ref class 写法';
Demo.parameters = {
    chromatic: { disableSnapshot: false },
};
export default function Demo() {
    return (
        <FeatRefClass />
    );
}