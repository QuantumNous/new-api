import { ChangeDetectionStrategy, Component } from '@angular/core'

import { ColumnVirtualizerFixed } from './column-virtualizer-fixed.component'
import { GridVirtualizerFixed } from './grid-virtualizer-fixed.component'
import { RowVirtualizerFixed } from './row-virtualizer-fixed.component'

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColumnVirtualizerFixed, GridVirtualizerFixed, RowVirtualizerFixed],
  template: `
    <p>
      These components are using <strong>fixed</strong> sizes. This means that
      every element's dimensions are hard-coded to the same value and never
      change.
    </p>

    <row-virtualizer-fixed />
    <column-virtualizer-fixed />
    <grid-virtualizer-fixed />
  `,
})
export class AppComponent {}
