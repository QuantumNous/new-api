export type StateAttributesMapping<State> = {
  [Property in keyof State]?: (state: State[Property]) => Record<string, string> | null;
};

export function getStateAttributesProps<State extends Record<string, any>>(
  state: State,
  customMapping?: StateAttributesMapping<State>,
) {
  const props: Record<string, string> = {};

  /* eslint-disable-next-line guard-for-in */
  for (const key in state) {
    const value = state[key];

    if (customMapping?.hasOwnProperty(key)) {
      const customProps = customMapping[key]!(value);
      if (customProps != null) {
        Object.assign(props, customProps);
      }

      continue;
    }

    if (value === true) {
      props[`data-${key.toLowerCase()}`] = '';
    } else if (value) {
      props[`data-${key.toLowerCase()}`] = value.toString();
    }
  }

  return props;
}
