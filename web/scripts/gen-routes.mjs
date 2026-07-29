/*
Copyright (C) 2023-2026 QuantumNous

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
// One-off helper: regenerate src/routeTree.gen.ts using the same
// @tanstack/router-generator API that the rspack plugin uses, so the
// typecheck can run without a full production build.
import path from 'node:path'

import { Generator, getConfig } from '@tanstack/router-generator'

const ROOT = process.cwd()

const config = getConfig(
  {
    routesDirectory: './src/routes',
    generatedRouteTree: './src/routeTree.gen.ts',
    target: 'react',
    autoCodeSplitting: false,
  },
  ROOT
)

const generator = new Generator({ config, root: ROOT })
await generator.run()

console.log('Route tree regenerated at', path.resolve('src/routeTree.gen.ts'))
