import { Component } from '@angular/core';
import { StructuredObject } from '@ai-sdk/angular';
import { z } from 'zod';
import { FormsModule } from '@angular/forms';

const schema = z.object({
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
});

@Component({
  selector: 'app-structured-object',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div>
      <textarea
        [(ngModel)]="input"
        name="content"
        placeholder="Enter content to analyze..."
        rows="4"
        class="prompt-input"
      >
      </textarea>

      <button
        (click)="analyze()"
        [disabled]="structuredObject.loading"
        class="generate-btn"
      >
        {{ structuredObject.loading ? 'Analyzing...' : 'Analyze' }}
      </button>

      @if (structuredObject.object) {
        <div class="result-section">
          <h4>Analysis:</h4>
          <div class="result-text">
            <div><strong>Title:</strong> {{ structuredObject.object.title }}</div>
            <div>
              <strong>Summary:</strong> {{ structuredObject.object.summary }}
            </div>
            <div>
              <strong>Tags:</strong>
              {{ structuredObject.object.tags?.join(', ') }}
            </div>
            <div>
              <strong>Sentiment:</strong>
              {{ structuredObject.object.sentiment }}
            </div>
          </div>
        </div>
      }

      @if (structuredObject.error) {
        <div class="error">{{ structuredObject.error.message }}</div>
      }
    </div>
  `,
  styleUrl: './structured-object.component.css',
})
export class StructuredObjectComponent {
  input = '';

  structuredObject = new StructuredObject({
    api: '/api/analyze',
    schema,
    onFinish: ({ object, error }) => {
      if (error) {
        console.error('Schema validation failed:', error);
      } else {
        console.log('Generated object:', object);
      }
    },
  });

  async analyze() {
    if (!this.input.trim()) return;
    await this.structuredObject.submit(this.input);
  }
}
