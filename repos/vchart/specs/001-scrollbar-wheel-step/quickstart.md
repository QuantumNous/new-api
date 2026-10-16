# Quickstart: Scrollbar Fixed Step & Min Height

## Overview

This feature allows you to configure a fixed pixel step for mouse wheel scrolling and a minimum size for the scrollbar slider.

## Usage

### 1. Fixed Step Scrolling

Set `scrollStep` in the `scrollbar` spec to define the number of pixels to scroll per wheel notch.

```javascript
const spec = {
  // ...
  scrollbar: {
    // Scroll 50 pixels per wheel event
    scrollStep: 50
  }
};
```

### 2. Minimum Slider Size

Set `minSliderSize` in the `scrollbar` spec to ensure the slider remains visible and interactable even with large datasets.

```javascript
const spec = {
  // ...
  scrollbar: {
    // Slider will always be at least 20px tall/wide
    minSliderSize: 20
  }
};
```

### 3. Combined Usage

```javascript
const spec = {
  type: 'line',
  data: [ ... ],
  scrollbar: {
    orient: 'right',
    scrollStep: 30,
    minSliderSize: 20
  }
};
```
