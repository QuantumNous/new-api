'use client';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useBaseUiId } from '../internals/useBaseUiId';

export function useRegisteredLabelId(
  idProp: string | undefined,
  setLabelId: (id: string | undefined) => void,
): string | undefined {
  const id = useBaseUiId(idProp);

  useIsoLayoutEffect(() => {
    setLabelId(id);

    return () => {
      setLabelId(undefined);
    };
  }, [id, setLabelId]);

  return id;
}
