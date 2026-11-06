{{ target: background }}

支持三种格式：

- 颜色字符串
- 渐变色（自 1.11.6 版本开始支持）
- 图片配置

**渐变色使用如下：**

{{ use: graphic-gradient }}

**图片配置结构如下：**

```
const type BackgroundImage = {
  image?: string | HTMLImageElement | HTMLCanvasElement;
  cornerRadius?: number | number[];
  backgroundMode?: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat' | 'no-repeat-cover' | 'no-repeat-contain' | 'no-repeat-fill' | 'no-repeat-auto';
  backgroundPosition?: 'left' | 'center' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | [number | string, number | string];
  backgroundScale?: number;
  backgroundOffsetX?: number;
  backgroundOffsetY?: number;
  backgroundClip?: boolean;
  backgroundOpacity?: number;
}
```

其中：

- `backgroundMode` 自 `2.0.21` 版本开始支持 `no-repeat-cover` / `no-repeat-contain` / `no-repeat-fill` / `no-repeat-auto` 这些 `no-repeat` 下的尺寸简写
- `backgroundPosition` 自 `2.0.21` 版本开始支持，用于控制图片在背景区域中的锚定位置，语义类似 CSS `background-position`

使用示例:

```
// 直接设置颜色
const spec = {
  // color name
  background: 'red';
  // HEX
  background: '#ff0000';
  // rgb or rgba
  background: 'rgba(255,0,0,0.5)';
}

// 设置为图片背景
const svgImage = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" href="/" style="height: 24px; width: 24px; margin-right: 10px;"><path fill-rule="evenodd" clip-rule="evenodd" d="M13 0C20.1797 0 26 5.8203 26 13C26 14.1592 25.8483 15.283 25.5636 16.3525L18.2377 4.25581H18.2291C17.5709 3.254 16.4371 2.59256 15.1489 2.59256C13.8606 2.59256 12.7268 3.254 12.0686 4.25581H12.0599L11.9686 4.41693C11.951 4.44707 11.9337 4.47747 11.9169 4.50815L3.88731 18.6779C3.56947 19.2224 3.38736 19.8558 3.38736 20.5318C3.38736 21.1089 3.52009 21.655 3.75667 22.1412C1.43409 19.7928 0 16.5639 0 13C0 5.8203 5.8203 0 13 0ZM6.27755 24.1292C6.53287 24.1852 6.79812 24.2147 7.07026 24.2147C9.10427 24.2147 10.7532 22.5658 10.7532 20.5318C10.7532 19.8794 10.5835 19.2667 10.286 18.7353L10.2879 18.7345L8.49328 15.6288C7.52634 13.954 8.10016 11.8124 9.77496 10.8455C11.4498 9.87854 13.5913 10.4524 14.5582 12.1272L20.8887 22.8559L20.8912 22.8548C20.9571 22.962 21.0284 23.0655 21.1045 23.1651C18.8821 24.9394 16.0649 26 13 26C10.5397 26 8.23908 25.3166 6.27755 24.1292Z" fill="#0040FF"></path></svg>'
const spec = {
  background: {
    // svg
    image: svgImage,
    // url
    image: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/chart-3d/area3d.png',
    // 自 2.0.21 版本开始支持
    backgroundMode: 'no-repeat-cover',
    backgroundPosition: 'center'
  }
}

```
