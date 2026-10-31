Creator({
  onLoad(options) {
    // 调用 tt.setBlockInfo 将会销毁 Creator，开始创建并渲染 Block
    // SourceMeta 存储不可变的数据，一般是业务 ID 等；SourceData 存储需要协同的数据，并且需要在使用前设置 schema
    // 在 onLoad 中直接调用意味着 Creator 不需要界面，index.json 中的 needInterface 需同时设置为 false

    tt.setBlockInfo({
      sourceMeta: {
        id: 1
      },
      sourceData: {}
    });
  },
  onDestroy() {
    // Creator 被销毁的生命周期
  },
  methods: {
    createBlock() {
      // 创建 Block 并渲染
      // 意味着 Creator 需要界面，index.json 中的 needCreator 需同时设置为 true
      tt.setBlockInfo({
        sourceMeta: {
          id: 1
        },
        sourceData: {}
      });
    },
    cancelBlock() {
      // 调用 tt.cancel 会取消创建 Block
      tt.cancel();
    }
  }
});
