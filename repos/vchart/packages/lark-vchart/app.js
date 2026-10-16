App({
  // 分享文案
  onShareAppMessage(opt) {
    return {
      title: 'VChart 小程序示例',
      path: '/gallery/pages/index/index',
      PCPath: '/gallery/pages/index/index',
      PCMode: 'sidebar-semi',
      imageUrl: '',
      success(res) {
        console.log('success', res);
      },
      fail(errr) {
        console.error(errr);
      }
    };
  }
});
