import * as React from 'react';
import { visuallyHidden } from '@base-ui/utils/visuallyHidden';
import type { EnhancedProperty } from '@mui/internal-docs-infra/useTypes';
import { stringOrHastToString } from '@mui/internal-docs-infra/pipeline/hastUtils';
import { Link } from 'docs/src/components/Link';
import * as Accordion from '../Accordion';
import * as CodeBlock from '../CodeBlock';
import * as DescriptionList from '../DescriptionList';
import { TableCode } from '../TableCode';

/** Workaround for strange Server -> Client Component behavior */
function TableDefault({ children }: { children: React.ReactNode }) {
  return <React.Fragment>{children}</React.Fragment>;
}

interface Props extends React.ComponentPropsWithoutRef<any> {
  data: Record<string, EnhancedProperty>;
  name: string;
  nameLabel?: string;
  caption?: string;
  /** Hide the required indicator (red star) - useful for return values where "required" doesn't apply */
  hideRequired?: boolean;
  /** Hide the default value column - useful for return values that don't have defaults */
  hideDefault?: boolean;
}

export function ReferenceAccordion({
  data,
  name: partName,
  nameLabel = 'Prop',
  caption = 'Component props table',
  hideRequired = false,
  hideDefault = false,
  ...props
}: Props) {
  const captionId = `${partName}-caption`;

  return (
    <Accordion.Root
      aria-describedby={captionId}
      data-hide-default={hideDefault || undefined}
      {...props}
    >
      <span id={captionId} style={visuallyHidden} aria-hidden>
        {caption}
      </span>
      <Accordion.HeaderRow className="ReferenceHeaderRow">
        <Accordion.HeaderCell>{nameLabel}</Accordion.HeaderCell>
        <Accordion.HeaderCell className="ReferenceHeaderTypeCell">Type</Accordion.HeaderCell>
        {!hideDefault && (
          <Accordion.HeaderCell className="ReferenceHeaderDefaultCell">
            Default
          </Accordion.HeaderCell>
        )}
        <Accordion.HeaderCell className="ReferenceHeaderIconCell" />
      </Accordion.HeaderRow>
      {Object.keys(data).map((name) => {
        const prop = data[name];

        // Use shortType if available (set by useTypes), otherwise use the full type
        const displayShortType = prop.shortType ?? prop.type;
        const displayDetailedType = prop.detailedType ?? prop.type;

        // anchor hash for each prop
        const id = `${partName.replace('.', '')}-${name}`;

        const shortTypeText = prop.shortType
          ? stringOrHastToString(prop.shortType as string)
          : 'type';
        const defaultText = prop.defaultText;

        return (
          <Accordion.Item
            key={name}
            gaCategory="reference"
            gaLabel={`${nameLabel}: ${id}`}
            gaParams={{ type: nameLabel.toLowerCase(), slug: id, part_name: partName }}
          >
            <Accordion.Trigger
              id={id}
              aria-label={`${nameLabel}: ${name},${!hideRequired && prop.required ? ' required,' : ''} type: ${shortTypeText} ${defaultText !== undefined ? `(default: ${defaultText})` : ''}`}
              className="ReferenceTrigger"
            >
              <Accordion.Scrollable className="ReferenceNameCell">
                <TableCode className="bui-ws-nw" style={{ color: 'var(--color-navy)' }}>
                  {name}
                  {!hideRequired && prop.required ? <sup className="ReferenceRequired">*</sup> : ''}
                </TableCode>
              </Accordion.Scrollable>
              {prop.type && (
                <Accordion.Scrollable className="ReferenceTypeCell">
                  {displayShortType}
                </Accordion.Scrollable>
              )}
              {!hideDefault && (
                <Accordion.Scrollable className="ReferenceDefaultCell">
                  {prop.required || prop.default === undefined ? (
                    <TableCode style={{ color: 'var(--color-docs-infra-syntax-nullish)' }}>
                      —
                    </TableCode>
                  ) : (
                    <TableDefault>{prop.default}</TableDefault>
                  )}
                </Accordion.Scrollable>
              )}
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
                      {/* one-off override of the default mt/mb on CodeBlock.Root */}
                      <DescriptionList.Details className="ReferenceDescription">
                        {prop.description}
                      </DescriptionList.Details>
                    </DescriptionList.Item>
                  )}
                  <DescriptionList.Item>
                    <DescriptionList.Term separator>Type</DescriptionList.Term>
                    <DescriptionList.Details>
                      <CodeBlock.Root>{displayDetailedType}</CodeBlock.Root>
                    </DescriptionList.Details>
                  </DescriptionList.Item>
                  {!hideDefault && prop.default !== undefined && (
                    <DescriptionList.Item>
                      <DescriptionList.Term separator>Default</DescriptionList.Term>
                      <DescriptionList.Details>{prop.default}</DescriptionList.Details>
                    </DescriptionList.Item>
                  )}

                  {prop.example && (
                    <DescriptionList.Item>
                      <DescriptionList.Term separator>Example</DescriptionList.Term>
                      <DescriptionList.Details className="ReferenceExampleReset">
                        {prop.example}
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
