import { ChangeDetectionStrategy, Component } from '@angular/core'
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router'

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <nav style="margin-bottom: 16px">
      <a routerLink="/scroll" routerLinkActive="active">Scroll</a>
      |
      <a routerLink="/smooth-scroll" routerLinkActive="active">Smooth scroll</a>
      |
      <a routerLink="/measure-element" routerLinkActive="active"
        >Measure element</a
      >
      |
      <a routerLink="/stale-index" routerLinkActive="active">Stale index</a>
    </nav>

    <router-outlet />
  `,
})
export class AppComponent {}
