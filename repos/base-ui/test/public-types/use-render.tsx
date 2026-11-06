import * as React from 'react';
import { useRender } from '@base-ui/react/use-render';

export type UseRenderRenderProp<State = Record<string, unknown>> = useRender.RenderProp<State>;
export type UseRenderElementProps<ElementType extends React.ElementType> =
  useRender.ElementProps<ElementType>;
export type UseRenderComponentProps<
  ElementType extends React.ElementType,
  State = {},
  RenderFunctionProps = Record<string, unknown>,
> = useRender.ComponentProps<ElementType, State, RenderFunctionProps>;
export type UseRenderParameters<
  State,
  RenderedElementType extends Element,
  Enabled extends boolean | undefined,
> = useRender.Parameters<State, RenderedElementType, Enabled>;
export type UseRenderReturnValue<Enabled extends boolean | undefined> =
  useRender.ReturnValue<Enabled>;

export interface UseRenderHarnessProps {
  state: { expanded: boolean };
  enabled?: boolean;
  render?: useRender.RenderProp<{ expanded: boolean }>;
}

export function UseRenderHarness({ state, enabled = true, render }: UseRenderHarnessProps) {
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const element = useRender({
    defaultTagName: 'button',
    state,
    enabled,
    render:
      render ??
      ((props, currentState) => (
        <button type="button" {...props} data-expanded={currentState?.expanded ? '' : undefined} />
      )),
    props: {
      type: 'button',
      'aria-expanded': state.expanded,
    },
    ref: buttonRef,
  });

  return element;
}

export function DisabledUseRenderExample() {
  const hiddenElement = useRender<{ expanded: boolean }, HTMLDivElement, false>({
    enabled: false,
    defaultTagName: 'div',
  });

  React.useEffect(() => {
    void hiddenElement;
  }, [hiddenElement]);

  return null;
}
