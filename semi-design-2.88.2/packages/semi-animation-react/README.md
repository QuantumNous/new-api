> React animation library based on `@douyinfe/semi-animation`.

The transition animation effects of all components in `@douyinfe/semi-ui` are implemented based on this animation library, such as: Modal, Tooltip, Collapse and other component content display and exit effects.

## Install

```sh
npm install @douyinfe/semi-animation-react
```

## Usage

### Transition Component

It is used to realize the animation effect of the component [show and exit]. Examples are as follows:

```jsx
import { Transition } from "@douyinfe/semi-animation-react";
import { useState } from "react";

export default function App() {
  const [visible, setVisible] = useState(false);
  return (
    <div className="App">
      <Transition
        state={visible ? "enter" : "leave"}
        from={{ opacity: 0, scale: 0}}
        enter={{ opacity: 1, scale: 1 }}
        leave={{ opacity: 0, scale: 0 }}
      >
        {({ scale, opacity }: any) => (
          <h2 style={{transform: `scale(${scale})`, opacity}}>
            Toggle to see some animation happen!
          </h2>
        )}
      </Transition>

      <button onClick={() => {
        setVisible((state) => !state)
      }}>toggle</button>
    </div>
  );
}
```

### Props

|Name|Type|Required|Default|Description|
|--|--|--|--|--|
|from|Object|Y||Initial state|
|enter|Object|Y||Show the end state of the animation, but also the initial state of the exit animation|
|leave|Object|Y||Exit the termination state of the animation|
|state|Enum 'enter', 'leave'|N|''|Current state|
|willEnter|Function|N|()=> {}|The callback function before the enter animation starts|
|didEnter|Function|N|()=> {}|The callback function before the animation ends|
|willLeave|Function|N|()=> {}|The callback function before the exit animation starts |
|didLeave|Function|N|()=> {}|The callback function before the exit animation ends|
|onStart|Function|N|()=> {}|The callback function before animation starts,including enter and exit|
|onRest|Function|N|()=> {}|The callback function before animation ends,including enter and exit|
|config|ConfigType|N|{}|Additional animation parameters|

### config

|Name|Type|Default|Description|
|--|--|--|--|
|duration|Number|1000|Animation duration.If this parameter is passed in, the easing function of the animation will use easing or linear function,unit: ms|
| easing   | Function\|String   |        | Easing function for animation. If duration is not passed, the spring easing function is used by default. If the duration parameter is passed in, the linear easing function will be used by default.For example, incoming `"cubic-bezier(.17,.67,.83,.67)"` will cause the animation frame update performed according to this easing function |
| tension  | Number             | 170    | Tension, used for spring easing function  |
| friction | Number             | 14     | Friction, used for spring easing function  |

