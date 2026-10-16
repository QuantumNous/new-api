const DummyPostResource = (postId: string) => ({
  postData: {
    id: postId,
    title: 'dummy',
    body: 'dummy'
  },
  [Symbol.dispose]: () => console.log('disposing!')
});
const SplitLoader = ({
  params: {
    postId
  }
}) => {
  using dummyPost = DummyPostResource(postId);
  return dummyPost.postData;
};
export { SplitLoader as loader };