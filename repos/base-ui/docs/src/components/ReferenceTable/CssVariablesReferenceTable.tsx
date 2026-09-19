import * as React from 'react';
import clsx from 'clsx';
import type { EnhancedEnumMember } from '@mui/internal-docs-infra/useTypes';
import * as Accordion from '../Accordion';
import * as Table from '../Table';
import { TableCode } from '../TableCode';

interface CssVariablesReferenceTableProps extends React.ComponentProps<typeof Table.Root> {
  data: Record<string, EnhancedEnumMember>;
  name?: string;
}

export function CssVariablesReferenceTable({
  data,
  name: partName,
  ...props
}: CssVariablesReferenceTableProps) {
  return (
    <React.Fragment>
      <Accordion.Root {...props} className={clsx(props.className, 'bp0:bui-d-n')}>
        <Accordion.HeaderRow>
          <Accordion.HeaderCell className="bui-pl-3">CSS Variable</Accordion.HeaderCell>
        </Accordion.HeaderRow>
        {Object.keys(data).map((name) => {
          const attribute = data[name];

          return (
            <Accordion.Item
              key={name}
              gaCategory="reference"
              gaLabel={`CSS variable: ${partName ? `${partName}-` : ''}${name}`}
              gaParams={{
                type: 'css_variable',
                slug: `${partName ? `${partName}-` : ''}${name}`,
                part_name: partName || '',
              }}
            >
              <Accordion.Trigger>
                <TableCode style={{ color: 'var(--color-navy)' }}>{name}</TableCode>
                <svg
                  className="AccordionIcon bui-ml-a bui-mr-1"
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                >
                  <path d="M1 3.5L5 7.5L9 3.5" stroke="currentColor" />
                </svg>
              </Accordion.Trigger>
              <Accordion.Panel>
                <Accordion.Content className="ReferenceCompactPanel">
                  {attribute.description}
                </Accordion.Content>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion.Root>

      <Table.Root {...props} className={clsx('bui-d-n', 'bp0:bui-d-b', props.className)}>
        <Table.Head>
          <Table.Row>
            {/* widths must match the props table grid layout */}
            <Table.ColumnHeader className="ReferenceWideNameColumn">
              CSS Variable
            </Table.ColumnHeader>
            <Table.ColumnHeader className="ReferenceWideDescriptionColumn">
              Description
            </Table.ColumnHeader>
            {/* A cell to maintain a layout consistent with the props table */}
            <Table.ColumnHeader className="bui-w-10" aria-hidden>
              <span className="bui-v-h">{'-'}</span>
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {Object.keys(data).map((name) => {
            const cssVariable = data[name];

            return (
              <Table.Row key={name}>
                <Table.RowHeader>
                  <TableCode style={{ color: 'var(--color-navy)' }}>{name}</TableCode>
                </Table.RowHeader>
                <Table.Cell colSpan={2}>{cssVariable.description}</Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </React.Fragment>
  );
}
