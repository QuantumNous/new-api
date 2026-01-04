> Provides basic JS animation engine：

-   Simulate animation changes based on interpolation,the performance is more natural
-   Support the definition of various easing functions
-   Provides a complete life cycle hook and operation method, allowing developers to freely control the animation

## Install

```sh
npm install @douyinfe/semi-animation
```

## Usage

### Animation

`semi-animation` provides a class called  `Animation` . It has a complete life cycle hook and control method to support operating animation like audio and video.

-  Use in JS

```js
import { Animation } from '@douyinfe/semi-animation';

const div = document.createElement('span');
div.style.display = 'inline-block';
document.body.appendChild(div);

const animation = new Animation({
    from: { value: 0 },
    to: { value: 1 },
});

animation.on('frame', props => {
    const num = props.value.toFixed(2);
    div.style.transform = `scale(${num})`;
    div.innerText = num;
});
```

-   Use in React

```jsx
import { Animation } from '@douyinfe/semi-animation';
import { Component } from 'react';

class App extends Component {
    constructor(props) {
        super(props);
        this.state = { value: 0 };

        this.animation = new Animation({
            from: { value: 0 },
            to: { value: 1 },
        });

        this.animation.on('frame', props => {
            this.setState({ value: props.value.toFixed(2) });
        });
    }

    componentDidMount() {
        this.animation.start();
    }

    componentWillUnmount() {
        this.animation.destroy();
    }

    render() {
        const { value } = this.state;

        return <div style={{ display: 'inline-block', transform: `scale(${value})` }}>{value}</div>;
    }
}
```

-   Use in Vue

```html
<template>
    <div :style="{ transform: `scale(${value})`, display: 'inline-block' }">{{value}}</div>
</template>

<script>
    import { Animation } from '@douyinfe/semi-animation';

    export default {
        data() {
            return { value: 0 };
        },
        created() {
            this.animation = new Animation({
                from: { value: 0 },
                to: { value: 1 },
            });

            this.animation.on('frame', props => {
                this.value = props.value;
            });
        },
        mounted() {
            this.animation.start();
        },
        beforeDestroy() {
            this.animation.destroy();
        },
    };
</script>
```

Show results：

![](docs/assets/img/semi-animation-demo-simple.gif)

### API

```js
new Animation({ ...props }, { ...config });
```

**props**

| Prop Name | Type   | Required | Default | Description     |
| ------ | ------ | -------- | ------ | -------- |
| from   | Object | Y        |        | Initial state |
| to     | Object | Y        |        | Termination state |

**config**

| Prop Name   | Type             | Required | Default | Description                                                                                                                                                                                        |
| -------- | ---------------- | -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| duration | Number           | N        | 1000   | Animation duration. If this parameter is passed in, the easing function of the animation will use easing or linear function，unit: ms                                                                                                          |  |
| easing   | Function\|String | N        |        | Easing function for animation. If duration is not passed, the spring easing function is used by default. If the duration parameter is passed in, the linear easing function will be used by default.For example, incoming `"cubic-bezier(.17,.67,.83,.67)"` will cause the animation frame update performed according to this easing function |  |
| tension  | Number           | N        | 170    | Tension, used for spring easing function                                                                                                                                                            |
| friction | Number           | N        | 14     | Friction, used for spring easing function                                                                                                                                                                  |

**Instance methods**

| Name          | Params                                                         | Return | Description                                                                 |
| ---------------- | ------------------------------------------------------------ | ------ | --------------------------------------------------------------------- |
| start            |                                                              |        | Start the animation                                                          |
| pause            |                                                              |        | Pause the animation.After pausing, you must use the resume method to continue playing, not using start. |
| resume           |                                                              |        | Continue the animation.Only has an effect when the animation is paused.                                        |
| reverse          |                                                              |        | Reverse the animation                                                              |
| stop             |                                                              |        | Stop the animation.Only have an effect during animation playback, pause, and after end                          |
| end              |                                                              |        | Immediately terminate the animation, and pass the final state value of the animation to the callback method                          |
| reset            |                                                              |        | Reset the animation                                                             |
| destroy          |                                                              |        | Destroy the animation                                                              |
| getInitialStates |                                                              | Object | Get the initial state                                                         |
| getCurrentStates |                                                              | Object | Get the current state                                                        |
| getFinalStates   |                                                              | Object | Get the final state                                                        |
| on               | eventName:string, eventHandler:Function(props: object): void |        | Binding event callback method。The parameters received by each callback are the current animation state objects.            |

#### Supported events

-   `start`: Triggered when the animation starts
-   `pause`: Triggered when the animation pauses(The event is triggered when the animation state is changed from playing to pause, and it will not be triggered in other cases)
-   `resume`: Triggered when the animation continues to play(The event is triggered when the animation state is changed from paused to playing, and it will not be triggered in other cases)
-   `frame`: Triggered when the animation frame is updated
-   `rest`: Triggered when the animation ends(The event will be triggered when the animation ends normally)
-   `stop`: Triggered when the animation stops(This event is triggered when the instance stop method is called)

Developers can use `animation.on(eventName: string, cb: Function(currentStyle: object))` to bind the above events.

```jsx
import { Animation } from '@douyinfe/semi-animation';
// ...
const animation = new Animation(
    {
        from: { value1: 0, value2: 1 /* ... */ },
        to: { value1: 1, value2: 2 /* ... */ },
    },
    {
        duration: 1000, // After passing in duration, the default is linear interpolation
    }
);

animation.on('frame', currentState => {
    // currentState: is the state value object at the current moment
    // { value1: xxx, value2: xxx, ... }
});

// The callbacks such as start and pause are the same as the frame above, and the parameters are also the same.
animation.on('start', currentState => { /* ... */ });
animation.on('pause', currentState => { /* ... */ });
animation.on('resume', currentState => { /* ... */ });
animation.on('rest', currentState => { /* ... */ });
animation.on('stop', currentState => { /* ... */ });
```

## Licence

MIT