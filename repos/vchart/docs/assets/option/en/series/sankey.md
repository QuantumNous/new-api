{{ target: series-sankey }}

<!-- ISankeySeriesSpec -->

**Sankey Diagram Series**

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  isHierarchy = true,
  seriesType = 'sankey',
  seriesMarks = ['node','link'],
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  preset = 'growIn' + '|' + 'fadeIn',
  defaultPreset = 'growIn'
) }}

#${prefix} node(Object)

Node style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'node'
) }}

{{ use: mark-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} link(Object)

Edge configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'link'
) }}

{{ use: mark-link-path(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} categoryField(string)

Node name field.

#${prefix} valueField(string)

Weight field between nodes.

#${prefix} sourceField(string)

Source node data field.
No need to provide in hierarchical data.

#${prefix} targetField(string)

Target node data field.
No need to provide in hierarchical data.

#${prefix} direction(string) = 'horizontal'

Chart layout direction.

Optional:

- `vertical`
- `horizontal`

#${prefix} nodeAlign(string)
Node alignment type, calculated based on node depth, determines which layer the node is in:

- For horizontally laid out Sankey diagrams, used to calculate node x-coordinates
- For vertically laid out Sankey diagrams, used to calculate node y-coordinates

Options:

- `left`
- `right`
- `center`
- `justify`
- `start`
- `end`

#${prefix} crossNodeAlign(string)

Supported since version **1.12.4**

For horizontally laid out Sankey diagrams, sets the Y-coordinate alignment of nodes:

- 'start' - 'Top alignment'
- 'end' - 'Bottom alignment'
- 'middle' - 'Center alignment'
- 'parent' - 'Parent node alignment', supported since version **1.12.14**

For vertically laid out Sankey diagrams, sets the X-coordinate alignment of nodes:

- 'start' - 'Left alignment'
- 'end' - 'Right alignment'
- 'middle' - 'Center alignment'
- 'parent' - 'Parent node alignment', supported since version **1.12.14**

#${prefix} inverse(boolean)

Since version **1.12.2** is supported
Reverse display, nodes and edges are displayed in reverse
For Sankey diagrams with a `horizontal` layout direction, nodes are displayed from left to right by default; setting `inverse: true` displays nodes from right to left;
For Sankey diagrams with a `vertical` layout direction, nodes are displayed from top to bottom by default; setting `inverse: true` displays nodes from bottom to top;

#${prefix} nodeGap(number)

Gap size between two nodes in the same layer.

#${prefix} nodeWidth(string|number|Function)

The width of each node, supporting three values:

- 1. Percentage string, e.g.: { nodeWidth: '12%' }
- 2. Simple number with 'px' as a unit, e.g.: { nodeWidth: 20 }
- 3. Function, specifying nodeWidth through custom calculation

#${prefix} linkWidth(number|Function)

Edge width.
Unit px.

#${prefix} minStepWidth(number)

Minimum width sum of nodes and edges.

#${prefix} minNodeHeight(number)

Minimal size of nodes when data is not zero or empty.

- This configuration can be used to avoid too thin nodes when data is too small.
- Suggested to be less than 5px.

#${prefix} maxNodeHeight(number)

Supported since version **1.12.14**

Maximum size of nodes when data is not zero or empty.

#${prefix} minLinkHeight(number)

Minimal size of edges when data is not zero or empty.

- This configuration can be used to avoid too thin links when data is too small.
- Suggested to be less than 5px.
- When both `minNodeHeight` and `minLinkHeight` options are specified, this option should be less than `minNodeHeight`.
  #${prefix} maxLinkHeight(number)

Supported since version **1.12.14**

Maximum size of edges when data is not zero or empty.

- When both `minNodeHeight` and `minLinkHeight` options are specified, this option should be less than `minNodeHeight`.

#${prefix} iterations(number)

Number of layout iterations.

#${prefix} nodeKey(string|number|Function)

Key value for parsing nodes.

#${prefix} linkSortBy(Function)

Sort edges by this function.

#${prefix} nodeSortBy(Function)

Sort nodes by this function.

#${prefix} setNodeLayer(Function)

Customize the assigned node layer.

#${prefix} dropIsolatedNode(Boolean)

Starting from version `1.11.0`
Whether to drop isolated nodes

#${prefix} nodeHeight(number | function)

Starting from version `1.11.0`
Set the specified height for nodes (corresponding to width when the layout direction is `vertical`)

#${prefix} linkHeight(number | function)

Starting from version `1.11.0`
Set the specified height for edges (corresponding to width when the layout direction is `vertical`)

#${prefix} equalNodeHeight(boolean)

Starting from version `1.11.0`
Set a uniform height for all nodes (corresponding to width when the layout direction is `vertical`), calculated based on the canvas height and the number of nodes;

#${prefix} linkOverlap('start' | 'center' | 'end')

Starting from version `1.11.0`
When this configuration is set, different edges under the same node are laid out in an overlapping manner:

- 'start' Overlap at the starting point of all edges and nodes
- 'center' Overlap at the middle point of all edges and nodes
- 'end' Overlap at the end point of all edges and nodes

#${prefix} emphasis(Object)

Interactive linkage configuration.

##${prefix} enable(boolean) = true

Enable interaction.

##${prefix} trigger(string) = 'click'

Interaction trigger type.

Available:

- `click`
- `hover`

##${prefix} effect(string) = 'self'

Interactive linkage effect.
Sankey Diagram provides 3 interaction linkage effects on nodes:

- `self`: Only highlight the current node.
- `adjacency`: Highlight the upstream and downstream nodes and associated edges of the current node, and dim other graphic elements.
- `related`: Highlight the nodes and edges on the entire path related to the current node, and dim other graphic elements.

#${prefix} overflow(string)

Supported since version **1.13.0**

When the width of nodes or edges is specified, this property can be configured to automatically generate scroll bars if the width exceeds the chart region width or the height exceeds the chart region height.

Supported configurations are as follows:

- 'scroll': Automatically generate scroll bars based on the x and y directions.
- 'hidden': Do not generate scroll bars by default.
- 'scroll-x': Automatically generate scroll bars in the x direction.
- 'scroll-y': Automatically generate scroll bars in the y direction.
