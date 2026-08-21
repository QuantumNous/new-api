import { Component } from '@angular/core'
import { RouterLink, RouterOutlet } from '@angular/router'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: `
    <p>
      These components are using <strong>dynamic</strong> sizes. This means that
      each element's exact dimensions are unknown when rendered. An estimated
      dimension is used to get an a initial measurement, then this measurement
      is readjusted on the fly as each element is rendered.
    </p>

    <ul>
      <li><a routerLink="./">List</a></li>
      <li><a routerLink="./window-list">List - window as scroller</a></li>
      <li><a routerLink="./columns">Column</a></li>
      <li><a routerLink="./grid">Grid</a></li>
    </ul>

    <router-outlet />
  `,
  styles: [],
})
export class AppComponent {}
