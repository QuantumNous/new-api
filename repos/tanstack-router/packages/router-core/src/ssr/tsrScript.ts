self.$_TSR = {
  h() {
    this.hydrated = true
    this.c()
  },
  e() {
    this.streamEnded = true
    this.c()
  },
  c() {
    if (this.hydrated && this.streamEnded) {
      delete self.$_TSR
      delete self.$R['tsr']
    }
  },
  p(script) {
    !this.initialized ? this.buffer.push(script) : script()
  },
  buffer: [],
}
