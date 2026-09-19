# How to get the corresponding data point information in a click event using @visactor/react-vchart?

## Question Description

How to implement a bar chart like [this example](https://www.visactor.io/vchart/demo/bar-chart/basic-column) in React using @visactor/react-vchart? How can I bind a click event? Is it possible to retrieve the corresponding data information from the click event?

![bar chart](/vchart/faq/32-0.png)

## Solution

[The tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react) for using the React wrapper library `react-vchart` provided by VChart can be referred to. `react-vchart` supports two types of components:

- When using the `VChart` component, events can be bound using the `onAbc` format. [The supported event names can be referred to](https://www.visactor.io/vchart/api/API/event).
- When implementing components similar to `LineChart` using semantic components, such as Line, events can be bound to props using the `onAbc` format. [The supported event names can be referred to.](https://www.visactor.io/vchart/api/API/event)

## Code Example

```
import { VChart, VChartProps } from "@visactor/react-vchart";
import { Component } from "react";

export interface BarChartProps {
  colors?: string[];
  data: any[];
}

export class BarChart extends Component<BarChartProps> {
  state: { active: any } = {
    active: null
  };
  parseSpec = () => {
    const colors = this.props.colors;
    return {
      type: "bar",
      data: [
        {
          id: "barData",
          values: this.props.data
        }
      ],
      xField: "name",
      yField: "value",
      color: {
        type: "ordinal",
        domain: [],
        range: colors
      }
    } as VChartProps["spec"];
  };

  handleClick = (e: any) => {
    this.setState({ active: e.datum });
  };

  render() {
    return (
      <>
        <p>{`active bar: ${this.state.active?.name ?? ""}`}</p>
        <VChart spec={this.parseSpec()} onClick={this.handleClick} />
      </>
    );
  }
}
```

## Results

- [Online demo](https://codesandbox.io/s/visactor-vchart-react-event-q6jzwv)

![bar chart](/vchart/faq/32-1.png)

## Related Documentation

- [react-vchart Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/react)
- [github](https://github.com/VisActor/VChart)
