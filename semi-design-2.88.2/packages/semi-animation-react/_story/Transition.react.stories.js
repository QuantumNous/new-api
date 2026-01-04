import React, { useState, Component, isValidElement, PureComponent, createRef } from 'react';
import ReactDOM from 'react-dom';
import { storiesOf } from '@storybook/react';
import { withKnobs, text, boolean } from '@storybook/addon-knobs';
import withPropsCombinations from 'react-storybook-addon-props-combinations';

import { Transition } from '../index';

import QueueTransition from './queue-transition';
import QueueStyledTransition from './queue-transition/styled';

import { Modal, Button, IconButton, Collapse, Nav, Switch, RadioGroup, Radio } from '@douyinfe/semi-ui';

const stories = storiesOf('semi-animation-react/Transition', module);

stories.addDecorator(withKnobs);

const itemStyle = {
    backgroundColor: 'rgb(241, 101, 101)',
    color: 'white',
    borderRadius: 4,
    padding: 10,
    textAlign: 'center',
};

const bigSquareStyle = {
    backgroundColor: 'rgb(241, 101, 101)',
    width: 100,
    height: 100,
    margin: 20,
    marginLeft: 50,
    borderRadius: 4,
    fontSize: 16,
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

stories.add('transition-bounceInOut', () => {
    class App extends PureComponent {
        constructor(props = {}) {
            super(props);

            this.state = {
                visible: true,
            };

            this.ref = createRef();
        }

        setVisible = visible => this.setState({ visible });

        render() {
            const { visible } = this.state;

            return (
                <div>
                    <div>
                        <Transition
                            // config={{ ...presets.wobbly }}
                            immediate
                            config={{ tension: 745, friction: 35 }}
                            from={{ scale: 0.7, opacity: { val: 0, duration: 200 } }}
                            enter={{ scale: 1, opacity: { val: 1, duration: 200 } }}
                            leave={{ scale: { val: 0.7, duration: 300 }, opacity: { val: 0, duration: 200 } }}
                        >
                            {visible
                                ? ({ scale, opacity }) => {
                                      const node = this.ref.current;
                                      console.log('ref rect: ', node && node.getBoundingClientRect());
                                      return (
                                          <div
                                              ref={this.ref}
                                              style={{
                                                  ...bigSquareStyle,
                                                  opacity,
                                                  transform: `scale(${scale}, ${scale})`,
                                              }}
                                          >
                                              bounceInOut
                                          </div>
                                      );
                                  }
                                : null}
                        </Transition>
                    </div>
                    <div>
                        <button
                            onClick={() => {
                                this.setVisible(true);
                                // setState('enter');
                            }}
                        >
                            入场
                        </button>
                        <button onClick={() => this.setVisible(false)}>出场</button>
                    </div>
                </div>
            );
        }
    }

    class ModalDemo extends React.Component {
        constructor() {
            super();
            this.state = { visible: false, visibleWithAnimation: false };
            this.showDialog = this.showDialog.bind(this);
            this.handleOk = this.handleOk.bind(this);
            this.handleCancel = this.handleCancel.bind(this);
        }

        showDialog() {
            this.setState({
                visible: true,
                visibleWithAnimation: true,
            });
        }

        handleOk(e) {
            this.setState({
                // visible: false,
                visibleWithAnimation: false,
            });
        }

        handleCancel(e) {
            this.setState({
                // visible: false,
                visibleWithAnimation: false,
            });
        }

        render() {
            const { visibleWithAnimation, visible } = this.state;

            return (
                <>
                    <Button onClick={this.showDialog}>Open Modal</Button>
                    <Transition
                        config={{
                            // ...presets.wobbly
                            duration: 200,
                            easing: visibleWithAnimation ? 'easeInCubic' : 'easeOutCubic',
                        }}
                        from={{
                            scale: 0,
                            // opacity: { val: 0, easing: 'linear' },
                        }}
                        enter={{
                            scale: 1,
                            // opacity: { val: 1, easing: 'linear' },
                        }}
                        leave={{
                            scale: 0,
                            // opacity: { val: 0, easing: 'linear' },
                        }}
                        didLeave={() => this.setState({ visible: false })}
                    >
                        {visibleWithAnimation
                            ? ({ opacity, scale }) => (
                                  <Modal
                                      title="自定义样式"
                                      visible={visible}
                                      onOk={this.handleOk}
                                      onCancel={this.handleCancel}
                                      style={{ top: '30vh', transform: `scale(${scale},${scale})` }}
                                      maskStyle={{ backgroundColor: 'pink', opacity: '.3' }}
                                      bodyStyle={{ backgroundColor: 'lightgrey' }}
                                  >
                                      <p>This is a modal with customized styles.</p>
                                      <p>More content...</p>
                                  </Modal>
                              )
                            : null}
                    </Transition>
                </>
            );
        }
    }

    return (
        <>
            <ModalDemo />
            <App />
        </>
    );
});

stories.add('transition-bounceInOut-受控', () => {
    class App extends PureComponent {
        constructor(props = {}) {
            super(props);

            this.state = {
                state: 'enter',
                visible: true,
            };

            this.ref = createRef();
        }

        setVisible = visible => this.setState({ state: visible ? 'enter' : 'leave' });

        didEnter = () => {
            this.setState({ visible: true });
        };

        didLeave = () => {
            this.setState({ visible: false });
        };

        render() {
            const { visible, state } = this.state;

            return (
                <div>
                    <div>
                        <Transition
                            // config={{ ...presets.wobbly }}
                            state={state}
                            config={{ tension: 745, friction: 35 }}
                            from={{ scale: 0.7, opacity: { val: 0, duration: 200 } }}
                            enter={{ scale: 1, opacity: { val: 1, duration: 200 } }}
                            leave={{ scale: { val: 0.7, duration: 300 }, opacity: { val: 0, duration: 200 } }}
                            didEnter={this.didEnter}
                            didLeave={this.didLeave}
                        >
                            {state === 'enter' || visible
                                ? ({ scale, opacity }) => {
                                      const node = this.ref.current;
                                      // console.log('ref rect: ', node && node.getBoundingClientRect());
                                      return (
                                          <div
                                              ref={this.ref}
                                              style={{
                                                  ...bigSquareStyle,
                                                  opacity,
                                                  transform: `scale(${scale}, ${scale})`,
                                              }}
                                          >
                                              bounceInOut
                                          </div>
                                      );
                                  }
                                : null}
                        </Transition>
                    </div>
                    <div>
                        <button onClick={() => this.setVisible(true)}>入场</button>
                        <button onClick={() => this.setVisible(false)}>出场</button>
                    </div>
                </div>
            );
        }
    }

    return (
        <>
            <App />
        </>
    );
});

stories.add('transition-slideInOutDown', () => {
    const SlideInOutDown = function SlideInOutDown(props = {}) {
        return (
            <Transition from={{ maxHeight: 0 }} enter={{ maxHeight: 100 }} leave={{ maxHeight: 0 }}>
                {props.children}
            </Transition>
        );
    };

    class App extends PureComponent {
        state = {
            itemKey: '',
        };

        setItemKey = itemKey => this.setState({ itemKey });

        render() {
            const { itemKey } = this.state;

            return (
                <Collapse accordion onChange={this.setItemKey}>
                    {['1', '2', '3'].map(key => (
                        <Collapse.Panel header={`This is panel header ${key}`} itemKey={key} key={key}>
                            {/* <SlideInOutDown> */}
                            <Transition from={{ maxHeight: 0 }} enter={{ maxHeight: 100 }} leave={{ maxHeight: 0 }}>
                                {itemKey === key
                                    ? ({ maxHeight }) => (
                                          <p
                                              style={{
                                                  maxHeight: `${maxHeight}%`,
                                                  transform: `translateY(${maxHeight - 100}%)`,
                                              }}
                                          >
                                              Hi, bytedance dance dance. This is the docsite of Semi UI.{' '}
                                          </p>
                                      )
                                    : null}
                                {/* </SlideInOutDown> */}
                            </Transition>
                        </Collapse.Panel>
                    ))}
                </Collapse>
            );
        }
    }

    return <App />;
});

stories.add('transition-slideInOutLeft', () => {
    function SlideInOutLeft(props = {}) {
        return (
            <Transition {...props} from={{ translateX: -100 }} enter={{ translateX: 0 }} leave={{ translateX: -100 }}>
                {props.children}
            </Transition>
        );
    }

    class NavApp extends React.Component {
        constructor() {
            super();
            this.state = {
                isCollapsed: true,
                defaultOpenKeys: ['2', '2-3'],
                mode: 'vertical',
                navHeight: 480,
                selectedKeys: [],
                openKeys: ['2'],
            };

            this.onSelect = (data = {}) => {
                console.log('trigger onSelect: ', data);
                let selectedKeys = Array.from(data.selectedKeys);
                this.setState({ selectedKeys });
            };

            this.onOpenChange = (data = {}) => {
                console.log('trigger onOpenChange: ', data);
                let openKeys = Array.from(data.openKeys);
                this.setState({ openKeys });
            };
        }

        updateCollapsed(isCollapsed) {
            this.setState({ isCollapsed });
        }

        toggleMode() {
            let { mode, navHeight } = this.state;

            if (mode === 'vertical') {
                mode = 'horizontal';
                navHeight = 60;
            } else {
                mode = 'vertical';
                navHeight = 480;
            }

            this.setState({ mode, navHeight });
        }

        renderNavWithTransform = ({ transform, translateX }) => {
            let { isCollapsed, defaultOpenKeys, mode, navHeight, selectedKeys, openKeys } = this.state;
            let testIcon = '//lf1-cdn-tos.bytescm.com/obj/mosaic-legacy/da9d0015af0f09667998';
            let vigoIcon = '//lf1-cdn-tos.bytescm.com/obj/mosaic-legacy/504100070cbe0498d66f';
            let icon3 = '//lf1-cdn-tos.bytescm.com/eesz/resource/bear/public/doc-favicon-v4.902ddd709d8aaa55df8d.ico';
            return (
                <Nav
                    // isCollapsed={isCollapsed}
                    defaultOpenKeys={defaultOpenKeys}
                    style={{ height: navHeight, transform: `translateX(${translateX}%)` }}
                    mode={mode}
                    selectedKeys={selectedKeys}
                    openKeys={openKeys}
                    onSelect={this.onSelect}
                    onOpenChange={this.onOpenChange}
                >
                    <Nav.Header logo="doc-toast" text="互娱运营" />
                    <Nav.Item
                        itemKey={'1'}
                        text={<strong>火山运营</strong>}
                        icon={<img width="20" height="20" src={vigoIcon} />}
                    />
                    <Nav.Sub
                        itemKey={'2'}
                        text={<strong>抖音运营</strong>}
                        icon={<img width="20" height="20" src={testIcon} />}
                    >
                        {['2-1', '2-2'].map(k => (
                            <Nav.Item key={k} itemKey={String(k)} text={'Option ' + k} />
                        ))}
                        <Nav.Sub text={'Group 2-3'} icon={<img width="20" height="20" src={icon3} />} itemKey="2-3">
                            <Nav.Item itemKey={'2-3-1'} text={'Option 2-3-1'} />
                            <Nav.Item itemKey={'2-3-2'} text={'Option 2-3-2'} />
                        </Nav.Sub>
                    </Nav.Sub>
                </Nav>
            );
        };

        render() {
            let { isCollapsed, defaultOpenKeys, mode, navHeight, selectedKeys, openKeys } = this.state;

            let testIcon = '//lf1-cdn-tos.bytescm.com/obj/mosaic-legacy/da9d0015af0f09667998';
            let vigoIcon = '//lf1-cdn-tos.bytescm.com/obj/mosaic-legacy/504100070cbe0498d66f';
            let icon3 = '//lf1-cdn-tos.bytescm.com/eesz/resource/bear/public/doc-favicon-v4.902ddd709d8aaa55df8d.ico';

            return (
                <div style={{ position: 'relative' }}>
                    <SlideInOutLeft>
                        {isCollapsed
                            ? ({ transform, translateX }) => (
                                  <Nav
                                      // isCollapsed={isCollapsed}
                                      defaultOpenKeys={defaultOpenKeys}
                                      style={{ height: navHeight, transform: `translateX(${translateX}%)` }}
                                      mode={mode}
                                      selectedKeys={selectedKeys}
                                      openKeys={openKeys}
                                      onSelect={this.onSelect}
                                      onOpenChange={this.onOpenChange}
                                  >
                                      <Nav.Header logo="doc-toast" text="互娱运营" />
                                      <Nav.Item
                                          itemKey={'1'}
                                          text={<strong>火山运营</strong>}
                                          icon={<img width="20" height="20" src={vigoIcon} />}
                                      />
                                      <Nav.Sub
                                          itemKey={'2'}
                                          text={<strong>抖音运营</strong>}
                                          icon={<img width="20" height="20" src={testIcon} />}
                                      >
                                          {['2-1', '2-2'].map(k => (
                                              <Nav.Item key={k} itemKey={String(k)} text={'Option ' + k} />
                                          ))}
                                          <Nav.Sub
                                              text={'Group 2-3'}
                                              icon={<img width="20" height="20" src={icon3} />}
                                              itemKey="2-3"
                                          >
                                              <Nav.Item itemKey={'2-3-1'} text={'Option 2-3-1'} />
                                              <Nav.Item itemKey={'2-3-2'} text={'Option 2-3-2'} />
                                          </Nav.Sub>
                                      </Nav.Sub>
                                  </Nav>
                              )
                            : null}
                    </SlideInOutLeft>
                    <IconButton
                        style={{ position: 'absolute', left: 10, top: 10 }}
                        title="展开/收起切换"
                        iconType="list"
                        onClick={() => this.updateCollapsed(!isCollapsed)}
                    />
                </div>
            );
        }
    }

    return <NavApp />;
});

stories.add('queue transition', () => {
    const Demo = () => {
        const animStyle = { ...itemStyle, width: 100, marginBottom: 10 };
        const [state, setState] = useState('enter');
        const [position, setPosition] = useState('left');

        const onSwitchPosition = e => {
            setPosition(e.target.value);
        };

        const positionList = ['left', 'top', 'right', 'bottom'];

        return (
            <div style={{ padding: 100 }}>
                <QueueTransition state={state} position={position}>
                    <div style={{ ...animStyle }}>1</div>
                    <div style={{ ...animStyle }}>2</div>
                    <div style={{ ...animStyle }}>3</div>
                    <div style={{ ...animStyle }}>4</div>
                </QueueTransition>
                <div>
                    <div>
                        <p>方向</p>
                        <RadioGroup value={position} onChange={onSwitchPosition}>
                            {positionList.map(pos => (
                                <Radio value={pos} key={pos}>
                                    {pos}
                                </Radio>
                            ))}
                        </RadioGroup>
                    </div>
                    <div>
                        <Button onClick={() => setState('enter')}>入场</Button>
                        <Button onClick={() => setState('leave')}>离场</Button>
                    </div>
                </div>
            </div>
        );
    };

    return <Demo />;
});

stories.add('queue styled transition', () => {
    const Demo = () => {
        const animStyle = {
            backgroundColor: 'rgb(241, 101, 101)',
            color: 'white',
            borderRadius: 4,
            padding: 10,
            textAlign: 'center',
            width: 100,
            marginBottom: 10,
        };
        const [state, setState] = useState('enter');
        const [position, setPosition] = useState('Left');
        const switchState = state => {
            setState(undefined);
            setTimeout(() => setState(state));
        };

        const onSwitchPosition = e => {
            setPosition(e.target.value);
        };

        const positionList = ['Left', 'Up', 'Right', 'Down'];

        return (
            <div style={{ padding: 100, display: 'flex', flexDirection: 'row' }}>
                <div>
                    <QueueStyledTransition state={state} position={position}>
                        <div style={{ ...animStyle }}>1</div>
                        <div style={{ ...animStyle }}>2</div>
                        <div style={{ ...animStyle }}>3</div>
                        <div style={{ ...animStyle }}>4</div>
                    </QueueStyledTransition>
                </div>
                <div style={{ marginLeft: 20 }}>
                    <div style={{ display: 'flex' }}>
                        <label>方向：</label>
                        <RadioGroup value={position} onChange={onSwitchPosition}>
                            {positionList.map(pos => (
                                <Radio value={pos} key={pos}>
                                    {pos}
                                </Radio>
                            ))}
                        </RadioGroup>
                    </div>
                    <div>
                        <label>时机：</label>
                        <Button onClick={() => switchState('enter')}>入场</Button>
                        <Button onClick={() => switchState('leave')}>离场</Button>
                    </div>
                </div>
            </div>
        );
    };

    return <Demo />;
});
