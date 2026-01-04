#!/bin/bash

## 提示用户输入URL
read -p "请输入同步的源(例如: registry.npmjs.org): " url
#
## 使用python -m webbrowser访问输入的URL
python -m webbrowser https://$url/sync/@douyinfe/semi-ui
python -m webbrowser https://$url/sync/@douyinfe/semi-foundation
python -m webbrowser https://$url/sync/@douyinfe/semi-animation
python -m webbrowser https://$url/sync/@douyinfe/semi-animation-react
python -m webbrowser https://$url/sync/@douyinfe/semi-animation-styled
python -m webbrowser https://$url/sync/@douyinfe/semi-icons
python -m webbrowser https://$url/sync/@douyinfe/semi-icons-lab
python -m webbrowser https://$url/sync/@douyinfe/semi-illustrations
python -m webbrowser https://$url/sync/@douyinfe/semi-next
python -m webbrowser https://$url/sync/@douyinfe/semi-rspack-plugin
python -m webbrowser https://$url/sync/@douyinfe/semi-scss-compile
python -m webbrowser https://$url/sync/@douyinfe/semi-theme-default
python -m webbrowser https://$url/sync/@douyinfe/semi-webpack-plugin
python -m webbrowser https://$url/sync/@douyinfe/semi-json-viewer-core

