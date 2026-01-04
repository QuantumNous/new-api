import Vue from 'vue';
import { storiesOf } from '@storybook/vue';
import { Animation } from '../index';
import noop from '../utils/noop';

const stories = storiesOf('semi-animation/jsAnimation-vue', module);

const itemStyle = {
    backgroundColor: 'rgb(241, 101, 101)',
    color: 'white',
    borderRadius: '4px',
    padding: '10px',
    textAlign: 'center',
};

const bigSquareStyle = {
    backgroundColor: 'rgb(241, 101, 101)',
    width: '100px',
    height: '100px',
    margin: '20px',
    marginLeft: '50px',
    borderRadius: '4px',
    fontSize: '32px',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const Anim = {
    data() {
        return {};
    },
    props: {
        from: {
            type: Object,
            default: () => ({ value: 0 }),
        },
        to: {
            type: Object,
            default: () => ({ value: 10 }),
        },
        onStart: {
            type: Function,
            default: () => noop,
        },
        onFrame: {
            type: Function,
            default: () => noop,
        },
        onPause: {
            type: Function,
            default: () => noop,
        },
        onResume: {
            type: Function,
            default: () => noop,
        },
        onStop: {
            type: Function,
            default: () => noop,
        },
        onRest: {
            type: Function,
            default: () => noop,
        },
    },
    created() {
        this.animation = new Animation({
            from: { ...this.from },
            to: { ...this.to },
        });
        ['start', 'frame', 'pause', 'resume', 'stop', 'rest'].forEach(event => {
            const propName = `on${event[0].toUpperCase() + event.slice(1)}`;
            this.animation.on(event, props => this[propName](props));
        });
    },
    mounted() {
        this.animation.start();
    },
    beforeDestroy() {
        this.animation.destroy();
    },
    methods: {
        reset() {
            this.animation.reset();
            this.animation.start();
        },
        reverse() {
            this.animation.reverse();
            this.animation.start();
        },
        pause() {
            this.animation.pause();
        },
        resume() {
            this.animation.resume();
        },
        stop() {
            this.animation.stop();
        },
    },
    template: `
    <div>
        <slot></slot>
        <div>
            <button @click="reset">reset</button>
            <button @click="reverse">reverse</button>
            <button @click="pause">pause</button>
            <button @click="resume">resume</button>
            <button @click="stop">stop</button>
        </div>
    </div>`,
};

stories.add('Hello World', () => ({
    components: {
        Anim,
    },
    data() {
        return {
            value: 0,
            bigSquareStyle: Object.freeze({ ...bigSquareStyle }),
        };
    },
    methods: {
        onFrame(props) {
            this.value = props.value.toFixed(2);
        },
    },
    created() {},
    mounted() {},
    template:
        '<Anim :from="{ value: 0 }" :to="{ value: 1 }" :on-frame="onFrame" :on-stop="onFrame"><div :style="{...bigSquareStyle, transform: `scale(${value})`}">{{value}}</div></Anim>',
    // template: '<div>123</div>',
    // render: h => h(`<div>123</div>`),
}));

stories.add('Hello World2', () => ({
    // render: h => h(`<div>123</div>`),
    template: '<div>123</div>',
}));
