import { expectType } from '#test-utils';
import { Avatar, type ImageLoadingStatus } from '@base-ui/react/avatar';

// `Avatar.Image` accepts and forwards the native responsive/loading `<img>` props.
<Avatar.Root
  render={(props, state) => {
    expectType<ImageLoadingStatus, typeof state.imageLoadingStatus>(state.imageLoadingStatus);
    return <span {...props} />;
  }}
>
  <Avatar.Image
    crossOrigin="anonymous"
    referrerPolicy="no-referrer"
    sizes="48px"
    srcSet="avatar.png 1x, avatar@2x.png 2x"
    onLoadingStatusChange={(status) => {
      expectType<ImageLoadingStatus, typeof status>(status);
    }}
    render={(props, state) => {
      expectType<ImageLoadingStatus, typeof state.imageLoadingStatus>(state.imageLoadingStatus);
      return <img alt="" {...props} />;
    }}
  />
  <Avatar.Fallback
    delay={100}
    render={(props, state) => {
      expectType<ImageLoadingStatus, typeof state.imageLoadingStatus>(state.imageLoadingStatus);
      return <span {...props} />;
    }}
  />
</Avatar.Root>;
