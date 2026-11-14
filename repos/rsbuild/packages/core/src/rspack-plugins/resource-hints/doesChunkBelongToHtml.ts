/**
 * This method is modified based on source found in
 * https://github.com/vuejs/preload-webpack-plugin/blob/master/src/lib/does-chunk-belong-to-html.js
 *
 * Copyright 2018 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Chunk, ChunkGroup, Compilation } from '@rspack/core';
import type { HtmlRspackPlugin, ResourceHintsOptions } from '../../types';

interface DoesChunkBelongToHtmlOptions {
  chunk: Chunk;
  compilation?: Compilation;
  htmlPluginData: HtmlRspackPlugin.BeforeAssetTagGenerationData;
  pluginOptions?: ResourceHintsOptions;
}

function recursiveChunkGroup(
  chunkGroup: ChunkGroup,
  visited = new Set<ChunkGroup>(),
): (string | undefined)[] {
  // check if the chunkGroup has been visited to prevent circular reference
  if (visited.has(chunkGroup)) {
    return [];
  }
  visited.add(chunkGroup);

  const parents = chunkGroup.getParents();
  if (!parents.length) {
    // EntryPoint
    return [chunkGroup.name];
  }

  return parents.flatMap((chunkParent) => recursiveChunkGroup(chunkParent, visited));
}

export function recursiveChunkEntryNames(chunk: Chunk): string[] {
  const isChunkName = (name: string | undefined): name is string => Boolean(name);

  const [...chunkGroups] = chunk.groupsIterable;
  const names = chunkGroups
    .flatMap((chunkGroup) => recursiveChunkGroup(chunkGroup))
    .filter(isChunkName);

  return [...new Set(names)];
}

// modified from html-rspack-plugin/index.js `filterChunks`
function isChunksFiltered(
  chunkName: string,
  includeChunks?: string[] | 'all',
  excludeChunks?: string[],
): boolean {
  // Skip if the chunks should be filtered and the given chunk was not added explicity
  if (Array.isArray(includeChunks) && includeChunks.indexOf(chunkName) === -1) {
    return false;
  }
  // Skip if the chunks should be filtered and the given chunk was excluded explicity
  if (Array.isArray(excludeChunks) && excludeChunks.indexOf(chunkName) !== -1) {
    return false;
  }
  // Add otherwise
  return true;
}

export function doesChunkBelongToHtml({
  chunk,
  htmlPluginData,
}: DoesChunkBelongToHtmlOptions): boolean {
  const { options } = htmlPluginData.plugin;

  // find the chunk belongs
  const chunkNames = recursiveChunkEntryNames(chunk);

  return chunkNames.some((chunkName) =>
    isChunksFiltered(chunkName, options?.chunks, options?.excludeChunks),
  );
}
