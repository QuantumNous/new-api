import type {
  AnyRouter,
  Constrain,
  OptionalStructuralSharing,
  ValidateJSON,
} from '@tanstack/router-core'

export type DefaultStructuralSharingEnabled<TRouter extends AnyRouter> =
  boolean extends TRouter['options']['defaultStructuralSharing']
    ? // for now, default to false.
      // TODO in V2: default to true
      false
    : NonNullable<TRouter['options']['defaultStructuralSharing']>

export interface RequiredStructuralSharing<TStructuralSharing, TConstraint> {
  readonly structuralSharing: Constrain<TStructuralSharing, TConstraint>
}

export type StructuralSharingOption<
  TRouter extends AnyRouter,
  TSelected,
  TStructuralSharing,
> = unknown extends TSelected
  ? OptionalStructuralSharing<TStructuralSharing, boolean>
  : unknown extends TRouter['routeTree']
    ? OptionalStructuralSharing<TStructuralSharing, boolean>
    : TSelected extends ValidateJSON<TSelected>
      ? OptionalStructuralSharing<TStructuralSharing, boolean>
      : DefaultStructuralSharingEnabled<TRouter> extends true
        ? RequiredStructuralSharing<TStructuralSharing, false>
        : OptionalStructuralSharing<TStructuralSharing, false>

export type StructuralSharingEnabled<
  TRouter extends AnyRouter,
  TStructuralSharing,
> = boolean extends TStructuralSharing
  ? DefaultStructuralSharingEnabled<TRouter>
  : TStructuralSharing

export type ValidateSelected<
  TRouter extends AnyRouter,
  TSelected,
  TStructuralSharing,
> =
  StructuralSharingEnabled<TRouter, TStructuralSharing> extends true
    ? ValidateJSON<TSelected>
    : TSelected
