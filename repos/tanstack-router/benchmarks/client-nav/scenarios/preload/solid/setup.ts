import { createScenarioSetup } from '../../harness'
import { assertStepResult, scenarioSteps } from '../shared'
import type * as App from './src/main'

const appModulePath = './dist/app.js'
const { mountTestApp } = (await import(
  /* @vite-ignore */ appModulePath
)) as typeof App

export function setup() {
  return createScenarioSetup({
    frameworkLabel: 'Solid',
    mount: mountTestApp,
    steps: scenarioSteps,
    assertAfterStep: assertStepResult,
  })
}
