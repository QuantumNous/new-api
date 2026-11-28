import { NodeModuleClientWidget } from 'rsc-client-pkg'

export function RscClientPkgContent() {
  return (
    <section data-testid="rsc-node-module-client-server">
      <h2 data-testid="rsc-node-module-client-server-title">
        Server rendered package boundary
      </h2>
      <NodeModuleClientWidget label="Node module clicks" />
    </section>
  )
}
