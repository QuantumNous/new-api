/* argus-disable unPkgSensitiveInfo */
import React, { useState } from 'react';
import { Button, UserGuide, Toast, Tag, Switch, Space } from '@douyinfe/semi-ui/index';

export default {
    title: 'UserGuide',
};

export const BasicUsage = () => {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <div style={{ marginTop: '20px' }}>
                <Button onClick={() => setVisible(true)}>显示引导</Button>
            </div>
            <br />
            <Space spacing='medium'>
                <Switch id={'step-1'} defaultChecked={true}/>     
                <Button id={'step-2'} type="secondary" onClick={() => {
                    console.log('次要')
                }}>次要</Button>
                <Button id={'step-3'} type="tertiary">第三</Button>
                <Button id={'step-4'} type="warning">警告</Button>
            </Space>
            <UserGuide
                mode="popup"
                mask={true}
                steps={[
                    {
                        target: document.querySelector('#step-1'),
                        cover: (
                            <img 
                                alt="example" 
                                height={200}
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                            />
                        ),
                        title: "这里是标题1",
                        description: "一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "bottom"
                    },
                    {
                        target: document.querySelector('#step-2'),
                        cover: (
                            <img 
                                alt="example"
                                height={200} 
                                width={'100%'}
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                            />
                        ),
                        title: "这里是标题2",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "right"
                    },
                    {
                        target: document.querySelector('#step-3'),
                        title: "这里是标题3",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "bottom"
                    },
                    {
                        target: document.querySelector('#step-4'),
                        title: "这里是标题4",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "right"
                    }
                ]}
                visible={visible}
                onFinish={() => {
                    setVisible(false);
                    console.log('引导完成')
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('引导跳过')
                }}
        />
        </div>
    );
};

export const PrimaryTheme = () => {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <Space spacing='medium'>
                <Switch id={'step-1'} defaultChecked={true}/>     
                <Button id={'step-2'} type="secondary">次要</Button>
                <Button id={'step-3'} type="tertiary">第三</Button>
                <Button id={'step-4'} type="warning">警告</Button>
            </Space>
            <div style={{ marginTop: '20px' }}>
                <Button onClick={() => setVisible(true)}>显示引导</Button>
            </div>
            <UserGuide
                mode="popup"
                theme="primary"
                mask={true}
                steps={[
                    {
                        target: document.querySelector('#step-1'),
                        cover: (
                            <img 
                                alt="example" 
                                height={200}
                                width={'100%'}
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                            />
                        ),
                        title: "这里是标题1",
                        description: "一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "bottom"
                    },
                    {
                        target: document.querySelector('#step-2'),
                        cover: (
                            <img 
                                alt="example" 
                                height={200}
                                width={'100%'}
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                            />
                        ),
                        title: "这里是标题2",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "right"
                    },
                    {
                        target: document.querySelector('#step-3'),
                        title: "这里是标题3",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "bottom"
                    },
                    {
                        target: document.querySelector('#step-4'),
                        title: "这里是标题4",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "right"
                    }
                ]}
                visible={visible}
                onFinish={() => {
                    setVisible(false);
                    console.log('引导完成')
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('引导跳过')
                }}
        />
        </div>
    );
};

export const HideButtons = () => {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <Space spacing='medium'>
                <Switch id={'step-1'} defaultChecked={true}/>     
                <Button id={'step-2'} type="secondary">次要</Button>
                <Button id={'step-3'} type="tertiary">第三</Button>
                <Button id={'step-4'} type="warning">警告</Button>
            </Space>
            <div style={{ marginTop: '20px' }}>
                <Button onClick={() => setVisible(true)}>显示引导</Button>
            </div>
            <UserGuide
                mode="popup"
                mask={true}
                showPrevButton={false}
                showSkipButton={false}
                steps={[
                    {
                        target: document.querySelector('#step-1'),
                        cover: (
                            <img 
                                alt="example"
                                height={200}
                                width={'100%'} 
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                            />
                        ),
                        title: "这里是标题1",
                        description: "一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "bottom"
                    },
                    {
                        target: document.querySelector('#step-2'),
                        cover: (
                            <img 
                                alt="example" 
                                height={200}
                                width={'100%'}
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                            />
                        ),
                        title: "这里是标题2",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "right"
                    },
                    {
                        target: document.querySelector('#step-3'),
                        title: "这里是标题3",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "bottom"
                    },
                    {
                        target: document.querySelector('#step-4'),
                        title: "这里是标题4",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "right"
                    }
                ]}
                visible={visible}
                onFinish={() => {
                    setVisible(false);
                    console.log('引导完成')
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('引导跳过')
                }}
        />
        </div>
    );
};

