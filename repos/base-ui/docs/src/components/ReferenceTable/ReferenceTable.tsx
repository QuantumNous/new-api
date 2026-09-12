'use client';

import * as React from 'react';
import { useTypes, type TypesTableProps } from '@mui/internal-docs-infra/useTypes';
import { ReferenceAccordion } from './ReferenceAccordion';
import { AttributesReferenceTable } from './AttributesReferenceTable';
import { CssVariablesReferenceTable } from './CssVariablesReferenceTable';
import { ParametersReferenceTable } from './ParametersReferenceTable';
import { PropertiesReferenceAccordion } from './PropertiesReferenceAccordion';
import { MethodsReferenceAccordion } from './MethodsReferenceAccordion';
import { AdditionalTypes } from './AdditionalTypes';
import * as CodeBlock from '../CodeBlock';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="ReferenceSectionHeading">{children}</h4>;
}

type UseTypesResult = ReturnType<typeof useTypes>;
type CallableType = Extract<NonNullable<UseTypesResult['type']>, { type: 'hook' | 'function' }>;
type CallableData = CallableType['data'];

function CallableReturnValue({ name, data }: { name: string; data: CallableData['returnValue'] }) {
  if (!data) {
    return null;
  }

  if (data.kind === 'object') {
    return (
      <React.Fragment>
        <SectionHeading>Return value</SectionHeading>
        {data.typeName && (
          <p className="ReferenceSectionSubtext">
            <code>
              <span className="pl-en">{data.typeName}</span>
            </code>
          </p>
        )}
        <ReferenceAccordion
          name={name}
          data={data.properties}
          nameLabel="Property"
          caption="Return value properties table"
          hideRequired
          hideDefault
          className="ReferenceBlock"
        />
      </React.Fragment>
    );
  }

  return (
    <div className="ReferenceBlock">
      <SectionHeading>Return value</SectionHeading>
      {data.type}
      {data.detailedType && <CodeBlock.Root>{data.detailedType}</CodeBlock.Root>}
    </div>
  );
}

function CallableReferenceSection({
  data,
  multiple,
  hideDescription,
  additionalTypes,
  showFallbackParametersHeading,
  fallbackParametersClassName,
}: {
  data: CallableData;
  multiple?: boolean;
  hideDescription?: boolean;
  additionalTypes?: React.ComponentProps<typeof AdditionalTypes>['data'];
  showFallbackParametersHeading: boolean;
  fallbackParametersClassName: string;
}) {
  return (
    <React.Fragment>
      {multiple && !hideDescription && data.description && data.description}

      {data.expandedProperties && Object.keys(data.expandedProperties).length > 0 && (
        <React.Fragment>
          <SectionHeading>{data.expandedTypeName ? 'Parameters' : 'Properties'}</SectionHeading>
          {data.expandedTypeName && (
            <p className="ReferenceSectionSubtext">
              <code>
                <span className="pl-en">{data.expandedTypeName}</span>
              </code>
            </p>
          )}
          <ReferenceAccordion
            name={data.name}
            data={data.expandedProperties}
            nameLabel={data.expandedTypeName ? 'Prop' : 'Property'}
            caption={data.expandedTypeName ? 'Parameter properties table' : 'Properties table'}
            hideDefault
            className="ReferenceBlock"
          />
        </React.Fragment>
      )}

      {!data.expandedProperties && data.parameters && data.parameters.length > 0 && (
        <React.Fragment>
          {showFallbackParametersHeading && <SectionHeading>Parameters</SectionHeading>}
          <ParametersReferenceTable
            name={data.name}
            data={data.parameters}
            className={fallbackParametersClassName}
          />
        </React.Fragment>
      )}

      <CallableReturnValue name={data.name} data={data.returnValue} />

      {additionalTypes && additionalTypes.length > 0 && (
        <AdditionalTypes data={additionalTypes} multiple={multiple} />
      )}
    </React.Fragment>
  );
}

