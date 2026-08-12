import { expect, getFileContent, test } from '@e2e/helper';

test('should bundle CSS layers as expected', async ({ runBoth }) => {
  await runBoth(async ({ mode, result }) => {
    const files = result.getDistFiles();
    const content = getFileContent(files, 'index.css');

    if (mode === 'build') {
      expect(content).toEqual(
        '@layer a{.a{color:red}}@layer b{.b{color:green}}@layer c{@layer{.c-sub{color:#00f}.c-sub2{color:green}}.c{color:#00f}}',
      );
    } else {
      expect(content.trim()).toEqual(`@layer a {
.a {
  color: red;
}

}
@layer b {
.b {
  color: green;
}

}
@layer c {
@layer {.c-sub {
  color: #00f;
}

.c-sub2 {
  color: green;
}
}
}
@layer c {
.c {
  color: #00f;
}

}`);
    }
  });
});
