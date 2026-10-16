import * as React from 'react';
import { visuallyHidden } from '@base-ui/utils/visuallyHidden';
import type { EnhancedProperty } from '@mui/internal-docs-infra/useTypes';
import { stringOrHastToString } from '@mui/internal-docs-infra/pipeline/hastUtils';
import { Link } from 'docs/src/components/Link';
import * as Accordion from '../Accordion';
import * as DescriptionList from '../DescriptionList';
import { TableCode } from '../TableCode';

interface ProcessedClassProperty extends EnhancedProperty {
  isStatic?: boolean;
  readonly?: boolean;
}

interface Props extends React.ComponentPropsWithoutRef<any> {
  data: Record<string, ProcessedClassProperty>;
  name: string;
}

export function PropertiesReferenceAccordion({ data, name: partName, ...props }: Props) {
  const captionId = `${partName}-properties-caption`;

  return (
    <Accordion.Root aria-describedby={captionId} {...props}>
      <span id={captionId} style={visuallyHidden} aria-hidden>
        Class properties table
      </span>
      <Accordion.HeaderRow className="ReferenceHeaderRow">
        <Accordion.HeaderCell>Property</Accordion.HeaderCell>
        <Accordion.HeaderCell className="ReferenceHeaderTypeCell">Type</Accordion.HeaderCell>
        <Accordion.HeaderCell className="PropertiesHeaderModifiersCell">
          Modifiers
        </Accordion.HeaderCell>
        <Accordion.HeaderCell className="ReferenceHeaderIconCell" />
      </Accordion.HeaderRow>
      {Object.keys(data).map((name) => {
        const prop = data[name];

        // Use shortType if available, otherwise use the full type
        const displayShortType = prop.shortType ?? prop.type;
        const displayDetailedType = prop.detailedType ?? prop.type;

        // anchor hash for each property
        const id = `${partName}-${name}`;

        const shortTypeText = prop.shortType
          ? stringOrHastToString(prop.shortType as string)
          : 'type';

        // Build modifiers string
        const modifiers: string[] = [];
        if (prop.isStatic) {
          modifiers.push('static');
        }
        if (prop.readonly) {
          modifiers.push('readonly');
        }
        const modifiersText = modifiers.join(', ') || '—';

        return (
          <Accordion.Item
            key={name}
            gaCategory="reference"
            gaLabel={`Property: ${id}`}
            gaParams={{ type: 'property', slug: id, part_name: partName }}
          >
            <Accordion.Trigger
              id={id}
              aria-label={`Property: ${name}, type: ${shortTypeText}, modifiers: ${modifiersText}`}
              className="ReferenceTrigger"
            >
              <Accordion.Scrollable className="ReferenceNameCell">
                <TableCode className="bui-ws-nw" style={{ color: 'var(--color-navy)' }}>
                  {name}
                </TableCode>
              </Accordion.Scrollable>
              {prop.type && (
                <Accordion.Scrollable className="ReferenceTypeCell">
                  {displayShortType}
                </Accordion.Scrollable>
              )}
              <Accordion.Scrollable className="ReferenceDefaultCell">
                <TableCode style={{ color: 'var(--color-docs-infra-syntax-nullish)' }}>
                  {modifiersText}
                </TableCode>
              </Accordion.Scrollable>
              <span className="ReferenceIconWrap">
                <svg
                  className="AccordionIcon ReferenceIcon"
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                >
                  <path d="M1 3.5L5 7.5L9 3.5" stroke="currentColor" />
                </svg>
              </span>
            </Accordion.Trigger>
            <Accordion.Panel>
              <Accordion.Content>
                <DescriptionList.Root className="ReferenceContent" aria-label="Info">
                  <DescriptionList.Item>
                    <DescriptionList.Term>Name</DescriptionList.Term>
                    <DescriptionList.Details>
                      <Link href={`#${id}`}>
                        <TableCode style={{ color: 'var(--color-blue)' }}>{name}</TableCode>
                      </Link>
                    </DescriptionList.Details>
                  </DescriptionList.Item>

                  {prop.description && (
                    <DescriptionList.Item>
                      <DescriptionList.Term separator>Description</DescriptionList.Term>
                      <DescriptionList.Details className="ReferenceDescription">
                        {prop.description}
                      </DescriptionList.Details>
                    </DescriptionList.Item>
                  )}
                  <DescriptionList.Item>
                    <DescriptionList.Term separator>Type</DescriptionList.Term>
                    <DescriptionList.Details>{displayDetailedType}</DescriptionList.Details>
                  </DescriptionList.Item>
                  {modifiers.length > 0 && (
                    <DescriptionList.Item>
                      <DescriptionList.Term separator>Modifiers</DescriptionList.Term>
                      <DescriptionList.Details>
                        <TableCode>{modifiersText}</TableCode>
                      </DescriptionList.Details>
                    </DescriptionList.Item>
                  )}
                </DescriptionList.Root>
              </Accordion.Content>
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}
