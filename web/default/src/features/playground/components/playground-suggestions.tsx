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
import {
  BarChartIcon,
  BoxIcon,
  CodeSquareIcon,
  GraduationCapIcon,
  NotepadTextIcon,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { getSuggestionDisplayState } from '../lib'

type PlaygroundSuggestion = {
  icon: LucideIcon | null
  text: string
  color?: string
}

type PlaygroundSuggestionsProps = {
  onSelect: (suggestion: string) => void
}

const suggestions = [
  { icon: BarChartIcon, text: 'Analyze data', color: '#76d0eb' },
  { icon: BoxIcon, text: 'Surprise me', color: '#76d0eb' },
  { icon: NotepadTextIcon, text: 'Summarize text', color: '#ea8444' },
  { icon: CodeSquareIcon, text: 'Code', color: '#6c71ff' },
  { icon: GraduationCapIcon, text: 'Get advice', color: '#76d0eb' },
  { icon: null, text: 'More' },
] satisfies PlaygroundSuggestion[]

export function PlaygroundSuggestions({
  onSelect,
}: PlaygroundSuggestionsProps) {
  const { t } = useTranslation()

  return (
    <Suggestions>
      {suggestions.map(({ icon: Icon, text, color }) => {
        const suggestion = t(text)
        const { className } = getSuggestionDisplayState(text)

        return (
          <Suggestion
            className={className}
            key={text}
            onClick={onSelect}
            suggestion={suggestion}
          >
            {Icon && <Icon aria-hidden='true' size={16} style={{ color }} />}
            {suggestion}
          </Suggestion>
        )
      })}
    </Suggestions>
  )
}
