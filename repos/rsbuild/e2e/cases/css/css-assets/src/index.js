function load(key) {
  import(`./test/${key}`).then((res) => {
    console.log('res', res);
  });
}

load('a');
