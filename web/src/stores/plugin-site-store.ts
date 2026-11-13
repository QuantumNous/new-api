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
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Which site this browser downloads plugins from: `ai` is the main site
 * www.newapi.ai, `pro` the backup site www.newapi.pro. Only the user changes it.
 */
export type PluginSiteChoice = 'ai' | 'pro'

type PluginSiteState = {
  site: PluginSiteChoice
  setSite: (site: PluginSiteChoice) => void
}

export const usePluginSiteStore = create<PluginSiteState>()(
  persist(
    (set) => ({
      site: 'ai',
      setSite: (site) => set({ site }),
    }),
    {
      name: 'plugin-site',
      version: 1,
      partialize: (state) => ({ site: state.site }),
      // Version 0 also stored `auto`, which switched sites by itself; it now
      // reads as the main site.
      migrate: (persisted) => ({
        site:
          (persisted as { site?: unknown } | null)?.site === 'pro'
            ? 'pro'
            : 'ai',
      }),
    }
  )
)
