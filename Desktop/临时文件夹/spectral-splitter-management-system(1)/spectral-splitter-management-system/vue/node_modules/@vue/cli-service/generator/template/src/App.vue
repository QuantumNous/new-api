<template>
<%_ if (rootOptions.vueVersion === '3') { _%>
  <img alt="Vue logo" src="./assets/logo.png">
  <%_ if (!rootOptions.bare) { _%>
  <HelloWorld msg="Welcome to Your Vue.js App"/>
  <%_ } else { _%>
  <h1>Welcome to Your Vue.js App</h1>
  <%_ } _%>
<%_ } else { _%>
  <div id="app">
    <img alt="Vue logo" src="./assets/logo.png">
    <%_ if (!rootOptions.bare) { _%>
    <HelloWorld msg="Welcome to Your Vue.js App"/>
    <%_ } else { _%>
    <h1>Welcome to Your Vue.js App</h1>
    <%_ } _%>
  </div>
<%_ } _%>
</template>
<%_ if (!rootOptions.bare) { _%>

<script>
import HelloWorld from './components/HelloWorld.vue'

export default {
  name: 'App',
  components: {
    HelloWorld
  }
}
</script>

<%_ if (rootOptions.cssPreprocessor !== 'stylus') { _%>
<style<%-
  rootOptions.cssPreprocessor
    ? ` lang="${
        rootOptions.cssPreprocessor.includes('sass')
          ? 'scss'
          : rootOptions.cssPreprocessor
      }"`
    : ``
%>>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
<%_ } else { _%>
<style lang="stylus">
#app
  font-family Avenir, Helvetica, Arial, sans-serif
  -webkit-font-smoothing antialiased
  -moz-osx-font-smoothing grayscale
  text-align center
  color #2c3e50
  margin-top 60px
</style>
<%_ } _%>
<%_ } _%>
