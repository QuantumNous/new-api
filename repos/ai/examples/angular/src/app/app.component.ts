import { Component, signal } from '@angular/core';
import { ChatComponent } from './chat/chat.component';
import { CompletionComponent } from './completion/completion.component';
import { StructuredObjectComponent } from './structured-object/structured-object.component';

type TabType = 'chat' | 'completion' | 'structured-object';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChatComponent, CompletionComponent, StructuredObjectComponent],
  template: `
    <main class="container">
      <nav class="tabs">
        <button
          class="tab"
          [class.active]="activeTab() === 'chat'"
          (click)="activeTab.set('chat')"
        >
          Chat
        </button>
        <button
          class="tab"
          [class.active]="activeTab() === 'completion'"
          (click)="activeTab.set('completion')"
        >
          Completion
        </button>
        <button
          class="tab"
          [class.active]="activeTab() === 'structured-object'"
          (click)="activeTab.set('structured-object')"
        >
          Structured Object
        </button>
      </nav>

      <div class="content">
        @switch (activeTab()) {
          @case ('chat') {
            <app-chat />
          }
          @case ('completion') {
            <app-completion />
          }
          @case ('structured-object') {
            <app-structured-object />
          }
        }
      </div>
    </main>
  `,
  styles: `
    :host {
      display: block;
      height: 100vh;
    }

    .container {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-width: 800px;
      margin: 0 auto;
      padding: 10rem;
      box-sizing: border-box;
    }

    .tabs {
      display: flex;
      border-bottom: 1px solid #e1e5e9;
      margin-bottom: 2rem;
    }

    .tab {
      background: none;
      border: none;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .tab:hover {
      color: #334155;
    }

    .tab.active {
      color: #0066cc;
      border-bottom-color: #0066cc;
    }

    .content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
  `,
})
export class AppComponent {
  activeTab = signal<TabType>('chat');
}
