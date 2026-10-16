import { ChangeDetectionStrategy, Component } from '@angular/core'

import { ColumnVirtualizerVariable } from './column-virtualizer-variable.component'
import { GridVirtualizerVariable } from './grid-virtualizer-variable.component'
import { RowVirtualizerVariable } from './row-virtualizer-variable.component'

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ColumnVirtualizerVariable,
    GridVirtualizerVariable,
    RowVirtualizerVariable,
  ],
  template: `
    <p>
      These components are using <strong>variable</strong> sizes. This means
      that each element has a unique, but knowable dimension at render time.
    </p>

    <row-virtualizer-variable [rows]="rows" />
    <column-virtualizer-variable [columns]="columns" />
    <grid-virtualizer-variable [columns]="columns" [rows]="rows" />
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
