import { Routes } from '@angular/router'
import { RowVirtualizerDynamic } from './row-virtualizer-dynamic.component'
import { GridVirtualizerDynamic } from './grid-virtualizer-dynamic.component'
import { ColumnVirtualizerDynamic } from './column-virtualizer-dynamic.component'
import { RowVirtualizerDynamicWindow } from './row-virtualizer-dynamic-window.component'

export const routes: Routes = [
  {
    path: '',
    component: RowVirtualizerDynamic,
  },
  {
    path: 'window-list',
    component: RowVirtualizerDynamicWindow,
  },
  {
    path: 'columns',
    component: ColumnVirtualizerDynamic,
  },
  {
    path: 'grid',
    component: GridVirtualizerDynamic,
  },
]
