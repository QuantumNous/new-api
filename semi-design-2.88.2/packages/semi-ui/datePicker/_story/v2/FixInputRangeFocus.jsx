import React from 'react';
import { DatePicker, Button } from '../../../index';

/**
 * fix gitlab #1375
 */
App.storyName = 'fixed input range focus';
export default function App() {
    const [visible, setVisible] = React.useState(false);
    return (
        <div>
            {/* <Button onClick={() => { setVisible(false); }}>关闭</Button> */}
            <DatePicker
                type="dateTimeRange"
                bottomSlot={<Button onClick={() => { setVisible(false); }}>关闭</Button>}
                onFocus={() => {
                    console.log('focus');
                    setVisible(true); 
                }}
                open={visible}
                showClear
            />
        </div>
    );
}