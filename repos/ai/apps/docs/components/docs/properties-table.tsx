'use client';

import Link from 'next/link';
import { Streamdown } from 'streamdown';
import type { ComponentProps } from 'react';
import { resolveDocsHref } from '@/components/docs/resolve-href';

interface Parameter {
  name: string;
  type: string;
  description: string;
  isOptional?: boolean;
  properties?: {
    type: string;
    parameters: Parameter[];
  }[];
}

type StreamdownComponents = ComponentProps<typeof Streamdown>['components'];

const createDescriptionComponents = (
  versionPrefix: string,
): StreamdownComponents => ({
  p: ({ children }) => <>{children}</>,
  code: ({ children }) => (
    <code className="rounded-md border border-gray-alpha-400 bg-gray-100 px-1 py-0.5 text-xs">
      {children}
    </code>
  ),
  a: ({ href, children }) => {
    const resolvedHref = resolveDocsHref(href ?? '', versionPrefix);
    if (resolvedHref.startsWith('http')) {
      return (
        <a href={resolvedHref} rel="noopener noreferrer" target="_blank">
          {children}
        </a>
      );
    }
    return <Link href={resolvedHref}>{children}</Link>;
  },
});

const camelToKebab = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

const hashId = (parts: string[]) => parts.map(camelToKebab).join('.');

const ParameterEntry = ({
  parameter,
  parents,
  descriptionComponents,
}: {
  parameter: Parameter;
  parents: string[];
  descriptionComponents: StreamdownComponents;
}) => {
  const id = hashId([...parents, parameter.name]);

  return (
    <div
      className="flex flex-col gap-1 border-gray-alpha-400 border-b p-3 last:border-none"
      id={id}
    >
      <a className="flex flex-row items-start gap-2" href={`#${id}`}>
        <h3 className="font-medium font-mono text-sm">
          {parameter.name}
          {parameter.isOptional ? '?:' : parameter.name === '' ? '' : ':'}
        </h3>
        <div className="w-full font-mono text-gray-900 text-sm">
          {parameter.type}
        </div>
      </a>
      <div className="text-gray-900 text-sm leading-5">
        <Streamdown components={descriptionComponents}>
          {parameter.description}
        </Streamdown>
      </div>
      {parameter.properties?.map((property, index) => (
        <div
          className="relative m-2 my-4 flex flex-col rounded-lg border border-gray-alpha-400"
          key={`${parameter.name}-${property.type}-${index}`}
        >
          <a
            className="-top-3 absolute right-2 z-10 rounded-md bg-gray-200 px-2 py-1 font-mono text-gray-900 text-xs"
            href={`#${hashId([...parents, parameter.name, property.type])}`}
            id={hashId([...parents, parameter.name, property.type])}
          >
            {property.type}
          </a>
          {property.parameters.map((nested, nestedIndex) => (
            <ParameterEntry
              key={`${nested.name}-${nestedIndex}`}
              parameter={nested}
              parents={[...parents, parameter.name, property.type]}
              descriptionComponents={descriptionComponents}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export const PropertiesTable = ({
  content,
  versionPrefix = '',
}: {
  content: Parameter[] | string;
  versionPrefix?: string;
}) => {
  const descriptionComponents = createDescriptionComponents(versionPrefix);

  return (
    <div className="not-prose flex flex-col gap-12">
      {typeof content === 'string'
        ? content
        : content.map((parameter, index) => (
            <div
              className="[&>div]:border-none"
              key={`${parameter.name}-${index}`}
            >
              <ParameterEntry
                parameter={parameter}
                parents={[]}
                descriptionComponents={descriptionComponents}
              />
            </div>
          ))}
    </div>
  );
};
