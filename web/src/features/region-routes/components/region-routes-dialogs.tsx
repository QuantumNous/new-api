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
*/
import { RegionRoutesDeleteDialog } from './region-routes-delete-dialog'
import { RegionRoutesMutateDrawer } from './region-routes-mutate-drawer'
import { useRegionRoutes } from './region-routes-provider'

export function RegionRoutesDialogs() {
  const { open, setOpen, currentRow } = useRegionRoutes()
  const isUpdate = open === 'update'

  return (
    <>
      <RegionRoutesMutateDrawer
        open={open === 'create' || isUpdate}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        currentRow={isUpdate ? currentRow || undefined : undefined}
      />
      <RegionRoutesDeleteDialog />
    </>
  )
}
