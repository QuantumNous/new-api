import React, { useState } from 'react';

import { Button } from '@douyinfe/semi-ui/';
import { Switch } from '../../index';

export default {
  title: 'Switch'
}

export const _Switch = () => (
  <div>
    <Switch onChange={(v, e) => console.log(v)} aria-label='power-switch'></Switch>
    <Switch defaultChecked={true} onChange={(v, e) => console.log(v)} aria-label='mode-switch'></Switch>
  </div>
);

_Switch.story = {
  name: 'switch',
};

export const SwitchSize = () => (
  <div>
    <Switch onChange={(v, e) => console.log(v)} aria-label='power-switch'></Switch>
    <Switch onChange={(v, e) => console.log(v)} size="small" aria-label='power-switch'></Switch>
    <Switch onChange={(v, e) => console.log(v)} size="large" aria-label='power-switch'></Switch>
  </div>
);

SwitchSize.story = {
  name: 'switch size',
};

export const SwitchCheckedTextUncheckedText = () => (
  <div>
    <Switch defaultChecked checkedText="开" uncheckedText="关" aria-label='power-switch'/>
    <Switch checkedText={'|'} uncheckedText="〇" aria-label='power-switch'/>
    <br />
    <br />
    <Switch checkedText="开" uncheckedText="关" aria-label='power-switch'/>
    <Switch defaultChecked checkedText="｜" uncheckedText="〇" aria-label='power-switch'/>
    <br />
    <br />
    <Switch checkedText="开" uncheckedText="关" size="large" aria-label='power-switch'/>
    <Switch checkedText="｜" uncheckedText="〇" size="large" aria-label='power-switch'/>
    <br />
    <br />
    <Switch defaultChecked checkedText="开" uncheckedText="关" size="large" aria-label='power-switch'/>
    <Switch defaultChecked checkedText="｜" uncheckedText="〇" size="large" aria-label='power-switch'/>
  </div>
);

SwitchCheckedTextUncheckedText.story = {
  name: 'switch checkedText &  uncheckedText',
};

export const SwitchDisabled = () => (
  <>
    <Switch disabled aria-label='power-switch'>disabled</Switch>

    <Switch disabled checked={true} onChange={(v, e) => console.log(v)} aria-label='power-switch'></Switch>
  </>
);

SwitchDisabled.story = {
  name: 'switch disabled',
};

const ControlledSwitch = () => {
  const [checked, onChange] = useState(true);
  return <Switch checked={checked} onChange={(v, e) => onChange(v)} aria-label='power-switch'/>;
};
export const SwitchCheckedOnChange = () => <ControlledSwitch />;

SwitchCheckedOnChange.story = {
  name: 'switch checked + onChange',
};

const UnControlledSwitch = () => {
  const onChange = checked => {
    console.log(checked);
  };
  return (
    <>
      {/* <Switch onChange={onChange} defaultChecked={false}/> */}
      <Switch onChange={onChange} defaultChecked={true} aria-label='power-switch'/>
    </>
  );
};
export const SwitchDefaultCheckedOnChange = () => <UnControlledSwitch />;

SwitchDefaultCheckedOnChange.story = {
  name: 'switch defaultChecked + onChange',
};

class LoadingDemo extends React.Component {
  constructor() {
    super();
    this.state = {
      checked: true,
      loading: false,
    };
    this.onChange = this.onChange.bind(this);
  }
  onChange(checked) {
    this.setState({ checked });
  }
  render() {
    return (
      <>
        <Button
          onClick={() => {
            this.setState({ checked: true });
          }}
        >
          checked
        </Button>
        <br />
        <br />
        <Button
          onClick={() => {
            this.setState({ checked: false });
          }}
        >
          unchecked
        </Button>
        <br />
        <br />
        <Button
          onClick={() => {
            this.setState({ loading: !this.state.loading });
          }}
        >
          loading
        </Button>
        <br />
        <br />
        <Switch
          checked={this.state.checked}
          onChange={this.onChange}
          aria-label='power-switch'
          loading={this.state.loading}
        ></Switch>
        <br />
        <br />
        <hr />
        <Switch loading disabled aria-label='power-switch'/>
        <br />
        <br />
        <Switch loading disabled defaultChecked aria-label='power-switch'/>
        <br />
        <br />
      </>
    );
  }
}

export const Loading = () => <LoadingDemo />;

Loading.story = {
  name: 'loading',
};
