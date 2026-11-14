import { isNil, isArray } from '@visactor/vutils';
import React, { ReactNode } from 'react';
import { isFragment } from 'react-is';

/**
 * Get the display name of a component
 * @param  {Object} Comp Specified Component
 * @return {String}      Display name of Component
 */
export const getDisplayName = (Comp: any) => {
  if (typeof Comp === 'string') {
    return Comp;
  }
  if (!Comp) {
    return '';
  }
  return Comp.displayName || Comp.name;
};

export const typeOfComponent = (component: any, customTypeKey = '__TYPE'): string => {
  return (
    (component?.props && component.props[customTypeKey]) ||
    (typeof component?.type === 'string' && component.type) ||
    (component?.type &&
      typeof component.type === 'symbol' &&
      component.type.toString() === 'Symbol(react.fragment)' &&
      'react.fragment') ||
    (typeof component?.type === 'function' && component.type) ||
    (typeof component?.type === 'object' &&
      component.type.$$typeof.toString() === 'Symbol(react.forward_ref)' &&
      'react.forward_ref') ||
    (typeof component === 'string' && 'string') ||
    (typeof component === 'function' && 'function') ||
    undefined
  );
};

export const toArray = <T = ReactNode, TC = ReactNode>(children: T): TC[] => {
  let result: TC[] = [];

  React.Children.forEach(children, child => {
    if (isNil(child)) return;

    if (isFragment(child)) {
      result = result.concat(toArray(child.props.children));
    } else {
      result.push(child as unknown as TC);
    }
  });

  return result;
};

/*
 * Find and return all matched children by type. `type` can be a React element class or
 * string
 */
export const findAllByType = <T extends React.ReactNode, TC = unknown>(
  children: React.ReactNode,
  type: TC | TC[]
): T[] => {
  const result: T[] = [];
  let types: string[] = [];

  if (isArray(type)) {
    types = type.map(t => getDisplayName(t));
  } else {
    types = [getDisplayName(type)];
  }

  toArray(children).forEach(child => {
    const childType = getDisplayName(typeOfComponent(child));

    if (types.indexOf(childType) !== -1) {
      result.push(child as T);
    }
  });

  return result;
};
/*
 * Return the first matched child by type, return null otherwise.
 * `type` can be a React element class or string.
 */
export const findChildByType = <T extends React.ReactNode, TC = unknown>(children: React.ReactNode, type: TC): T => {
  const result = findAllByType<T, TC>(children, type);

  return result?.[0];
};
