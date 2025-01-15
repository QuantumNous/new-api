<template>
  <div class="home">
    <img alt="Vue logo" src="../assets/logo.png">
    <%_ if (!rootOptions.bare) { _%>
    <HelloWorld msg="Welcome to Your Vue.js App"/>
    <%_ } else { _%>
    <h1>Welcome to Your Vue.js App</h1>
    <%_ } _%>
  </div>
</template>
<%_ if (!rootOptions.bare) { _%>

<script>
// @ is an alias to /src
import HelloWorld from '@/components/HelloWorld.vue'

export default {
  name: 'HomeView',
  components: {
    HelloWorld
  }
}
</script>
<%_ } _%>
