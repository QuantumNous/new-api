import React from 'react';
import { Toast, ToastFactory } from '../../index';

import Button from '@douyinfe/semi-ui/button/index';

export default {
  title: 'Toast',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
}

const ToastInContainer = ToastFactory.create({
  getPopupContainer: () => document.getElementById('popup-container'),
});


function getContent() {
  let n = Math.random() * 10;
  return Array.from({ length: n }, (v, i) => 'dance').join(' ');
}

let opts = {
  title: 'Title ies',
  content: 'Hi,Bytedance dance dance',
  duration: 3000,
};

let multiOpts = Object.assign({}, opts, {
  content: 'Hi,Bytedance dance dance, dance dance,dance dance,dance dance',
});

export const _Toast = () => (
  <>
    <div style={{ margin: '10px' }}>
      <Button type="primary" onClick={() => Toast.create({ ...opts })}>
        default
      </Button>
    </div>
    <div style={{ margin: '10px' }}>
      <Button type="warning" onClick={() => Toast.warning({ ...opts })}>
        warning
      </Button>
    </div>
    <div style={{ margin: '10px' }}>
      <Button type="warning" onClick={() => Toast.success('here')}>
        success
      </Button>
    </div>
    <div style={{ margin: '10px' }}>
      <Button type="warning" onClick={() => Toast.error({ ...opts })}>
        error
      </Button>
    </div>
    <div style={{ margin: '10px' }}>
      <Button type="default" onClick={() => Toast.info({ ...opts, duration: 0 })}>
        not auto close
      </Button>
    </div>
    <div style={{ margin: '10px' }}>
      <Button type="default" onClick={() => Toast.destroyAll()}>
        destroyAll
      </Button>
    </div>
    <div style={{ margin: '10px' }}>
      <Button type="default" onClick={() => Toast.info({ ...multiOpts, duration: 0 })}>
        not auto close with muti-line content
      </Button>
    </div>
    <div style={{ margin: '10px' }}>
      <Button
        type="danger"
        onClick={() => {
          Toast.error({ ...opts, content: 'i am content' });
        }}
      >
        After 3s
      </Button>
    </div>
    <div style={{ margin: '10px' }}>
      <Button onClick={() => {
        const id = 'toastid'
        Toast.error({ id, content: 'error' })
        setTimeout(() => Toast.info({ id, content: 'info' }), 2000)
        setTimeout(() => Toast.success({ id, content: 'success' }), 4000)
        setTimeout(() => Toast.info({ id, content: 'duration 3 -> 0', duration: 0 }), 6000)
      }}>
        update content by id
      </Button>
    </div>
    <div style={{ width: '300px', height: '300px', background: '#cccccc' }} id="popup-container">
      popup-container
    </div>
    <div>
      <Button
        type="primary"
        onClick={() => {
          ToastInContainer.info({ content: 'Toast in popup-container' });
        }}
      >
        Toast in popup-container
      </Button>
    </div>
    <div style={{ margin: '10px' }}>
      <Button
        type="primary"
        onClick={() => {
          Toast.error({ ...opts, content: 'I have a very long word testLongWordLongWordLongWordLongWordLongWordLongWordLongWordLongWordLongWordLongWordLongWordLongWord' });
        }}
      >
        test overflow wrap
      </Button>
    </div>
  </>
);

_Toast.story = {
  name: 'toast',
};

const ReachableContext = React.createContext();

/**
 * test with cypress
 * @returns
 */
export const useToastDemo = () => {
  const [toast, contextHolder] = Toast.useToast();
  const config = {
      duration: 0,
      title: 'This is a success message',
      content: <ReachableContext.Consumer>{name => `ReachableContext: ${name}`}</ReachableContext.Consumer>,
  };

  return (
      <ReachableContext.Provider value="Light">
          <div>
              <Button
                onClick={() => {
                    toast.success(config);
                    toast.info(config);
                    toast.error(config);
                    toast.warning(config);
                    const id = toast.open(config);

                    setTimeout(() => {
                      toast.close(id);
                    }, 100);
                }}
              >
                  Hook Toast
              </Button>
          </div>
          <div data-cy="context-holder">
            {contextHolder}
          </div>
      </ReachableContext.Provider>
  );
};
useToastDemo.storyName = "useToast";
