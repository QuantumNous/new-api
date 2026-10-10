<script>
  export let name;
</script>

<main>
  <div class="main">
    <h1 id="title">Hello {name}!</h1>
  </div>
</main>

<style lang="less">
  @color: #ff3e00;

  .main {
    h1 {
      color: @color;
      text-transform: uppercase;
      font-size: 4em;
      font-weight: 100;
    }
  }
</style>
