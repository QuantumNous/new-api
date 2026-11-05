# 前端产物嵌入目录（方案 A）

`go:embed` 只能嵌入当前包目录及其子目录，不能引用父目录。前端源码位于 `apps/web`，
构建时需把 `apps/web/dist` 拷贝到本目录下的 `dist/`，再编译 Go：

```bash
cp -r apps/web/dist apps/api/web/dist
```

`dist/` 已在 `.gitignore` 中忽略，不进版本库。参见父 Issue #1 的方案 A 说明。
