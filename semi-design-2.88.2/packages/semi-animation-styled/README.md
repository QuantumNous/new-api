> Stylesheet for animation

- Provides rich transition effects based on `animate.css` (https://github.com/animate-css/animate.css)
- It is easy to use. Building rich and vivid front-end pages through adding various atomic animation style to elements

## Usage

```jsx
import '@douyinfe/semi-animation-styled'; 
import React from 'react';

class App extends React.Component {
    render() {
        return (
            <div className="semi-animated semi-bounce semi-speed-slow semi-loop-infinite">bounce</div>
        );
    }
}
```