type ReferenceTableProps = TypesTableProps<{
  hideDescription?: boolean;
  showAdditionalTypes?: string[];
}>;

export function ReferenceTable(props: ReferenceTableProps) {
  const { type, additionalTypes, multiple, hideDescription } = useTypes(props);

  if (type?.type === 'component') {
    const data = type.data;
    return (
      <React.Fragment>
        {multiple && !hideDescription && data.description && data.description}

        {Object.keys(data.props).length > 0 && (
          <ReferenceAccordion name={data.name} data={data.props} className="ReferenceBlockSpaced" />
        )}

        {Object.keys(data.dataAttributes).length > 0 && (
          <AttributesReferenceTable
            name={data.name}
            data={data.dataAttributes}
            className="ReferenceBlockSpaced"
          />
        )}

        {Object.keys(data.cssVariables).length > 0 && (
          <CssVariablesReferenceTable
            name={data.name}
            data={data.cssVariables}
            className="ReferenceBlockSpaced"
          />
        )}

        {additionalTypes && additionalTypes.length > 0 && (
          <AdditionalTypes data={additionalTypes} multiple={multiple} />
        )}
      </React.Fragment>
    );
  }

  if (type?.type === 'hook' || type?.type === 'function') {
    const data = type.data;
    return (
      <CallableReferenceSection
        data={data}
        multiple={multiple}
        hideDescription={hideDescription}
        additionalTypes={additionalTypes}
        showFallbackParametersHeading={type.type === 'function'}
        fallbackParametersClassName={
          type.type === 'function' ? 'ReferenceBlock' : 'ReferenceBlockSpaced'
        }
      />
    );
  }

  if (type?.type === 'class') {
    const data = type.data;

    // Separate static and instance methods
    const staticMethods: Record<string, (typeof data.methods)[string]> = {};
    const instanceMethods: Record<string, (typeof data.methods)[string]> = {};

    Object.entries(data.methods).forEach(([name, method]) => {
      if (method.isStatic) {
        staticMethods[name] = method;
      } else {
        instanceMethods[name] = method;
      }
    });

    return (
      <React.Fragment>
        {multiple && !hideDescription && data.description && data.description}

        {Object.keys(staticMethods).length > 0 && (
          <React.Fragment>
            <SectionHeading>Static methods</SectionHeading>
            <MethodsReferenceAccordion
              name={data.name}
              data={staticMethods}
              className="ReferenceBlock"
              methodLabel="Static method"
            />
          </React.Fragment>
        )}

        {data.constructorParameters.length > 0 && (
          <React.Fragment>
            <SectionHeading>Constructor parameters</SectionHeading>
            <ParametersReferenceTable
              name={data.name}
              data={data.constructorParameters}
              className="ReferenceBlock"
            />
          </React.Fragment>
        )}

        {Object.keys(data.properties).length > 0 && (
          <React.Fragment>
            <SectionHeading>Properties</SectionHeading>
            <PropertiesReferenceAccordion
              name={data.name}
              data={data.properties}
              className="ReferenceBlock"
            />
          </React.Fragment>
        )}

        {Object.keys(instanceMethods).length > 0 && (
          <React.Fragment>
            <SectionHeading>Methods</SectionHeading>
            <MethodsReferenceAccordion
              name={data.name}
              data={instanceMethods}
              className="ReferenceBlock"
            />
          </React.Fragment>
        )}

        {additionalTypes && additionalTypes.length > 0 && (
          <AdditionalTypes
            data={additionalTypes}
            multiple={multiple}
            show={props.showAdditionalTypes}
          />
        )}
      </React.Fragment>
    );
  }

  // type.type === 'raw'
  return (
    <React.Fragment>
      {additionalTypes && additionalTypes.length > 0 && (
        <AdditionalTypes
          data={additionalTypes}
          multiple={multiple}
          show={props.showAdditionalTypes}
        />
      )}
    </React.Fragment>
  );
}
