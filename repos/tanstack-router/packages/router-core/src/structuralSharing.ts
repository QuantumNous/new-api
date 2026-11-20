import type { Constrain } from './utils'

export interface OptionalStructuralSharing<TStructuralSharing, TConstraint> {
  readonly structuralSharing?:
    | Constrain<TStructuralSharing, TConstraint>
    | undefined
}
