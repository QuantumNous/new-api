import { createLazyRoute } from '../../src'
import HeavyComponent from './mockHeavyDependenciesRoute'

export default function Route(id: string) {
  return createLazyRoute(id)({
    component: HeavyComponent,
  })
}
