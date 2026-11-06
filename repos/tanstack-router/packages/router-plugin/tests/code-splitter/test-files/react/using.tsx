const DummyPostResource = (postId: string) => ({
  postData: { id: postId, title: 'dummy', body: 'dummy' },
  [Symbol.dispose]: () => console.log('disposing!'),
})
export const Route = createFileRoute({
  loader: ({ params: { postId } }) => {
    using dummyPost = DummyPostResource(postId)
    return dummyPost.postData
  },
})
