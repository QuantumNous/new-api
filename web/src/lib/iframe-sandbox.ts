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
const SCRIPT_APP_SANDBOX =
  'allow-scripts allow-forms allow-popups allow-presentation'

export type ScriptAppIframeProps = {
  sandbox: string
  src: string | undefined
}

export function getScriptAppIframeProps(src?: string): ScriptAppIframeProps {
  if (!src) return { sandbox: SCRIPT_APP_SANDBOX, src: undefined }

  try {
    const target =
      typeof window === 'undefined'
        ? new URL(src)
        : new URL(src, window.location.href)
    if (target.protocol === 'http:' || target.protocol === 'https:') {
      return { sandbox: SCRIPT_APP_SANDBOX, src }
    }
  } catch {
    // Invalid targets remain unloaded.
  }

  return { sandbox: SCRIPT_APP_SANDBOX, src: undefined }
}
