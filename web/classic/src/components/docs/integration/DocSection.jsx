/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Typography } from '@douyinfe/semi-ui';

export const DocStepList = ({ steps, className = '' }) => (
  <ol
    className={className}
    style={{
      margin: 0,
      paddingLeft: '20px',
      listStyleType: 'decimal',
      color: 'var(--semi-color-text-1)',
    }}
  >
    {steps.map((step, index) => (
      <li key={index} style={{ marginBottom: '24px', lineHeight: 1.7, paddingLeft: '8px' }}>
        {step}
      </li>
    ))}
  </ol>
);

export const DocSection = ({ title, children, id }) => (
  <section id={id} style={{ marginBottom: '40px' }}>
    <Typography.Title heading={4} style={{ marginBottom: '16px' }}>
      {title}
    </Typography.Title>
    <div>{children}</div>
  </section>
);

export const DocPageHeader = ({ title, description }) => (
  <header
    style={{
      marginBottom: '32px',
      paddingBottom: '24px',
      borderBottom: '1px solid var(--semi-color-border)',
    }}
  >
    <Typography.Title heading={2} style={{ marginBottom: '12px' }}>
      {title}
    </Typography.Title>
    <Typography.Paragraph
      type='secondary'
      style={{ fontSize: '16px', lineHeight: 1.7, margin: 0 }}
    >
      {description}
    </Typography.Paragraph>
  </header>
);

export const DocBulletList = ({ items }) => (
  <ul
    style={{
      margin: 0,
      paddingLeft: '20px',
      color: 'var(--semi-color-text-1)',
      lineHeight: 1.7,
    }}
  >
    {items.map((item, index) => (
      <li key={index} style={{ marginBottom: '8px' }}>
        {item}
      </li>
    ))}
  </ul>
);
