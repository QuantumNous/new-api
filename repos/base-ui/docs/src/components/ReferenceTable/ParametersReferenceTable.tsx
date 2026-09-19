import * as React from 'react';
import type { EnhancedParameter, EnhancedProperty } from '@mui/internal-docs-infra/useTypes';
import { ReferenceAccordion } from './ReferenceAccordion';

interface ParametersReferenceTableProps extends React.ComponentPropsWithoutRef<any> {
  data: EnhancedParameter[];
  name: string;
}

function normalizeParameters(data: EnhancedParameter[]) {
  return Object.fromEntries(
    data.map((param) => {
      const { optional, name, ...rest } = param;
      return [
        name,
        {
          ...rest,
          required: optional ? undefined : true,
        },
      ];
    }),
  ) as Record<string, EnhancedProperty>;
}

export function ParametersReferenceTable({ data, name, ...props }: ParametersReferenceTableProps) {
  return (
    <ReferenceAccordion
      {...props}
      name={name}
      data={normalizeParameters(data)}
      nameLabel="Parameter"
      caption="Function parameters table"
    />
  );
}
