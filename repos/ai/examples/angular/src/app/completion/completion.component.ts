import { Component } from '@angular/core';
import { Completion } from '@ai-sdk/angular';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-completion',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container">
      <div class="input-section">
        <textarea
          [(ngModel)]="completion.input"
          name="prompt"
          placeholder="Enter your prompt..."
          rows="4"
          class="prompt-input"
        ></textarea>

        <div class="button-group">
          <button
            (click)="completion.complete(completion.input)"
            [disabled]="completion.loading"
            class="generate-btn"
          >
            {{ completion.loading ? 'Generating...' : 'Generate' }}
          </button>

          @if (completion.loading) {
            <button (click)="completion.stop()" class="stop-btn">Stop</button>
          }
        </div>
      </div>

      @if (completion.completion) {
        <div class="result-section">
          <h4>Result:</h4>
          <pre class="result-text">{{ completion.completion }}</pre>
        </div>
      }

      @if (completion.error) {
        <div class="error">{{ completion.error.message }}</div>
      }
    </div>
  `,
  styleUrl: './completion.component.css',
})
export class CompletionComponent {
  public completion = new Completion({
    api: '/api/completion',
    streamProtocol: 'text',
    onFinish: (prompt, completion) => {
      console.log('Completed:', { prompt, completion });
    },
  });
}
