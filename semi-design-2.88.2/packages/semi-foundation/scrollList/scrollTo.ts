import { Animation } from '@douyinfe/semi-animation';

const scrollTo = (element: HTMLElement, to: number, duration: number) => {
    const animation = new Animation(
        {
            from: { scrollTop: element.scrollTop },
            to: { scrollTop: to },
        },
        { duration }
    );

    animation.on('frame', ({ scrollTop }: { scrollTop: number }) => {
        element.scrollTop = scrollTop;
    });

    // animation.start();

    return animation;
};

export default scrollTo;
