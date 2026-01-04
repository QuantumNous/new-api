#!/bin/bash

# 定义源目录和目标目录
source_dir="content"
target_dir="packages/semi-ui"

# 遍历 content 目录下的二级子文件夹
for type_dir in "$source_dir"/*; do
  if [ -d "$type_dir" ]; then
    for component_dir in "$type_dir"/*; do
      if [ -d "$component_dir" ]; then
        # 获取组件名称
        component_name=$(basename "$component_dir")

        # 确认目标目录中存在同名文件夹
        if [ -d "$target_dir/$component_name" ]; then
          echo "Found directory $target_dir/$component_name, creating symlinks..."

          # 创建 index.md 符号链接
          if [ -f "$component_dir/index.md" ]; then
            ln -sf "../../../$component_dir/index.md" "$target_dir/$component_name/index.md"
            echo "Created symlink: $target_dir/$component_name/index.md -> ../../../$component_dir/index.md"
          else
            echo "No index.md found in $component_dir"
          fi

          # 创建 index-en-US.md 符号链接
          if [ -f "$component_dir/index-en-US.md" ]; then
            ln -sf "../../../$component_dir/index-en-US.md" "$target_dir/$component_name/index-en-US.md"
            echo "Created symlink: $target_dir/$component_name/index-en-US.md -> ../../../$component_dir/index-en-US.md"
          else
            echo "No index-en-US.md found in $component_dir"
          fi
        else
          echo "Directory $target_dir/$component_name not found, skipping..."
        fi
      fi
    done
  fi
done

echo "符号链接创建完毕。"