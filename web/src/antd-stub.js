/**
 * antd 空 stub — @lobehub/icons v2 和 antd-style 依赖 antd，
 * 但本项目使用 Semi Design，不需要真正的 antd。
 * 此文件为所有被引用的 antd 导出提供 noop 实现。
 */

/* eslint-disable no-unused-vars */
const noop = () => null;
const NoopComponent = (props) => props?.children ?? null;
NoopComponent.useForm = () => [{}];
NoopComponent.Item = noop;
NoopComponent.List = noop;
NoopComponent.ErrorList = noop;
NoopComponent.Provider = NoopComponent;

const theme = {
  useToken: () => ({ token: {}, hashId: '', theme: {} }),
  defaultAlgorithm: {},
  darkAlgorithm: {},
  compactAlgorithm: {},
  getDesignToken: () => ({}),
  defaultSeed: {},
};

const message = { info: noop, success: noop, error: noop, warning: noop, loading: noop, open: noop, destroy: noop };
const notification = { info: noop, success: noop, error: noop, warning: noop, open: noop, destroy: noop };
const version = '0.0.0';

const Grid = { useBreakpoint: () => ({}) };

export {
  theme,
  message,
  notification,
  version,
  Grid,
};

// 所有组件导出为 noop
export const Alert = noop;
export const Anchor = noop;
export const App = NoopComponent;
export const AutoComplete = noop;
export const Avatar = noop;
export const Button = noop;
export const Collapse = noop;
export const ColorPicker = noop;
export const ConfigProvider = NoopComponent;
export const DatePicker = noop;
export const Divider = noop;
export const Drawer = noop;
export const Dropdown = noop;
export const Empty = noop;
export const Form = NoopComponent;
export const Image = noop;
export const Input = noop;
export const InputNumber = noop;
export const Menu = noop;
export const Modal = Object.assign(noop, { info: noop, success: noop, error: noop, warning: noop, confirm: noop });
export const Popover = noop;
export const Segmented = noop;
export const Select = noop;
export const Skeleton = noop;
export const Slider = noop;
export const Space = noop;
export const Tabs = noop;
export const Tag = noop;
export const Tooltip = noop;
export const Typography = { Text: noop, Title: noop, Paragraph: noop, Link: noop };
export const Upload = noop;

export default {
  theme,
  message,
  notification,
  version,
  Grid,
  Alert, Anchor, App, AutoComplete, Avatar, Button, Collapse, ColorPicker,
  ConfigProvider, DatePicker, Divider, Drawer, Dropdown, Empty, Form, Image,
  Input, InputNumber, Menu, Modal, Popover, Segmented, Select, Skeleton,
  Slider, Space, Tabs, Tag, Tooltip, Typography, Upload,
};
