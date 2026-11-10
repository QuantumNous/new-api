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
 * Which site this browser downloads plugins from. `auto` uses www.newapi.ai
 * and switches to www.newapi.pro for a day when newapi.ai does not answer;
 * `pro` always uses www.newapi.pro, the site for mainland China.
 */
export type PluginSiteChoice = 'auto' | 'pro'

type PluginSiteState = {
  site: PluginSiteChoice
  /** Until this time (ms) `auto` stays on www.newapi.pro. */
  fallbackUntil: number
  setSite: (site: PluginSiteChoice) => void
  rememberFallback: (until: number) => void
}

export const usePluginSiteStore = create<PluginSiteState>()(
  persist(
    (set) => ({
      site: 'auto',
      fallbackUntil: 0,
      // Picking a site by hand forgets an earlier automatic switch.
      setSite: (site) => set({ site, fallbackUntil: 0 }),
      rememberFallback: (until) => set({ fallbackUntil: until }),
    }),
    {
      name: 'plugin-site',
      partialize: (state) => ({
        site: state.site,
        fallbackUntil: state.fallbackUntil,
      }),
    }
  )
)
