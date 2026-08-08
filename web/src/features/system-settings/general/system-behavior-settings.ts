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
export type FlatSystemBehaviorOptions = {
  DefaultCollapseSidebar: boolean
  DemoSiteEnabled: boolean
  SelfUseModeEnabled: boolean
  'openai_batch_setting.enabled': boolean
}

export type SystemBehaviorFormValues = {
  DefaultCollapseSidebar: boolean
  DemoSiteEnabled: boolean
  SelfUseModeEnabled: boolean
  openai_batch_setting: {
    enabled: boolean
  }
}

type SystemBehaviorOptionUpdate = {
  key: keyof FlatSystemBehaviorOptions
  value: boolean
}

export function toSystemBehaviorFormValues(
  options: FlatSystemBehaviorOptions
): SystemBehaviorFormValues {
  return {
    DefaultCollapseSidebar: options.DefaultCollapseSidebar,
    DemoSiteEnabled: options.DemoSiteEnabled,
    SelfUseModeEnabled: options.SelfUseModeEnabled,
    openai_batch_setting: {
      enabled: options['openai_batch_setting.enabled'],
    },
  }
}

export function getSystemBehaviorOptionUpdates(
  values: SystemBehaviorFormValues,
  baseline: FlatSystemBehaviorOptions
): SystemBehaviorOptionUpdate[] {
  const normalized: FlatSystemBehaviorOptions = {
    DefaultCollapseSidebar: values.DefaultCollapseSidebar,
    DemoSiteEnabled: values.DemoSiteEnabled,
    SelfUseModeEnabled: values.SelfUseModeEnabled,
    'openai_batch_setting.enabled': values.openai_batch_setting.enabled,
  }

  return (Object.keys(normalized) as Array<keyof FlatSystemBehaviorOptions>)
    .filter((key) => normalized[key] !== baseline[key])
    .map((key) => ({ key, value: normalized[key] }))
}
