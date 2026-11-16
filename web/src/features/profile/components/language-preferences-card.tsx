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
import { TitledCard } from '@/components/ui/titled-card'
import type { UserProfile } from '../types'

type LanguagePreferencesCardProps = {
  profile: UserProfile | null
  onProfileUpdate: () => void
}

export function LanguagePreferencesCard(_props: LanguagePreferencesCardProps) {
  return (
    <TitledCard title='Interface language' description='Orbit is available in English.' disableHoverEffect>
      <p className='text-muted-foreground text-sm'>English is used for the interface, account emails, and gateway messages. Saved language preferences do not change this setting.</p>
    </TitledCard>
  )
}
