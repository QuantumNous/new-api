# ThemeManager

主题管理器

## themes

主题字典，包含所有主题。

## registerTheme

注册主题。

```ts

/**
 * 注册主题
 * @param name 主题名称
 * @param theme 主题配置
 * @returns
 */
registerTheme: (name: string, theme: Partial<ITheme>) => void;

```

## getTheme

获取主题。

```ts
/**
 * 获取主题
 * @param name 主题名称
 * @returns
 */
getTheme: (name: string) => ITheme;
```

## removeTheme

移除主题。

```ts
/**
 * 移除主题
 * @param name 主题名称
 * @returns 是否移除成功
 */
removeTheme: (name: string) => boolean;
```

## themeExist

判断主题是否存在。

```ts
/**
 * 判断主题是否存在
 * @param name 主题名称
 * @returns 是否存在
 */
themeExist: (name: string) => boolean;
```

## getDefaultTheme

获取默认主题。

```ts
/**
 * 获取默认主题
 * @returns 默认主题
 */
getDefaultTheme: () => ITheme;
```

## setCurrentTheme

设置当前主题（所有实例生效）。

```ts
/**
 * 设置当前主题
 * @param name 主题名称
 * @returns 是否设置成功
 */
setCurrentTheme: (name: string) => void;
```

## getCurrentTheme

获取当前主题（只能获取用户通过 `setCurrentTheme` 方法设置过的主题，默认值为默认主题）。

```ts
/**
 * 获取当前主题
 * @returns 当前主题
 */
getCurrentTheme: () => ITheme;
```
