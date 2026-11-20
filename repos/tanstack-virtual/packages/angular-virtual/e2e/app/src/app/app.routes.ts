import type { Routes } from '@angular/router'
import { MeasureElementComponent } from './measure-element.component'
import { SmoothScrollComponent } from './smooth-scroll.component'
import { ScrollComponent } from './scroll.component'
import { StaleIndexComponent } from './stale-index.component'

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'scroll',
  },
  {
    path: 'scroll',
    component: ScrollComponent,
  },
  {
    path: 'smooth-scroll',
    component: SmoothScrollComponent,
  },
  {
    path: 'measure-element',
    component: MeasureElementComponent,
  },
  {
    path: 'stale-index',
    component: StaleIndexComponent,
  },
]
