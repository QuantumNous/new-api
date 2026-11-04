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
// Our own translation keys, one file per language, laid over the upstream
// locale files. Keeping them apart lets an upstream sync take the locale file
// unchanged: nothing of ours lives there, so nothing of ours can be overwritten.
// Admin text overrides (/api/hw/text-overrides) are applied later at runtime
// and still win. tr has no hw file: upstream has no tr.json, so that file is
// ours from top to bottom.
import en from './en.json'
import fr from './fr.json'
import ja from './ja.json'
import ru from './ru.json'
import vi from './vi.json'
import zhTW from './zh-TW.json'
import zh from './zh.json'

const hwByLanguage: Record<string, Record<string, string>> = {
  en,
  zhCN: zh,
  zhTW,
  fr,
  ru,
  ja,
  vi,
}

/** The upstream bundle with our own keys laid over it, for one language. */
export function withHwText<T extends { translation: Record<string, string> }>(
  language: string,
  upstream: T
): T {
  const hw = hwByLanguage[language]
  if (!hw) return upstream
  return { ...upstream, translation: { ...upstream.translation, ...hw } }
}
