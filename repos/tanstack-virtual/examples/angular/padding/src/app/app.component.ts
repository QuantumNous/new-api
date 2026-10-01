import { ChangeDetectionStrategy, Component } from '@angular/core'

import { ColumnVirtualizerPadding } from './column-virtualizer-padding.component'
import { GridVirtualizerPadding } from './grid-virtualizer-padding.component'
import { RowVirtualizerPadding } from './row-virtualizer-padding.component'

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ColumnVirtualizerPadding,
    GridVirtualizerPadding,
    RowVirtualizerPadding,
  ],
  template: `
    <p>
      These components are using <strong>dynamic</strong> sizes. This means that
      each element's exact dimensions are unknown when rendered. An estimated
      dimension is used to get an a initial measurement, then this measurement
      is readjusted on the fly as each element is rendered. Each component has
      padding at the beginning and end of its scroll container.
    </p>

    <row-virtualizer-padding [rows]="rows" />
    <column-virtualizer-padding [columns]="columns" />
    <grid-virtualizer-padding [columns]="columns" [rows]="rows" />
  `,
  styles: [],
})
export class AppComponent {
  rows = new Array(10000)
    .fill(true)
    .map(() => 25 + Math.round(Math.random() * 100))

  columns = new Array(10000)
    .fill(true)
    .map(() => 75 + Math.round(Math.random() * 100))
}
