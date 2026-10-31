'use client';

export function getDefaultLabelId(id: string | null | undefined) {
  return id == null ? undefined : `${id}-label`;
}

export function resolveAriaLabelledBy(
  fieldLabelId: string | undefined,
  localLabelId: string | undefined,
) {
  return fieldLabelId ?? localLabelId;
}
