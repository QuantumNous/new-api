import * as React from 'react';
import { useMergedRefs, useMergedRefsN } from '@base-ui/utils/useMergedRefs';
import { getReactElementRef } from '@base-ui/utils/getReactElementRef';
import { mergeObjects } from '@base-ui/utils/mergeObjects';
import { warn } from '@base-ui/utils/warn';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import type { BaseUIComponentProps, ComponentRenderFn, HTMLProps } from './types';
import { getStateAttributesProps, StateAttributesMapping } from './getStateAttributesProps';
import { resolveClassName } from '../utils/resolveClassName';
import { resolveStyle } from '../utils/resolveStyle';
import { mergeProps, mergePropsN, mergeClassNames } from '../merge-props';

type IntrinsicTagName = keyof React.JSX.IntrinsicElements;

/**
 * Renders a Base UI element.
 *
 * @param element The default HTML element to render. Can be overridden by the `render` prop.
 * @param componentProps An object containing the `render` and `className` props to be used for element customization. Other props are ignored.
 * @param params Additional parameters for rendering the element.
 */
export function useRenderElement<
  State extends Record<string, any>,
  RenderedElementType extends Element,
  TagName extends IntrinsicTagName | undefined,
  Enabled extends boolean | undefined = undefined,
>(
  element: TagName,
  componentProps: UseRenderElementComponentProps<State>,
  params: UseRenderElementParameters<State, RenderedElementType, TagName, Enabled> = {},
): Enabled extends false ? null : React.ReactElement {
  const renderProp = componentProps.render;
  const outProps = useRenderElementProps(componentProps, params);
  if (params.enabled === false) {
    return null as Enabled extends false ? null : React.ReactElement;
  }

  const state = params.state ?? (EMPTY_OBJECT as State);
  return evaluateRenderProp(element, renderProp, outProps, state) as Enabled extends false
    ? null
    : React.ReactElement;
}

/**
 * Computes render element final props.
 */
function useRenderElementProps<
  State extends Record<string, any>,
  RenderedElementType extends Element,
  TagName extends IntrinsicTagName | undefined,
  Enabled extends boolean | undefined,
>(
  componentProps: UseRenderElementComponentProps<State>,
  params: UseRenderElementParameters<State, RenderedElementType, TagName, Enabled> = {},
): React.HTMLAttributes<any> & React.RefAttributes<any> {
  const { className: classNameProp, style: styleProp, render: renderProp } = componentProps;

  const {
    state = EMPTY_OBJECT as State,
    ref,
    props,
    stateAttributesMapping,
    enabled = true,
  } = params;

  const className = enabled ? resolveClassName(classNameProp, state) : undefined;
  const style = enabled ? resolveStyle(styleProp, state) : undefined;

  const stateProps = enabled
    ? getStateAttributesProps(state, stateAttributesMapping)
    : EMPTY_OBJECT;

  const resolvedProps = enabled && props ? resolveRenderFunctionProps<TagName>(props) : undefined;

  // Ensure outProps is always a new mutable object when enabled, never EMPTY_OBJECT.
  // This prevents potential TypeError when setting ref, className, or style properties,
  // since EMPTY_OBJECT is frozen and mutations would fail in strict mode.
  const outProps: React.HTMLAttributes<any> & React.RefAttributes<any> = enabled
    ? (mergeObjects(stateProps, resolvedProps) ?? {})
    : EMPTY_OBJECT;

  // SAFETY: The `useMergedRefs` functions use a single hook to store the same value,
  // switching between them at runtime is safe. If this assertion fails, React will
  // throw at runtime anyway.
  // This also skips the `useMergedRefs` call on the server, which is fine because
  // refs are not used on the server side.
  /* eslint-disable react-hooks/rules-of-hooks */
  if (typeof document !== 'undefined') {
    if (!enabled) {
      useMergedRefs(null, null);
    } else if (Array.isArray(ref)) {
      outProps.ref = useMergedRefsN([outProps.ref, getReactElementRef(renderProp), ...ref]);
    } else {
      outProps.ref = useMergedRefs(outProps.ref, getReactElementRef(renderProp), ref);
    }
  }

  if (!enabled) {
    return EMPTY_OBJECT;
  }

  if (className !== undefined) {
    outProps.className = mergeClassNames(outProps.className, className);
  }

  if (style !== undefined) {
    outProps.style = mergeObjects(outProps.style, style);
  }

  return outProps;
}

function resolveRenderFunctionProps<TagName extends IntrinsicTagName | undefined>(
  props: NonNullable<UseRenderElementParameters<any, any, TagName, any>['props']>,
): RenderFunctionProps<TagName> {
  if (Array.isArray(props)) {
    return mergePropsN(props) as RenderFunctionProps<TagName>;
  }

  return mergeProps(undefined, props) as RenderFunctionProps<TagName>;
}

// The symbol React uses internally for lazy components
// https://github.com/facebook/react/blob/a0566250b210499b4c5677f5ac2eedbd71d51a1b/packages/shared/ReactSymbols.js#L31
//
// TODO delete once https://github.com/facebook/react/issues/32392 is fixed
const REACT_LAZY_TYPE = Symbol.for('react.lazy');
const COMPONENT_IDENTIFIER_PATTERN = /^[A-Z][A-Za-z0-9$]*$/;
const LOWERCASE_CHARACTER_PATTERN = /[a-z]/;

