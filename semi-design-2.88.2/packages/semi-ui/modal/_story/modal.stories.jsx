import React, { useState } from 'react';
import en_GB from '../../locale/source/en_GB';

import { Select, Modal, Button, Tooltip, Popover, ConfigProvider, Tag, Space, DragMove } from '../../index';
import CollapsibleInModal from './CollapsibleInModal';
import DynamicContextDemo from './DynamicContext';

export default {
  title: 'Modal',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
}

export {
  CollapsibleInModal,
  DynamicContextDemo
}

const Option = Select.Option;

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
      <Modal
        title="对话框标题"
        visible={visible}
        onOk={handleOk}
        onCancel={handleCancel}
        {...props}
      >
        <input autoFocus />
        <p>basic modal</p>
        <Button onClick={handleCancel}>hide dialog</Button>
      </Modal>
    </React.Fragment>
  );
};

export const Default = () => <DialogComponent />;

Default.story = {
  name: 'default',
};

export const ClickMaskClosableFalse = () => <DialogComponent maskClosable={false} />;

ClickMaskClosableFalse.story = {
  name: 'click mask closable false',
};

function useLoading() {
  const [loading, setLoading] = useState(false);
  function startQuery() {
    setLoading(true);
  }
  return [loading, { startQuery }];
}

function DialogComponentWithLoading() {
  const [loading, actions] = useLoading();
  return <DialogComponent confirmLoading={loading} onOk={actions.startQuery} />;
}

export const WithLoadingTodo = () => <DialogComponentWithLoading />;

WithLoadingTodo.story = {
  name: 'with loading todo',
};

function success() {
  Modal.success('bla bla bla...');
}

function info() {
  Modal.info('info');
}

function error() {
  Modal.error({ title: 'Unfortunately, there is an error', content: 'bla bla bla...' });
}

function warning() {
  Modal.warning({ title: 'Warning: be cautious ahead', content: 'bla bla bla...' });
}

function confirm() {
  Modal.confirm({ title: 'Are you sure ?', content: 'bla bla bla...' });
}

export const ConfirmModal = () => (
  <div>
    <Button onClick={info}>Info</Button>
    <Button onClick={success}>Success</Button>
    <Button onClick={error}>Error</Button>
    <Button onClick={warning}>Warning</Button>
    <Button onClick={confirm}>Confirm</Button>
  </div>
);

ConfirmModal.story = {
  name: 'confirm modal',
};

const Test = () => {
  let modal;

  const showModal = () => {
    modal = Modal.info({
      title: '修改的标题',
      content: (
        <>
          <Button onClick={() => modal && modal.destroy()}>close</Button>
          <Button onClick={() => modal && modal.update({ title: 'lalala updating' })}>
            update
          </Button>
        </>
      ),
    });
  };

  return <Button onClick={() => showModal()}>Info</Button>;
};

export const ModalDestroy = () => <Test />;

ModalDestroy.story = {
  name: 'modal.destroy',
};

const ScrollComponent = props => {
  const [visible, setVisible] = useState(true);

  const handleOk = e => {
    setVisible(false);
  };

  const handleCancel = e => {
    setVisible(false);
  };

  return (
    <div style={{ paddingTop: 900, paddingBotttom: 800 }}>
      <Button onClick={() => setVisible(true)}>show dialog</Button>
      <Modal
        id="modal-test"
        title="对话框标题"
        visible={visible}
        onOk={handleOk}
        onCancel={handleCancel}
        {...props}
      >
        <Select>
          <Option value={1}>opt1</Option>
          <Option value={2}>opt2</Option>
          <Option value={3}>opt3</Option>
          <Option value={4}>opt4</Option>
          <Option value={5}>opt5</Option>
          <Option value={6}>opt6</Option>
        </Select>
        <Tooltip content="fefefefeef">test tooltip in modal</Tooltip>
        <Button onClick={handleCancel}>hide dialog</Button>
        <Popover content={'1,2,3'}>
          <Button>hover</Button>
        </Popover>
      </Modal>
      <Select>
        <Option value={1}>opt1</Option>
        <Option value={2}>opt2</Option>
        <Option value={3}>opt3</Option>
        <Option value={4}>opt4</Option>
        <Option value={5}>opt5</Option>
        <Option value={6}>opt6</Option>
      </Select>
    </div>
  );
};

export const Scroll = () => <ScrollComponent />;

Scroll.story = {
  name: 'scroll',
};

const Popup = () => {
  const [visible, setVisible] = useState(false);
  const getContainer = () => {
    return document.querySelector('.modal-container');
  };
  return (
    <div
      style={{
        height: 320,
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid var(--semi-color-border)',
        borderRadius: 2,
        padding: 24,
        textAlign: 'center',
        background: 'var(--semi-color-fill-0)',
      }}
      className="modal-container"
    >
      <span>Render in this</span>
      <br />
      <br />
      <Button onClick={() => setVisible(true)}>Open Modal</Button>
      <Modal
        title="渲染在指定容器内部"
        visible={visible}
        onCancel={() => setVisible(false)}
        width={200}
        // centered
        // style={{ top: '10px' }}
        getPopupContainer={getContainer}
      >
        <p>This is the content of a basic sidesheet.</p>
        <p>Here is more content...</p>
      </Modal>
    </div>
  );
};

export const RenderInCustomContainer = () => <Popup />;

RenderInCustomContainer.story = {
  name: 'render in custom container',
};

