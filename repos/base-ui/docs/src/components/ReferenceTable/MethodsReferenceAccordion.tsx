import * as React from 'react';
import { visuallyHidden } from '@base-ui/utils/visuallyHidden';
import type { EnhancedMethod } from '@mui/internal-docs-infra/useTypes';
import { Link } from 'docs/src/components/Link';
import * as Accordion from '../Accordion';
import * as DescriptionList from '../DescriptionList';
import { TableCode } from '../TableCode';

interface Props extends React.ComponentPropsWithoutRef<any> {
  data: Record<string, EnhancedMethod>;
  name: string;
  methodLabel?: string;
}

export function MethodsReferenceAccordion({
  data,
  name: partName,
  methodLabel = 'Method',
  ...props
}: Props) {
  const captionId = `${partName}-methods-caption`;

  return (
    <Accordion.Root aria-describedby={captionId} {...props}>
      <span id={captionId} style={visuallyHidden} aria-hidden>
        Class methods table
      </span>
      <Accordion.HeaderRow className="MethodsHeaderRow">
        <Accordion.HeaderCell>{methodLabel}</Accordion.HeaderCell>
        <Accordion.HeaderCell className="ReferenceHeaderTypeCell">Returns</Accordion.HeaderCell>
        <Accordion.HeaderCell className="ReferenceHeaderIconCell" />
      </Accordion.HeaderRow>
      {Object.keys(data).map((name) => {
        const method = data[name];

        // anchor hash for each method
        const id = `${partName}-${name}`;

        return (
          <Accordion.Item
            key={name}
            gaCategory="reference"
            gaLabel={`Method: ${id}`}
            gaParams={{ type: 'method', slug: id, part_name: partName }}
          >
            <Accordion.Trigger
              id={id}
              aria-label={`Method: ${name}, returns: ${method.returnValue ? 'value' : 'void'}`}
              className="MethodsTrigger"
            >
              <Accordion.Scrollable className="ReferenceNameCell">
                <code className="Code language-ts TableCode">
                  <span className="pl-en">{name}</span>
                  {'('}
                  {method.parameters.map((param, i) => (
                    <React.Fragment key={param.name}>
                      {i !== 0 && ', '}
                      <span className="pl-v">{param.name}</span>
                      {param.optional && '?'}
                    </React.Fragment>
                  ))}
                  {')'}
                </code>
              </Accordion.Scrollable>
              <Accordion.Scrollable className="ReferenceTypeCell">
                {method.returnValue}
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

                  {method.description && (
                    <DescriptionList.Item>
                      <DescriptionList.Term separator>Description</DescriptionList.Term>
                      <DescriptionList.Details className="ReferenceDescription">
                        {method.description}
                      </DescriptionList.Details>
                    </DescriptionList.Item>
                  )}

                  {method.parameters.length > 0 && (
                    <DescriptionList.Item>
                      <DescriptionList.Term separator>Parameters</DescriptionList.Term>
                      <DescriptionList.Details>
                        <ul className="MethodParamList">
                          {method.parameters.map((param) => (
                            <li key={param.name}>
                              <div className="MethodParamRow">
                                <TableCode style={{ color: 'var(--color-navy)' }}>
                                  {param.name}
                                  {param.optional && '?'}
                                </TableCode>
                                <span className="MethodParamSep">—</span>
                                {param.type}
                              </div>
                              {param.description && (
                                <div className="MethodParamDesc">{param.description}</div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </DescriptionList.Details>
                    </DescriptionList.Item>
                  )}

                  <DescriptionList.Item>
                    <DescriptionList.Term separator>Returns</DescriptionList.Term>
                    <DescriptionList.Details>{method.returnValue}</DescriptionList.Details>
                  </DescriptionList.Item>

                  {method.returnValueDescription && (
                    <DescriptionList.Item>
                      <DescriptionList.Term separator>Return description</DescriptionList.Term>
                      <DescriptionList.Details>
                        {method.returnValueDescription}
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
