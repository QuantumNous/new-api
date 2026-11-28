class AA {
  aa: string;

  constructor(aa: string) {
    this.aa = aa;
  }

  async test() {
    console.log(this.aa);
  }
}

console.log(AA);
