

##  📣 Introduce

Beautiful, colorful icons(experimental)  design by Semi Team

![](https://lf9-static.semi.design/obj/semi-tos/images/0b8d0ca0-57be-11ee-8e53-13ab794309ff.png)


##  🚀 Getting Start

### install deps

```shell
npm install @douyinfe/semi-icons-lab
```

### as a react component

```tsx
import { IconAnchor } from '@douyinfe/semi-icons-lab';

ReactDOM.render(<IconAnchor />, root);
```


## How to contribute icon to this package
- Add the svg file under the path ```src/svgs/```, naming references to other files.
- Run command ```lerna run build:icon --scope @douyinfe/semi-icons-lab```, the corresponding tsx file will be generated under the path ```src/icons```.
- Add the category and name of the new icon to the ```src/svgs/meta.json``` file.
- Finally, run command ```yarn docsite``` and go to the icon page to confirm whether the icon is successfully added.