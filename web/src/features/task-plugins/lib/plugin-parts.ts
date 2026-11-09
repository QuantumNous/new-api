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
import type { TaskPluginMeta, TaskPluginParts } from '../types'

/**
 * The parts a plugin has, with the fallbacks for older servers: a missing
 * `task` counts as a task part, a missing `provider` follows `meta.relay`, and
 * a missing credential hook or request processing part counts as absent.
 */
export function resolvePluginParts(
  item: TaskPluginParts & { meta: Pick<TaskPluginMeta, 'relay'> }
): Required<TaskPluginParts> {
  return {
    task: item.task ?? true,
    provider: item.provider ?? Boolean(item.meta.relay?.length),
    login: item.login ?? false,
    refresh: item.refresh ?? false,
    transform: item.transform ?? false,
  }
}
