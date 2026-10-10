import { isMobile } from 'react-device-detect';
// eslint-disable-next-line no-duplicate-imports
import {
  default as VChart,
  registerMediaQuery,
  registerAnimate,
  registerCustomAnimate,
  registerStateTransition,
  vglobal
} from '../../../../src/index';
registerAnimate();
registerCustomAnimate();
registerStateTransition();

function wipeAnimate(canvas, ratio) {
  // 创建临时画布
  const c = vglobal.createCanvas({
    width: canvas.width,
    height: canvas.height,
    dpr: vglobal.devicePixelRatio
  });
  const ctx = c.getContext('2d');
  if (!ctx) {
    return false;
  }

  // 将原画布内容绘制到临时画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(canvas, 0, 0);

  // 获取临时画布的图像数据
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 根据ratio计算擦除位置（从左到右）
  const wipePosition = Math.floor(canvas.width * ratio);

  // 设置渐变区域宽度，可根据需要调整
  const gradientWidth = Math.min(canvas.width * 0.3, 50);

  // 遍历每个像素点
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      // 计算当前像素在数据数组中的索引
      const index = (y * canvas.width + x) * 4;

      // 计算当前像素的原始透明度
      const originalAlpha = data[index + 3];

      // 计算当前像素与擦除位置的距离
      const distance = x - wipePosition;

      // 根据距离计算透明度
      let newAlpha;
      if (distance <= 0) {
        // 擦除位置左侧：完全透明
        newAlpha = 0;
      } else if (distance <= gradientWidth) {
        // 渐变区域内：透明度从0到原始透明度渐变
        const gradientRatio = distance / gradientWidth;
        newAlpha = Math.floor(originalAlpha * gradientRatio);
      } else {
        // 擦除位置右侧：保持原始透明度
        newAlpha = originalAlpha;
      }

      // 设置新的透明度
      data[index + 3] = newAlpha;
    }
  }

  // 将处理后的图像数据绘制回临时画布
  ctx.putImageData(imageData, 0, 0);

  return c;
}

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  animationDisappear: {
    callBack: (stage, canvas, ratio) => wipeAnimate(canvas, ratio),
    easing: 'linear',
    duration: 2000
  }
};

const run = () => {
  const container = document.getElementById('chart');
  if (container) {
    container.style.width = '640px';
    container.style.height = '480px';
    container.style.border = '1px solid #eee';
  }

  registerMediaQuery();
  // VChart.ThemeManager.setCurrentTheme('dark');
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser',
    //theme: 'dark',
    onError: err => {
      console.error(err);
    }
  });
  console.time('renderTime');

  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });

  const button = document.createElement('button');
  button.innerHTML = '退场动画';
  button.addEventListener('click', () => {
    cs.runDisappearAnimation();
  });
  // document.body.appendChild(button);

  // setInterval(() => {
  //   cs.runDisappearAnimation();
  // }, 2000);

  (window as any)['vchart'] = cs;
  console.log(cs);
};
run();