function evaluateRenderProp<T extends React.ElementType, S>(
  element: IntrinsicTagName | undefined,
  render: BaseUIComponentProps<T, S>['render'],
  props: React.HTMLAttributes<any> & React.RefAttributes<any>,
  state: S,
): React.ReactElement {
  if (render) {
    if (typeof render === 'function') {
      if (process.env.NODE_ENV !== 'production') {
        warnIfRenderPropLooksLikeComponent(render);
      }
      return render(props, state);
    }

    const mergedProps = mergeProps(props, render.props);

    mergedProps.ref = props.ref;

    let newElement = render;

    // Workaround for https://github.com/facebook/react/issues/32392
    // This works because the toArray() logic unwrap lazy element type in
    // https://github.com/facebook/react/blob/a0566250b210499b4c5677f5ac2eedbd71d51a1b/packages/react/src/ReactChildren.js#L186
    if (newElement?.$$typeof === REACT_LAZY_TYPE) {
      const children = React.Children.toArray(render);
      newElement = children[0] as BaseUIComponentProps<T, S>['render'];
    }

    // There is a high number of indirections, the error message thrown by React.cloneElement() is
    // hard to use for developers, this logic provides a better context.
    //
    // Our general guideline is to never change the control flow depending on the environment.
    // However, React.cloneElement() throws if React.isValidElement() is false,
    // so we can throw before with custom message.
    if (process.env.NODE_ENV !== 'production') {
      if (!React.isValidElement(newElement)) {
        // TODO: fix mui/no-guarded-throw
        // eslint-disable-next-line mui/no-guarded-throw
        throw new Error(
          [
            'Base UI: The `render` prop was provided an invalid React element as `React.isValidElement(render)` is `false`.',
            'A valid React element must be provided to the `render` prop because it is cloned with props to replace the default element.',
            'https://base-ui.com/r/invalid-render-prop',
          ].join('\n'),
        );
      }
    }

    return React.cloneElement(newElement, mergedProps);
  }
  if (element) {
    if (typeof element === 'string') {
      return renderTag(element, props);
    }
  }
  // Unreachable, but the typings on `useRenderElement` need to be reworked
  // to annotate it correctly.
  throw new Error('Base UI: Render element or function are not defined.');
}

function warnIfRenderPropLooksLikeComponent(renderFn: { name: string }) {
  const functionName = renderFn.name;
  if (functionName.length === 0) {
    return;
  }

  if (!COMPONENT_IDENTIFIER_PATTERN.test(functionName)) {
    return;
  }

  if (!LOWERCASE_CHARACTER_PATTERN.test(functionName)) {
    return;
  }

  warn(
    `The \`render\` prop received a function named \`${functionName}\` that starts with an uppercase letter.`,
    'This usually means a React component was passed directly as `render={Component}`.',
    'Base UI calls `render` as a plain function, which can break the Rules of Hooks during reconciliation.',
    'If this is an intentional render callback, rename it to start with a lowercase letter.',
    'Use `render={<Component />}` or `render={(props) => <Component {...props} />}` instead.',
    'https://base-ui.com/r/invalid-render-prop',
  );
}

function renderTag(Tag: string, props: Record<string, any>) {
  if (Tag === 'button') {
    return <button type="button" {...props} key={props.key} />;
  }
  if (Tag === 'img') {
    return <img alt="" {...props} key={props.key} />;
  }
  return React.createElement(Tag, props);
}

type RenderFunctionProps<TagName> = TagName extends keyof React.JSX.IntrinsicElements
  ? React.JSX.IntrinsicElements[TagName]
  : React.HTMLAttributes<any>;

export type UseRenderElementParameters<
  State,
  RenderedElementType extends Element,
  TagName,
  Enabled extends boolean | undefined,
> = {
  /**
   * If `false`, the hook will skip most of its internal logic and return `null`.
   * This is useful for rendering a component conditionally.
   * @default true
   */
  enabled?: Enabled | undefined;
  /**
   * @deprecated
   */
  propGetter?: ((externalProps: HTMLProps) => HTMLProps) | undefined;
  /**
   * The ref to apply to the rendered element.
   */
  ref?: React.Ref<RenderedElementType> | (React.Ref<RenderedElementType> | undefined)[] | undefined;
  /**
   * The state of the component.
   */
  state?: State | undefined;
  /**
   * Intrinsic props to be spread on the rendered element.
   */
  props?:
    | RenderFunctionProps<TagName>
    | Array<
        | RenderFunctionProps<TagName>
        | undefined
        | ((props: RenderFunctionProps<TagName>) => RenderFunctionProps<TagName>)
      >
    | undefined;
  /**
   * A mapping of state to `data-*` attributes.
   */
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
};

export interface UseRenderElementComponentProps<State> {
  /**
   * The class name to apply to the rendered element.
   * Can be a string or a function that accepts the state and returns a string.
   */
  className?: string | ((state: State) => string | undefined) | undefined;
  /**
   * The render prop or React element to override the default element.
   */
  render?: undefined | React.ReactElement | ComponentRenderFn<React.HTMLAttributes<any>, State>;
  /**
   * The style to apply to the rendered element.
   * Can be a style object or a function that accepts the state and returns a style object.
   */
  style?: React.CSSProperties | ((state: State) => React.CSSProperties | undefined) | undefined;
}

export interface UseRenderElementState {}