export const NoMask = () => {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <Space spacing='medium'>
                <Switch id={'step-1'} defaultChecked={true}/>     
                <Button id={'step-2'} type="secondary">次要</Button>
                <Button id={'step-3'} type="tertiary">第三</Button>
                <Button id={'step-4'} type="warning">警告</Button>
            </Space>
            <div style={{ marginTop: '20px' }}>
                <Button onClick={() => setVisible(true)}>显示引导</Button>
            </div>
            <UserGuide
                mode="popup"
                theme="primary"
                mask={false}
                steps={[
                    {
                        target: document.querySelector('#step-1'),
                        cover: (
                            <img 
                                alt="example" 
                                height={200}
                                width={'100%'}
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                            />
                        ),
                        title: "这里是标题1",
                        description: "一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "bottom"
                    },
                    {
                        target: document.querySelector('#step-2'),
                        cover: (
                            <img 
                                alt="example" 
                                height={200}
                                width={'100%'}
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                            />
                        ),
                        title: "这里是标题2",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "right"
                    },
                    {
                        target: document.querySelector('#step-3'),
                        title: "这里是标题3",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "bottom"
                    },
                    {
                        target: document.querySelector('#step-4'),
                        title: "这里是标题4",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "right"
                    }
                ]}
                visible={visible}
                onFinish={() => {
                    setVisible(false);
                    console.log('引导完成')
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('引导跳过')
                }}
        />
        </div>
    );
};

export const ControlledDemo = () => {
    const [visible, setVisible] = useState(false);
    const [current, setCurrent] = useState(1);

    return (
        <div>
            <Space spacing='medium'>
                <Switch id={'step-1'} defaultChecked={true}/>     
                <Button id={'step-2'} type="secondary">次要</Button>
                <Button id={'step-3'} type="tertiary">第三</Button>
                <Button id={'step-4'} type="warning">警告</Button>
            </Space>
            <div style={{ marginTop: '20px' }}>
                <Button onClick={() => setVisible(true)}>显示引导</Button>
            </div>
            <UserGuide
                mode="popup"
                theme="primary"
                current={current}
                steps={[
                    {
                        target: document.querySelector('#step-1'),
                        cover: (
                            <img 
                                alt="example" 
                                height={200}
                                width={'100%'}
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                            />
                        ),
                        title: "这里是标题1",
                        description: "一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "bottom"
                    },
                    {
                        target: document.querySelector('#step-2'),
                        cover: (
                            <img 
                                alt="example" 
                                height={200}
                                width={'100%'}
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                            />
                        ),
                        title: "这里是标题2",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "right"
                    },
                    {
                        target: document.querySelector('#step-3'),
                        title: "这里是标题3",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "bottom"
                    },
                    {
                        target: document.querySelector('#step-4'),
                        title: "这里是标题4",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "right"
                    }
                ]}
                visible={visible}
                onPrev={(current) => {
                    console.log('onPrev', current)
                    setCurrent(current - 1);
                }}
                onNext={(current) => {
                    console.log('onNext', current)
                    setCurrent(current + 1);
                }}
                onFinish={(current) => {
                    console.log('onFinish', current)
                    setVisible(false);
                    setCurrent(0);
                    console.log('引导完成')
                }}
                onSkip={(current) => {
                    console.log('onSkip', current)
                    setVisible(false);
                    setCurrent(0);
                    console.log('引导跳过')
                }}
                onChange={(current) => {
                    console.log('onChange', current)
                    console.log('changel', current)
                }}
        />
        </div>
    );
};

