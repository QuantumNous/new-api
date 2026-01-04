## 📣 Introduction

How to contribute icon to this package

##  🚀 Steps
- Add the svg file under the path ```src/svgs/```, naming references to other files.
- Run command ```lerna run build:icon --scope @douyinfe/semi-icons```, the corresponding tsx file will be generated under the path ```src/icons```.
- Add the category and name of the new icon to the ```src/svgs/meta.json``` file.
- Finally, run command ```yarn docsite``` and go to the icon page to confirm whether the icon is successfully added.