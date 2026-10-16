import type { MCPAppResource } from '@ai-sdk/mcp';
import { useEffect, useState } from 'react';
import { MCPAppFrame } from './app-frame';
import type { MCPAppMetadata, MCPAppRendererProps } from './types';
import { getMCPAppFromToolPart } from './utils';

type LoadedResourceState = {
  resourceUri: string;
  resource?: MCPAppResource;
  error?: Error;
};

function getToolPartOutput(part: MCPAppRendererProps['part']): unknown {
  return part.state === 'output-available' ? part.output : undefined;
}

function getToolPartInput(part: MCPAppRendererProps['part']): unknown {
  return part.state === 'input-available' || part.state === 'output-available'
    ? part.input
    : undefined;
}

export function MCPAppRenderer({
  part,
  sandbox,
  resource: resourceProp,
  loadResource,
  handlers,
  hostInfo,
  hostContext,
  fallback = null,
}: MCPAppRendererProps) {
  const app = getMCPAppFromToolPart(part);
  const [cachedApp, setCachedApp] = useState<MCPAppMetadata>();
  const [loadedResource, setLoadedResource] = useState<LoadedResourceState>();

  useEffect(() => {
    if (app != null) {
      setCachedApp(previous =>
        previous?.resourceUri === app.resourceUri ? previous : app,
      );
    }
  }, [app?.resourceUri]);

  const appForRender = app ?? cachedApp;

  useEffect(() => {
    if (appForRender == null || resourceProp != null || loadResource == null) {
      return;
    }

    let cancelled = false;
    const resourceUri = appForRender.resourceUri;

    loadResource(appForRender)
      .then(resource => {
        if (!cancelled) {
          setLoadedResource({ resourceUri, resource });
        }
      })
      .catch(error => {
        if (!cancelled) {
          setLoadedResource({
            resourceUri,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appForRender?.resourceUri, loadResource, resourceProp]);

  const loadedResourceForApp =
    loadedResource?.resourceUri === appForRender?.resourceUri
      ? loadedResource
      : undefined;
  const resource = resourceProp ?? loadedResourceForApp?.resource;
  const error = resourceProp == null ? loadedResourceForApp?.error : undefined;

  if (appForRender == null || error != null || resource == null) {
    return fallback;
  }

  return (
    <MCPAppFrame
      app={appForRender}
      resource={resource}
      input={getToolPartInput(part)}
      output={getToolPartOutput(part)}
      sandbox={sandbox}
      handlers={handlers}
      hostInfo={hostInfo}
      hostContext={hostContext}
    />
  );
}
