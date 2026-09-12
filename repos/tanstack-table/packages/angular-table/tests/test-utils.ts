import type { InputSignal } from '@angular/core'
import { SIGNAL, signalSetFn } from '@angular/core/primitives/signals'
import type { ComponentFixture } from '@angular/core/testing'

type ToSignalInputUpdatableMap<T> = {
  [K in keyof T as T[K] extends InputSignal<any>
    ? K
    : never]: T[K] extends InputSignal<infer Value> ? Value : never
}

export function setFixtureSignalInputs<T extends NonNullable<unknown>>(
  componentFixture: ComponentFixture<T>,
  inputs: ToSignalInputUpdatableMap<T>,
  options: { detectChanges: boolean } = { detectChanges: true }
) {
  for (const inputKey in inputs) {
    componentFixture.componentRef.setInput(inputKey, inputs[inputKey])
  }
  if (options.detectChanges) {
    componentFixture.detectChanges()
  }
}

export function setFixtureSignalInput<
  T extends NonNullable<unknown>,
  InputMaps extends ToSignalInputUpdatableMap<T>,
  InputName extends keyof InputMaps,
>(
  componentFixture: ComponentFixture<T>,
  inputName: InputName,
  value: InputMaps[InputName]
) {
  setFixtureSignalInputs(componentFixture, {
    [inputName]: value,
  } as ToSignalInputUpdatableMap<T>)
}

function componentHasSignalInputProperty<TProperty extends string>(
  component: object,
  property: TProperty
): component is { [key in TProperty]: InputSignal<unknown> } {
  return (
    component.hasOwnProperty(property) && (component as any)[property][SIGNAL]
  )
}

export async function flushQueue() {
  await new Promise(setImmediate)
}
