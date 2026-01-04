import React, { useState } from 'react';
import { storiesOf } from '@storybook/react';
import { Button, Feedback } from '../../index';

const stories = storiesOf('Feedback', module);

stories.add(`default`, () => {

    const Demo = () => {
        const [visible, setVisible] = useState(false);
        return <div>
             <Button onClick={() => setVisible(!visible)} >
                Open Feedback: Modal, Input
            </Button>
            <Feedback
                visible={visible}
                onOk={() => setVisible(false)}
                onCancel={() => setVisible(false)}
                title="Why did you choose this rating?"
                type='text'
                mode='modal'
            />
        </div>
    }

    return <Demo/>
})