export const KeepDom = () => <DialogComponent keepDOM />;

KeepDom.story = {
  name: 'keepDOM',
};

export const KeepDomNotLazy = () => <DialogComponent keepDOM lazyRender={false} />;

KeepDomNotLazy.story = {
  name: 'keepDOM && not lazy',
};

export const UseModalDemo = () => {
  const [modal, contextHolder] = Modal.useModal();
  const config = { 'title': 'old title', 'content': 'old content' };

  return (
      <ConfigProvider locale={en_GB}>
          <div>
              <Button
                  onClick={() => {
                      const currentModal = modal.confirm(config);

                      setTimeout(() => {
                        currentModal.update({ title: "new title", content: "new content" });
                      }, 1000);
                  }}
              >
                  Confirm Modal
              </Button>
          </div>
          {contextHolder}
      </ConfigProvider>
  );
};
UseModalDemo.storyName = "useModal";

export const UseModalDestroy = () => {
  const [modal, contextHolder] = Modal.useModal();
  const config = { 'title': 'old title', 'content': 'old content' };

  return (
      <ConfigProvider locale={en_GB}>
          <div>
              <Button
                  onClick={() => {
                      const currentModal = modal.confirm(config);

                      setTimeout(() => {
                        currentModal.destroy();
                      }, 1000);
                  }}
              >
                  Confirm Modal
              </Button>
          </div>
          {contextHolder}
      </ConfigProvider>
  );
};
UseModalDestroy.storyName = "useModal destroy";

export const UseModalAfterClose = () => {
  const [modal, contextHolder] = Modal.useModal();
  const [closed, setClosed] = React.useState(false);
  const [leave, setLeave] = React.useState(false);

  const config = { 
    title: 'old title', 
    content: 'old content', 
    afterClose: () => {
      setClosed(true);
    },
    motion: {
      didLeave: () => {
        console.log('didLeave');
        setLeave(true);
      }
    }
  };

  return (
      <ConfigProvider locale={en_GB}>
          <Space>
              <Button
                  onClick={() => {
                      const currentModal = modal.confirm(config);

                      setTimeout(() => {
                        currentModal.destroy();
                      }, 0);
                  }}
              >
                  Confirm Modal
              </Button>
              <Tag>{`closed: ${closed}`}</Tag>
              {/* <Tag>{`motion leave: ${leave}`}</Tag> */}
          </Space>
          {contextHolder}
      </ConfigProvider>
  );
};
UseModalAfterClose.storyName = "useModal afterClose";

export const DraggableModal = () => {
    const [visible, setVisible] = useState(false);
    return (
        <div>
            <Button onClick={() => setVisible(true)}>Open Modal</Button>
            <Modal
                title="可拖拽Modal"
                visible={visible}
                onCancel={() => setVisible(false)}
                modalRender={(modal) => (
                    <DragMove>{modal}</DragMove>
                )}
            >
                <p>This is the content of a basic sidesheet.</p>
                <p>Here is more content...</p>
            </Modal>
        </div>
    );
};

DraggableModal.story = {
    name: 'draggable modal',
};

export const FullScreen = () => {
   const [visible, setVisible] = useState(false);
    return (
        <div>
            <Button onClick={() => setVisible(true)}>Open Modal</Button>
            <Modal
                title="可拖拽Modal"
                visible={visible}
                fullScreen
                // motion 为 false 是为了保证 e2e 取高度值的时候，拿到的不是动画中的值
                motion={false}
                onCancel={() => setVisible(false)}
            >
                <p>This is the content of a basic sidesheet.</p>
                <p>Here is more content...</p>
            </Modal>
        </div>
    );
}

export const SetHeight = () => {
  const [visible, setVisible] = useState(false);
  return (
      <div>
          <Button onClick={() => setVisible(true)}>Open Modal</Button>
          <Modal
              title="高度设置的Modal"
              visible={visible}
              height={300}
              // motion 为 false 是为了保证 e2e 取高度值的时候，拿到的不是动画中的值
              motion={false}
              onCancel={() => setVisible(false)}
          >
              <p>This is the content of a basic sidesheet.</p>
              <p>Here is more content...</p>
          </Modal>
      </div>
  );
}

export const SetHeightInStyle = () => {
  const [visible, setVisible] = useState(false);
  return (
      <div>
          <Button onClick={() => setVisible(true)}>Open Modal</Button>
          <Modal
              title="style中设置高度的Modal"
              visible={visible}
              style={{ height: 300 }}
              // motion 为 false 是为了保证 e2e 取高度值的时候，拿到的不是动画中的值
              motion={false}
              onCancel={() => setVisible(false)}
          >
              <p>This is the content of a basic sidesheet.</p>
              <p>Here is more content...</p>
          </Modal>
      </div>
  );
}

export const PromiseOK = () => {
  const [visible, setVisible] = useState(false);
  return (
      <div>
          <Button onClick={() => setVisible(true)}>Open Modal</Button>
          <Modal
              title="Modal: onOk 为 promise"
              visible={visible}
              style={{ height: 300 }}
              motion={false}
              onOk = {() => {
                return new Promise((resolve, reject) => {
                  setTimeout(() => {
                    resolve();
                  }, 3000)
                });
              }}
              onCancel={() => setVisible(false)}
          >
              <p>This is the content of a basic sidesheet.</p>
              <p>Here is more content...</p>
          </Modal>
      </div>
  );
}