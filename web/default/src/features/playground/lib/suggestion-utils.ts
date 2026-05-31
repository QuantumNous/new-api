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
const MORE_SUGGESTION_TEXT = 'More'
const SUGGESTION_CLASS_NAME = 'text-xs font-normal sm:text-sm'
const MOBILE_HIDDEN_SUGGESTION_CLASS_NAME = `${SUGGESTION_CLASS_NAME} hidden sm:flex`

type SuggestionDisplayState = {
  className: string
}

export function getSuggestionDisplayState(
  text: string
): SuggestionDisplayState {
  return {
    className:
      text === MORE_SUGGESTION_TEXT
        ? MOBILE_HIDDEN_SUGGESTION_CLASS_NAME
        : SUGGESTION_CLASS_NAME,
  }
}
