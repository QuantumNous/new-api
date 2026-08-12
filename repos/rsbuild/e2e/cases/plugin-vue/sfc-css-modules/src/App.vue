<template>
  <p id="test1" :class="{ [$style.red]: isRed }">Red</p>
  <p id="test2" :class="[$style.red, $style.blue]">Blue</p>
  <p id="test3" :class="style.green">Green</p>
</template>

<script>
import style from './style.module.css';

export default {
  setup() {
    return {
      style,
      isRed: true,
    };
  },
};
</script>

<style module>
.red {
  color: red;
}
.blue {
  color: blue;
}
</style>
