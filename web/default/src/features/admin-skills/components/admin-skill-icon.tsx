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
import type { AdminSkill } from '../types'

export function AdminSkillIcon({ skill }: { skill: AdminSkill }) {
  if (skill.icon_url) {
    return (
      <img
        src={skill.icon_url}
        alt=''
        className='size-9 rounded-[7px] border bg-card object-cover'
      />
    )
  }

  return (
    <div className='flex size-9 items-center justify-center rounded-[7px] border bg-card text-sm font-semibold'>
      {skill.name.charAt(0).toUpperCase()}
    </div>
  )
}
