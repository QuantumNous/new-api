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
import { MarketModelsDeleteDialog } from './market-models-delete-dialog'
import { MarketModelsMutateDrawer } from './market-models-mutate-drawer'
import { useMarketModels } from './market-models-provider'

export function MarketModelsDialogs() {
  const { open, setOpen, currentRow } = useMarketModels()
  const isUpdate = open === 'update'

  return (
    <>
      <MarketModelsMutateDrawer
        open={open === 'create' || isUpdate}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        currentRow={isUpdate ? currentRow || undefined : undefined}
      />
      <MarketModelsDeleteDialog />
    </>
  )
}
