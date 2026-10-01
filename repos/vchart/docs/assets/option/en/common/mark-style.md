{{ target: mark-style }}

<!-- ConvertToMarkStyleSpec<T> -->

${markName} graphic element style configuration.

In addition to supporting regular attribute assignment, graphic attribute configurations on graphic element styles also allow callback functions or scale mappings.

- Callback configuration for attributes, with the type definition as follows, where the function parameters are
  - `datum` The data carried by the graphic element
  - `context` Context information
  - `opt` Graphic syntax element information
  - `source` DataSource DataView instance

```ts
export interface IAttributeOpt {
  element: IElement;
  mark: IElement['mark'];
  parent: IElement['mark']['group'];
  states: string[];
}

export type FunctionType<T> = (
  datum: Datum,
  context: IModelMarkAttributeContext,
  opt?: IAttributeOpt,
  source?: DataView
) => T;
```

For example, in the following instance, we want to configure different colors for the bars based on different values:

```ts
bar: {
  style: {
    fill: datum => {
      if (datum.y > 10) {
        return {
          gradient: 'linear',
          x0: 0.5,
          y0: 0,
          x1: 0.5,
          y1: 1,
          stops: [
            {
              offset: 0,
              color: '#86DF6C'
            },
            {
              offset: 1,
              color: '#468DFF'
            }
          ]
        };
      }

      return '#ccc';
    };
  }
}
```

- Scale mapping configuration

{{ use: common-visual-scale}}