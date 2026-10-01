import * as React from 'react';
import { useRefWithInit } from './useRefWithInit';

export type Instance = {
  didInitialize: boolean;
};

type HookType = {
  before: (instance: any) => void;
  after: (instance: any) => void;
};

const hooks: HookType[] = [];

let currentInstance: Instance | undefined = undefined;

export function getInstance() {
  return currentInstance;
}

export function setInstance(instance: Instance | undefined): void {
  currentInstance = instance;
}

export function register(hook: HookType): void {
  hooks.push(hook);
}

export function fastComponent<P extends object, E extends HTMLElement, R extends React.ReactNode>(
  fn: (props: P) => R,
): typeof fn {
  const FastComponent = (props: P, forwardedRef: React.Ref<E>): R => {
    const instance = useRefWithInit(createInstance).current;

    let result;
    try {
      currentInstance = instance;

      for (const hook of hooks) {
        hook.before(instance);
      }

      result = (fn as any)(props, forwardedRef);

      for (const hook of hooks) {
        hook.after(instance);
      }

      instance.didInitialize = true;
    } finally {
      currentInstance = undefined;
    }

    return result;
  };
  FastComponent.displayName = (fn as any).displayName || fn.name;
  return FastComponent as unknown as typeof fn;
}

export function fastComponentRef<P extends object, E extends Element, R extends React.ReactNode>(
  fn: (props: React.PropsWithoutRef<P>, forwardedRef: React.Ref<E>) => R,
) {
  return React.forwardRef<E, P>(fastComponent(fn as any) as unknown as typeof fn);
}

function createInstance(): Instance {
  return {
    didInitialize: false,
  };
}
