<template>
  <button id="button1" type="button" @click="count++">A: {{ count }}</button>
  <div class="list1" v-for="item in list.filter(Boolean)" :key="item">
    {{ item }}
  </div>
  <B />
</template>

<script>
import { ref } from 'vue';
import B from './B.vue';

export default {
  components: {
    B,
  },

  setup() {
    const count = ref(0);

    return {
      count,
      list: [1, 2, null, 3],
    };
  },
};
</script>
