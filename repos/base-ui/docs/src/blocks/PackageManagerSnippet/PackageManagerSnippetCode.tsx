'use client';
import * as React from 'react';
import { Tabs } from '@base-ui/react/tabs';

export function PackageManagerSnippetCode(props: PackageManagerSnippetCode.Props) {
  const { value, children } = props;

  return <Tabs.Panel value={value}>{children}</Tabs.Panel>;
}

export namespace PackageManagerSnippetCode {
  export type Props = {
    children: React.ReactNode;
    value: string;
  };
}
