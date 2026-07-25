// @douyinfe/semi-ui 的移动端替身：复用的 classic hooks 只用到 Toast 与
// Modal.confirm，这里用 antd-mobile 等价实现。刻意只导出这两个符号——
// 未来 classic 若引入其他 Semi 组件进入复用链路，移动端构建会显式失败，
// 而不是把整个 Semi 静默打进包里。
import { Toast as AmToast, Dialog } from 'antd-mobile';

const normalize = (opts) =>
  typeof opts === 'string' ? { content: opts } : opts || {};

// Semi 的 duration 单位是秒，antd-mobile 是毫秒
const toMs = (duration) =>
  typeof duration === 'number' ? duration * 1000 : 2000;

const show = (icon) => (opts) => {
  const o = normalize(opts);
  AmToast.show({
    icon,
    content: o.content,
    duration: toMs(o.duration),
  });
};

export const Toast = {
  success: show('success'),
  error: show('fail'),
  warning: show('fail'),
  info: show(undefined),
};

export const Modal = {
  confirm({ title, content, okText, cancelText, onOk, onCancel }) {
    Dialog.confirm({
      title,
      content,
      confirmText: okText || '确定',
      cancelText: cancelText || '取消',
    }).then((confirmed) => {
      if (confirmed) {
        onOk?.();
      } else {
        onCancel?.();
      }
    });
  },
};
