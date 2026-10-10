# Angular Virtual

Efficiently virtualize only the visible DOM nodes within massive scrollable elements using Angular, while maintaining complete control over markup and styles.

# Quick Start

> NOTE: Angular Virtual requires Angular 19.

1. Install `@tanstack/angular-virtual`

   ```bash
   $ npm i @tanstack/angular-virtual
   ```

   or

   ```bash
   $ pnpm add @tanstack/angular-virtual
   ```

   or

   ```bash
   $ yarn add @tanstack/angular-virtual
   ```

   or

   ```bash
   $ bun add @tanstack/angular-virtual
   ```

2. Inject a virtualizer

   `@tanstack/angular-virtual` utilizes a helper function `injectVirtualizer` to create the virtualizer and integrate it with the component lifecycle:

   ```ts
   import { Component, ElementRef, viewChild } from '@angular/core'
   import { injectVirtualizer } from '@tanstack/angular-virtual'

   @Component({
     selector: 'my-virtualized-list',
     template: `
       <div
         #scrollElement
         style="height: 400px; border: 1px solid gray; overflow: auto;"
       >
         <div
           style="position: relative; width: 100%;"
           [style.height.px]="virtualizer.getTotalSize()"
         >
           @for (row of virtualizer.getVirtualItems(); track row.index) {
             <div
               style="position: absolute; top: 0; left: 0; width: 100%; height: 35px"
               [style.transform]="'translateY(' + row.start + 'px)'"
             >
               Row {{ row.index }}
             </div>
           }
         </div>
       </div>
     `,
   })
   export class MyVirtualizedList {
     scrollElement = viewChild<ElementRef<HTMLDivElement>>('scrollElement')

     virtualizer = injectVirtualizer(() => ({
       scrollElement: this.scrollElement(),
       count: 1000,
       estimateSize: () => 35,
       overscan: 5,
     }))
   }
   ```

   Note that a [ViewChild](https://angular.dev/api/core/viewChild) is used to get a reference to the scrolling container to allow the virtualizer to interact with it. The adapter will automatically unwrap the [ElementRef](https://angular.dev/api/core/ElementRef) for you.

   You can also create a virtualizer that attaches to the Window with `injectWindowVirtualizer`:

   ```ts
   import { Component } from '@angular/core'
   import { injectWindowVirtualizer } from '@tanstack/angular-virtual'

   @Component({
     selector: 'my-window-virtualized-list',
     template: `
       <div
         style="position: relative; width: 100%;"
         [style.height.px]="virtualizer.getTotalSize()"
       >
         @for (row of virtualizer.getVirtualItems(); track row.index) {
           <div
             style="position: absolute; top: 0; left: 0; width: 100%; height: 35px"
             [style.transform]="'translateY(' + row.start + 'px)'"
           >
             Row {{ row.index }}
           </div>
         }
       </div>
     `,
   })
   export class MyWindowVirtualizedList {
     virtualizer = injectWindowVirtualizer(() => ({
       count: 1000,
       estimateSize: () => 35,
       overscan: 5,
     }))
   }
   ```

3. If you need to update options on your virtualizer dynamically, make sure to use signals.

   ```ts
   import { Component, input } from '@angular/core'
   import { injectVirtualizer } from '@tanstack/angular-virtual'

   @Component({...})
   export class MyVirtualizedList {
     items = input<Array<string>>()

     virtualizer = injectVirtualizer(() => ({
       scrollElement: this.scrollElement(),
       count: this.items().length,
       estimateSize: () => 35,
       overscan: 5,
     }))
   }
   ```

For more examples and detailed usage, visit the [official documentation](https://tanstack.com/virtual/latest).
