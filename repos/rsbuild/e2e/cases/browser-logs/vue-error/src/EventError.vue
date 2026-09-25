<template>
  <button @click="handleClick">Click me</button>
</template>

<script setup>
const handleClick = () => {
  const obj = null;
  obj.someMethod();
};
</script>
