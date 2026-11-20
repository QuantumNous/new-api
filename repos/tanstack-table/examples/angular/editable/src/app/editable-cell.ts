import {
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core'
import { FormsModule } from '@angular/forms'

@Component({
  selector: 'editable-cell',
  template: ` <input [ngModel]="value()" (blur)="blur.emit(modelValue())" /> `,
  standalone: true,
  imports: [FormsModule],
})
export class EditableCell {
  readonly modelValue = signal<unknown>(undefined)

  readonly value = input<unknown>()

  readonly blur = output<unknown>()

  constructor() {
    effect(() => {
      const value = this.value()
      untracked(() => this.modelValue.set(value))
    })
  }
}
