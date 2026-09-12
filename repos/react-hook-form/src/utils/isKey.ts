const IS_KEY_RE = /^\w*$/;

export default (value: string) => IS_KEY_RE.test(value);
