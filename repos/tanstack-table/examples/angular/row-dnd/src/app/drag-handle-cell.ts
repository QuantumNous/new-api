import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core'
import { FormsModule } from '@angular/forms'
import { CdkDragHandle } from '@angular/cdk/drag-drop'

@Component({
  selector: 'editable-cell',
  template: ` <button cdkDragHandle>🟰</button> `,
  standalone: true,
  imports: [CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DragHandleCell {}
