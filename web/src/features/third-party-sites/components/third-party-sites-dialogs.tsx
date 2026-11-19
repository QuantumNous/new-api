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
import { ThirdPartySiteDeleteDialog } from './third-party-site-delete-dialog'
import { ThirdPartySiteMutateDialog } from './third-party-site-mutate-dialog'
import { useThirdPartySites } from './third-party-sites-provider'

export function ThirdPartySitesDialogs() {
  const { open, setOpen, currentRow } = useThirdPartySites()

  return (
    <>
      <ThirdPartySiteMutateDialog
        open={open === 'create'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
      />
      {currentRow && (
        <ThirdPartySiteMutateDialog
          key={currentRow.id}
          open={open === 'update'}
          onOpenChange={(isOpen) => !isOpen && setOpen(null)}
          currentRow={currentRow}
        />
      )}
      <ThirdPartySiteDeleteDialog />
    </>
  )
}