export const ModalMode = () => {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <Space spacing='medium'>
                <Switch id={'step-1'} defaultChecked={true}/>     
                <Button id={'step-2'} type="secondary">次要</Button>
                <Button id={'step-3'} type="tertiary">第三</Button>
                <Button id={'step-4'} type="warning">警告</Button>
            </Space>
            <div style={{ marginTop: '20px' }}>
                <Button onClick={() => setVisible(true)}>显示引导</Button>
            </div>
            <UserGuide
                mode="modal"
                mask={true}
                steps={[
                    {
                        cover: (
                            <img 
                                alt="example" 
                                height={'100%'}
                                width={'100%'}
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
                            />
                        ),
                        title: "这里是标题1",
                        description: "一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                    },
                    {
                        cover: (
                            <img 
                                alt="example"
                                height={'100%'} 
                                width={'100%'}
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo2.jpeg" 
                            />
                        ),
                        title: "这里是标题2",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                    },
                    {
                        cover: (
                            <img 
                                alt="example"
                                height={'100%'} 
                                width={'100%'}
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo2.jpeg" 
                            />
                        ),
                        title: "这里是标题3",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                    },
                    {
                        cover: (
                            <img 
                                alt="example"
                                height={'100%'} 
                                width={'100%'}
                                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo2.jpeg" 
                            />
                        ),
                        title: "这里是标题4",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                    }
                ]}
                visible={visible}
                onFinish={() => {
                    setVisible(false);
                    console.log('引导完成')
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('引导跳过')
                }}
        />
        </div>
    );
};

export const CustomButton = () => {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <Space spacing='medium'>
                <Switch id={'step-1'} defaultChecked={true}/>     
                <Button id={'step-2'} type="secondary">次要</Button>
                <Button id={'step-3'} type="tertiary">第三</Button>
                <Button id={'step-4'} type="warning">警告</Button>
            </Space>
            <div style={{ marginTop: '20px' }}>
                <Button onClick={() => setVisible(true)}>显示引导</Button>
            </div>
            <UserGuide
                mode="popup"
                mask={true}
                finishText='开始使用'
                prevButtonProps={{ theme: 'outline', type: 'primary' }}
                steps={[
                    {
                        target: document.querySelector('#step-1'),
                        title: "这里是标题1",
                        description: "一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "bottom"
                    },
                    {
                        target: document.querySelector('#step-2'),
                        title: "这里是标题2",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "right"
                    },
                ]}
                visible={visible}
                onFinish={() => {
                    setVisible(false);
                    console.log('引导完成')
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('引导跳过')
                }}
        />
        </div>
    );
}

export const MixedTheme = () => {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <Space spacing='medium'>
                <Switch id={'step-1'} defaultChecked={true}/>     
                <Button id={'step-2'} type="secondary">次要</Button>
                <Button id={'step-3'} type="tertiary">第三</Button>
                <Button id={'step-4'} type="warning">警告</Button>
            </Space>
            <div style={{ marginTop: '20px' }}>
                <Button onClick={() => setVisible(true)}>显示引导</Button>
            </div>
            <UserGuide
                mode="popup"
                mask={true}
                steps={[
                    {
                        target: document.querySelector('#step-1'),
                        theme: 'primary',
                        title: "这里是标题1",
                        description: "一些描述文案",
                        position: "bottom"
                    },
                    {
                        target: document.querySelector('#step-2'),
                        title: "这里是标题2",
                        description: "这是第二步的说明一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案一些描述文案",
                        position: "right"
                    },
                ]}
                visible={visible}
                onFinish={() => {
                    setVisible(false);
                    console.log('引导完成')
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('引导跳过')
                }}
        />
        </div>
    );
}

export const OneStep = () => {
    const [visible, setVisible] = useState(false);

    return (
        <div>
            <Space spacing='medium'>
                <Switch id={'step-1'} defaultChecked={true}/>     
                <Button id={'step-2'} type="secondary">次要</Button>
                <Button id={'step-3'} type="tertiary">第三</Button>
                <Button id={'step-4'} type="warning">警告</Button>
            </Space>
            <div style={{ marginTop: '20px' }}>
                <Button onClick={() => setVisible(true)}>显示引导</Button>
            </div>
            <UserGuide
                mode="popup"
                mask={true}
                steps={[
                    {
                        target: document.querySelector('#step-1'),
                        theme: 'primary',
                        title: "这里是标题",
                        description: "一些描述文案",
                        position: "bottom"
                    }
                ]}
                visible={visible}
                onFinish={() => {
                    setVisible(false);
                    console.log('引导完成')
                }}
                onSkip={() => {
                    setVisible(false);
                    console.log('引导跳过')
                }}
            />
        </div>
    )
}