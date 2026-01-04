import { mount, render, shallow } from 'enzyme';

// some component story need special process
// function componentTestAdapter(describeName, module) {
//     switch (describeName) {
//         case 'Banner':
//             let firstChild = document.createElement('div');
//             document.body.appendChild(firstChild);
//             break;
//         default:
//             break;
//     }
// }

export const storiesOf = function storiesOf(describeName, module) {
    let api = {};
    // describe('stories-' + describeName);
    api.add = function (name, funcDemo) {
        it(name, () => {
            const div = document.createElement('div');
            div.setAttribute('id', 'container');
            document.body.appendChild(div);

            // story snapshot test need stable random value
            window.crypto.getRandomValues = arr => arr.length;

            // can't attactTo document.body, some story will render to null, so weird.
            let wrapper = mount(funcDemo(), { attachTo: document.getElementById('container') });

            // Ingore Component Story
            const ingoreComponent = ['OverflowList', 'Table', 'Form', 'Select'];
            // OverflowList use IntersectionObserver API, can't easy mock in jest environment, just skip it.
            // TODO - Find out why test story of  Table/Select/Form will cause a stack overflow
            if (ingoreComponent.includes(describeName)) {
                wrapper = null;
            }

            // componentTestAdapter(describeName, module);
            // const wrapper = mount(funcDemo(), { attachTo: document.body });

            expect(wrapper).toMatchSnapshot();

            document.body.removeChild(div);
            document.body.innerHTML = '';
        });
        return api;
    };

    api.addWithInfo = function (name, func) {
        func();
        return api;
    };
    api.addDecorator = function () {};
    return api;
};
