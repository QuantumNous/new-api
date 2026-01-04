import React, { useState, useLayoutEffect, useRef } from 'react';
import { Select, Button, Modal, Toast, ConfigProvider, Notification } from '@douyinfe/semi-ui';
import en_GB from '@douyinfe/semi-ui/locale/source/en_GB';
import { createPortal } from "react-dom";

const Option = Select.Option;
let ind = 0;
const ReachableContext = React.createContext();

const useCreatePortalInBody = () => {
    const wrapperRef = useRef(null);
    if (wrapperRef.current === null && typeof document !== 'undefined') {
        const div = document.createElement('div');
        div.setAttribute('data-body-portal', '');
        wrapperRef.current = div;
    }
    useLayoutEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper || typeof document === 'undefined') {
            return;
        }
        document.querySelector('.test').appendChild(wrapper);
        return () => {
            document.querySelector('.test').appendChild(wrapper);
        };
    }, []);
    return (children => wrapperRef.current && createPortal(children, wrapperRef.current));
};

const DialogComponent = props => {
    const [visible, setVisible] = useState(false);

    const handleOk = e => {
        setVisible(false);
    };

    const handleCancel = e => {
        setVisible(false);
    };

    return (
        <React.Fragment>
            <Button onClick={() => setVisible(true)}>show dialog</Button>
            <Modal title="对话框标题" visible={visible} onOk={handleOk} onCancel={handleCancel} {...props}>
                <Button onClick={handleCancel}>hide dialog</Button>
            </Modal>
        </React.Fragment>
    );
};

const UseModalDemo = () => {
    const [modal, contextHolder] = Modal.useModal();
    const config = { 'title': 'This is a success message', 'content': `${ind}` };
    return (
        <ConfigProvider
            getPopupContainer={() => document.getElementById("modal-container")}
            locale={en_GB}

        >
            <div id="modal-container" />
            <Button
                onClick={() => {
                    modal.confirm(config);
                }}
            >
                Confirm
            </Button>
            <Button
                onClick={() => {
                    modal.warning(config);
                }}
            >
                Warning
            </Button>
            <Button
                onClick={() => {
                    modal.info(config);
                }}
            >
                Info
            </Button>
            <Button
                onClick={() => {
                    modal.error(config);
                }}
            >
                Error
            </Button>
            {/* `contextHolder` should always under the context you want to access */}
            {contextHolder}
        </ConfigProvider>
    );
};

const UseNotiDemo = () => {
    const [noti, holder] = Notification.useNotification();
    const config = { 'title': 'This is a success message', position: 'bottomLeft', 'content': `${ind}` };
    return (
        <div>
            <div id="noti-container" >{holder}</div>
            <Button
                onClick={() => {
                    let id = noti.success(config);
                    ind++;
                    setTimeout(() => {
                        console.log('closing');
                        noti.close(id);
                    }, 3000);
                }}
            >
                useNotification demo - left
            </Button>
            <Button
                onClick={() => {
                    let id = noti.error({ ...config, position: 'topRight' });
                    ind++;
                }}
            >
                useNotification demo - topRight
            </Button>
        </div>
    );
};

const UseToastDemo = () => {
    const [toast, holder] = Toast.useToast();
    const createBodyPortal = useCreatePortalInBody();

    const config = { 'content': <ReachableContext.Consumer>{name => `ReachableContext: ${name}-${ind}`}</ReachableContext.Consumer>, duration: 0 };
    return (
        <ReachableContext.Provider value="Light">
            <div>
                {/* <div id="noti-container" >{holder}</div> */}
                <Button
                    onClick={() => {
                        let id = toast.success(config);
                        ind++;
                        setTimeout(() => {
                            console.log('closing');
                            toast.close(id);
                        }, 3000);
                    }}
                >
                    useToast demo
                </Button>
                {createBodyPortal(
                    <div>
                        {holder}
                    </div>
                )}
            </div>
        </ReachableContext.Provider>
    );
};



export default () => (
    <ConfigProvider getPopupContainer={() => document.querySelector('.test')} locale={en_GB}>
        <div className="test">
            <Select defaultValue='dy' style={{ width: 120 }}>
                <Option value='dy'>抖音</Option>
                <Option value='hotsoon'>火山</Option>
                <Option value='pipixia' disabled>皮皮虾</Option>
                <Option value='xigua'>西瓜视频</Option>
            </Select>
            <Button
                onClick={() => Toast.info({
                    content: 'Hi, Bytedance dance dance',
                    duration: 3,
                })}
            >
                Display Toast
            </Button>
            <DialogComponent />
            <UseModalDemo />
            <Button
                type='primary'
                onClick={() => api.success({
                    title: 'Hi, Bytedance',
                    content: 'ies dance dance dance',
                    duration: 0,
                })}
                style={{ margin: 4 }}
            >
                Success
            </Button>
            <br />
            <UseNotiDemo />
            <br />
            <UseToastDemo />
        </div>
    </ConfigProvider>
);
