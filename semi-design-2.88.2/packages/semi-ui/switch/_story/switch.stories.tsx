import React, { useState } from 'react';
import { Button } from '@douyinfe/semi-ui/';
import {
    storiesOf
} from '@storybook/react';
// import { withKnobs, text, boolean } from '@storybook/addon-knobs';

import { Switch } from '../../index';

const stories = storiesOf('Switch', module);

// stories.addDecorator(withKnobs);;

stories.add('switch', () => (
    <div>
        <Switch onChange={(v, e) => console.log(v)} aria-label='power-switch'>
        </Switch>
        <Switch defaultChecked={true} onChange={(v, e) => console.log(v)} aria-label='power-switch'>
        </Switch>
    </div>
));


stories.add('switch size', () => (
    <div>
        <Switch onChange={(v, e) => console.log(v)}></Switch>
        <Switch onChange={(v, e) => console.log(v)} size='small' aria-label='power-switch'></Switch>
        <Switch onChange={(v, e) => console.log(v)} size='large' aria-label='power-switch'></Switch>
    </div>
));

stories.add('switch checkedText &  uncheckedText', () => (
    <div>
        <Switch defaultChecked checkedText='开' uncheckedText='关' aria-label='power-switch'/>
        <Switch checkedText={'|'} uncheckedText='〇' />
        <br/><br/>
        <Switch checkedText='开' uncheckedText='关' />
        <Switch defaultChecked checkedText='｜' uncheckedText='〇' aria-label='power-switch'/>
        <br/><br/>
        <Switch checkedText='开' uncheckedText='关' size='large' aria-label='power-switch'/>
        <Switch checkedText='｜' uncheckedText='〇' size='large' aria-label='power-switch'/>
        <br/><br/>
        <Switch defaultChecked checkedText='开' uncheckedText='关' size='large' aria-label='power-switch'/>
        <Switch defaultChecked checkedText='｜' uncheckedText='〇' size='large' aria-label='power-switch'/>
    </div>
));

stories.add('switch disabled', () => (
    <>
        <Switch disabled>
            disabled
        </Switch>

        <Switch disabled checked={true} onChange={(v, e) => console.log(v)} aria-label='power-switch'>
        </Switch>
    </>
));


const ControlledSwitch = () => {
    const [checked, onChange] = useState(true);
    return (
        <Switch checked={checked} onChange={(v, e) => onChange(v)} />
    );
};
stories.add('switch checked + onChange', () => <ControlledSwitch/>);

const UnControlledSwitch = () => {
    const onChange = checked => {
        console.log(checked);
    };
    return (
        <>
            {/* <Switch onChange={onChange} defaultChecked={false}/> */}
            <Switch onChange={onChange} defaultChecked={true}/>
        </>
    );
};
stories.add('switch defaultChecked + onChange', () => <UnControlledSwitch/>);

class LoadingDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            checked: true,
            loading:false
        }
        this.onChange = this.onChange.bind(this);
    }
    onChange(checked) {
        this.setState({ checked });
    }
    render() {
        return (
            <>
                <Button onClick={() => { this.setState({ checked: true }); }}>
                    checked
                </Button>
                <br /><br />
                <Button onClick={() => { this.setState({ checked: false }); }}>
                    unchecked
                </Button>
                <br /><br />
                <Button onClick={() => { this.setState({ loading: !this.state.loading }); }}>
                    loading
                </Button>
                <br /><br />
                <Switch
                    checked={this.state.checked}
                    onChange={this.onChange}
                    loading={this.state.loading}>
                </Switch>
                <br /><br />
                <hr />
                <Switch loading disabled/>
                <br /><br />
                <Switch loading disabled defaultChecked/>
                <br /><br />
            </>
        )
    }
}

stories.add('loading', () => <LoadingDemo/>);
