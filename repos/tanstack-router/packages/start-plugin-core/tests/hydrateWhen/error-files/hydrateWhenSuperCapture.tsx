import { Hydrate } from '@tanstack/react-start'
import { idle } from '@tanstack/react-start/hydration'

class Base {
  title = 'super'
}

export class Page extends Base {
  render() {
    return (
      <Hydrate when={idle()}>
        <p>{super.title}</p>
      </Hydrate>
    )
  }
}
