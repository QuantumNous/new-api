import '@analogjs/vitest-angular/setup-zone'
import '@testing-library/jest-dom/vitest'

import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing'
import { getTestBed } from '@angular/core/testing'

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
)
