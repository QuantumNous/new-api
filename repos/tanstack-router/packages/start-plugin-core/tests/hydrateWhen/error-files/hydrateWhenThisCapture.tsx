import { Hydrate } from '@tanstack/react-start'
import { idle } from '@tanstack/react-start/hydration'

export class Page {
  title = 'this'

  render() {
    return (
      <Hydrate when={idle()}>
        <p>{this.title}</p>
      </Hydrate>
    )
  }
}
