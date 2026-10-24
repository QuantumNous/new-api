// This folder disables `skipLibCheck` to check the public types of @rsbuild/core.
import '@rsbuild/core/types';
import { createRsbuild, defineConfig } from '@rsbuild/core';
import { pluginBabel } from '@rsbuild/plugin-babel';
import { pluginLess } from '@rsbuild/plugin-less';
import { pluginPreact } from '@rsbuild/plugin-preact';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSolid } from '@rsbuild/plugin-solid';

const plugins = [pluginBabel(), pluginLess(), pluginPreact(), pluginReact(), pluginSolid()];

createRsbuild({
  config: {
    plugins,
  },
});

defineConfig({ plugins });
