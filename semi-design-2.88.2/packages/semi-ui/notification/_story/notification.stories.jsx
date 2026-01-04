import React from 'react';

import { IconWifi, IconToutiaoLogo } from '@douyinfe/semi-icons';
import Notification from '../index';
import Button from '@douyinfe/semi-ui/button/index';
import UseNotificationDemo from './useNotification';

export default {
  title: 'Notification',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
}


let noticeIds = [];
const fnc = () => {
  let id = Notification.info({ content: '0', duration: 0 });
  noticeIds.push(id);
};

const remove = () => {
  let id = noticeIds[0];
  console.log(noticeIds);
  Notification.close(id);
  noticeIds = noticeIds.filter(key => id !== key);
};

let pos = ['topRight', 'topLeft', 'bottomRight', 'bottomLeft'];
let opts = {
  title: 'Title ies',
  content:
    'Hi,Bytedance dance dance dance dance dance dance dance dance dance dance dance dance dance dance dance',
  duration: 3,
};

function randomPos() {
  return pos[Math.floor(Math.random() * pos.length)];
}

export const _Notification = () => (
  <div>
    <Button
      type="primary"
      onClick={() =>
        Notification.info({ ...opts, content: '我三秒后会被关闭', position: randomPos() })
      }
    >
      After 3s
    </Button>
    <Button
      type="primary"
      onClick={() => Notification.open({ ...opts, duration: 2, position: 'topRight' })}
    >
      After 2s
    </Button>
  </div>
);

_Notification.story = {
  name: 'notification',
};

export const ManaulOpenClose = () => (
  <div>
    <Button type="primary" onClick={fnc}>
      Duration：0
    </Button>
    <Button type="primary" onClick={remove}>
      remove duration:
    </Button>
  </div>
);

ManaulOpenClose.story = {
  name: 'manaul open & close',
};

export const Position = () => {
  let opts = {
    duration: 0,
    position: 'topRight',
    content: 'semi-ui-notification',
    title: 'Hi bytedance',
  };
  return (
    <>
      <Button onClick={() => Notification.info({ ...opts, position: 'top' })}>top</Button>
      <Button onClick={() => Notification.info({ ...opts, position: 'topLeft' })}>topLeft</Button>
      <Button onClick={() => Notification.info(opts)}>topRight</Button>
      <Button onClick={() => Notification.info({ ...opts, position: 'bottom' })}>bottom</Button>
      <Button onClick={() => Notification.info({ ...opts, position: 'bottomRight' })}>
        bottomRight
      </Button>
      <Button onClick={() => Notification.info({ ...opts, position: 'bottomLeft' })}>
        bottomLeft
      </Button>
    </>
  );
};

export const CustomIcon = () => {
  let opts = {
    duration: 0,
    position: 'topRight',
    content: 'semi-ui-notification',
    title: 'Hi bytedance',
  };
  return (
    <>
      <Button onClick={() => Notification.info({ ...opts, position: 'top' })}>info</Button>
      <Button onClick={() => Notification.warning({ ...opts, position: 'top' })}>warning</Button>
      <Button
        onClick={() =>
          Notification.info({
            ...opts,
            position: 'top',
            icon: <IconWifi style={{ color: 'green' }} />,
          })
        }
      >
        wifi
      </Button>
      <Button
        onClick={() =>
          Notification.info({
            ...opts,
            position: 'bottomLeft',
            icon: <IconToutiaoLogo style={{ color: 'red' }} />,
          })
        }
      >
        toutiao
      </Button>
    </>
  );
};

export const EventDemo = () => {
  let opts = {
    duration: 0,
    position: 'topRight',
    content: 'semi-ui-notification',
    title: 'Hi bytedance',
    onClick: e => console.log('clicking'),
    onClose: e => console.log('closing da da da...'),
    onCloseClick: e => console.log('you closed me'),
  };
  return (
    <>
      <Button onClick={() => Notification.info({ ...opts, position: 'top' })}>info</Button>
      <Button onClick={() => Notification.warning({ ...opts, position: 'top' })}>warning</Button>
      <Button
        onClick={() =>
          Notification.info({
            ...opts,
            position: 'top',
            icon: <IconWifi style={{ color: 'green' }} />,
          })
        }
      >
        wifi
      </Button>
      <Button
        onClick={() =>
          Notification.info({
            ...opts,
            position: 'bottomLeft',
            icon: <IconToutiaoLogo style={{ color: 'red' }} />,
          })
        }
      >
        toutiao
      </Button>
    </>
  );
};

class Demo extends React.Component {
  constructor() {
    super();
    this.state = { test: 0 };
    this.onClick = this.onClick.bind(this);
  }

  componentDidMount() {
    this.onClick();
  }

  onClick() {
    this.setState(
      {
        test: 1,
      },
      () => {
        this.setState(
          {
            test: 2,
          },
          () => {
            this.id = Notification.success({
              title: 'success',
              duration: 3,
            });
          }
        );
      }
    );
  }

  render() {
    return <Button>test</Button>;
  }
}

export const _UseNotificationDemo = () => <UseNotificationDemo />;

_UseNotificationDemo.story = {
  name: 'useNotification demo',
};

export const AsyncCallback = () => <Demo />;
AsyncCallback.story = {
  name: '二次异步回调'
}

export const TestOverFlow = () => {
  let opts = {
      title: 'Test long word Title, TestLongWordTestLongWordTestLongWordTestLongWordTestLongWord',
      content: 'Test long word Title, TestLongWordTestLongWordTestLongWordTestLongWordTestLongWord',
      duration: 0,
      theme: 'light',
      style: { width: 320 }
  };
  return (
    <Button onClick={() => Notification.info(opts)}>Info</Button>
  )
}
