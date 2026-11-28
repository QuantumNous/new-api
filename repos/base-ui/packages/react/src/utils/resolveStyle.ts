/**
 * If the provided style is an object, it will be returned as is.
 * Otherwise, the function will call the style function with the state as the first argument.
 *
 * @param style
 * @param state
 */
export function resolveStyle<State>(
  style: React.CSSProperties | ((state: State) => React.CSSProperties | undefined) | undefined,
  state: State,
) {
  return typeof style === 'function' ? style(state) : style;
}
