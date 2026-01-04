import React from 'react';
import { mount } from 'enzyme';
import sinon from 'sinon';
import { stepsClasses } from '@douyinfe/semi-foundation/steps/constants';
import Steps from '../index';
import { BASE_CLASS_PREFIX } from '../../../semi-foundation/base/constants';

const Step = Steps.Step;

describe('Steps', () => {
    it('current works', () => {
        const element = (
            <Steps current={0}>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const wrapper = mount(element);
        expect(
            wrapper
                .find('Step')
                .at(0)
                .props().status
        ).toEqual('process');
    });

    it('parent status works', () => {
        const wait = (
            <Steps status="wait" current={0}>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const waitWrapper = mount(wait);
        expect(
            waitWrapper.props().status
        ).toEqual('wait');
        waitWrapper.unmount();

        const error = (
            <Steps status="error" current={0}>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const errorWrapper = mount(error);
        expect(
            errorWrapper.props().status
        ).toEqual('error');
        errorWrapper.unmount();

        const finish = (
            <Steps status="finish" current={0}>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const finishWrapper = mount(finish);
        expect(
            finishWrapper.props().status
        ).toEqual('finish');
        finishWrapper.unmount();

        const process = (
            <Steps status="process" current={0}>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const processWrapper = mount(process);
        expect(
            processWrapper.props().status
        ).toEqual('process');
        processWrapper.unmount();

        const warning = (
            <Steps status="warning" current={0}>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const warningWrapper = mount(warning);
        expect(
            warningWrapper.props().status
        ).toEqual('warning');
        warningWrapper.unmount();
    });

    it('child status works', () => {
        const wait = (
            <Steps current={0}>
                <Step status="wait">Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const waitWrapper = mount(wait);
        expect(
            waitWrapper
                .find('Step')
                .at(0)
                .props().status
        ).toEqual('wait');
        waitWrapper.unmount();

        const error = (
            <Steps current={0}>
                <Step status="error">Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const errorWrapper = mount(error);
        expect(
            errorWrapper
                .find('Step')
                .at(0)
                .props().status
        ).toEqual('error');
        errorWrapper.unmount();

        const finish = (
            <Steps current={0}>
                <Step status="finish">Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const finishWrapper = mount(finish);
        expect(
            finishWrapper
                .find('Step')
                .at(0)
                .props().status
        ).toEqual('finish');
        finishWrapper.unmount();

        const process = (
            <Steps current={0}>
                <Step status="process">Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const processWrapper = mount(process);
        expect(
            processWrapper
                .find('Step')
                .at(0)
                .props().status
        ).toEqual('process');
        processWrapper.unmount();

        const warning = (
            <Steps current={0}>
                <Step status="warning">Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const warningWrapper = mount(warning);
        expect(
            warningWrapper
                .find('Step')
                .at(0)
                .props().status
        ).toEqual('warning');
        warningWrapper.unmount();

    });

    it('initial works', () => {
        const element = (
            <Steps status="warning" initial={1} current={1}>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const wrapper = mount(element);
        expect(
            wrapper
                .find('Step')
                .at(0)
                .props().status
        ).toEqual('warning');
    });

    it('FillStep onClick works', () => {
        const spyOnClick = sinon.fake();
        const element = (
            <Steps status="warning" initial={1} current={1}>
                <Step onClick={spyOnClick}>Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const wrapper = mount(element);
        const fiestStepContainer = wrapper.find('Step').at(0).find(`.${stepsClasses.ITEM}`);
        fiestStepContainer.simulate('click');
        expect(spyOnClick.calledOnce).toEqual(true);
    });

    it('BasicStep onClick works', () => {
        const spyOnClick = sinon.fake();
        const element = (
            <Steps type='basic' status="warning" initial={1} current={1}>
                <Step onClick={spyOnClick}>Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const wrapper = mount(element);
        const fiestStepContainer = wrapper.find('Step').at(0).find(`.${stepsClasses.ITEM}`);
        fiestStepContainer.simulate('click');
        expect(spyOnClick.calledOnce).toEqual(true);
    });

    it('NavStep onClick works', () => {
        const spyOnClick = sinon.fake();
        const element = (
            <Steps type='nav' status="warning" initial={1} current={1}>
                <Step onClick={spyOnClick}>Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const wrapper = mount(element);
        const fiestStepContainer = wrapper.find('Step').at(0).find(`.${stepsClasses.ITEM}`);
        fiestStepContainer.simulate('click');
        expect(spyOnClick.calledOnce).toEqual(true);
    });

    it('Steps onChange works', () => {
        const spyOnChange = sinon.fake();
        const element = (
            <Steps status="warning" initial={1} onChange={spyOnChange} current={1}>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
                <Step>Step.1</Step>
            </Steps>
        );
        const wrapper = mount(element);
        const fiestStepContainer = wrapper.find('Step').at(1).find(`.${stepsClasses.ITEM}`);
        fiestStepContainer.simulate('click');
        expect(spyOnChange.calledOnce).toEqual(false);
        const fiestStepContainer2 = wrapper.find('Step').at(0).find(`.${stepsClasses.ITEM}`);
        fiestStepContainer2.simulate('click');
        expect(spyOnChange.calledOnce).toEqual(true);
    });

    it('Steps type', () => {
        const nav = (
            <Steps type="nav" current={1}>
                <Step title="Finished" />
                <Step title="In Progress" />
                <Step title="Waiting" />
            </Steps>
        );
        const navWrapper = mount(nav);
        expect(navWrapper.exists(`.${BASE_CLASS_PREFIX}-steps-nav`)).toEqual(true);
        navWrapper.unmount();

        const basic = (
            <Steps type="basic" current={1}>
                <Step title="Finished" />
                <Step title="In Progress" />
                <Step title="Waiting" />
            </Steps>
        );
        const basicWrapper = mount(basic);
        expect(basicWrapper.exists(`.${BASE_CLASS_PREFIX}-steps-basic`)).toEqual(true);
        basicWrapper.unmount();

        const fill = (
            <Steps type="fill" current={1}>
                <Step title="Finished" />
                <Step title="In Progress" />
                <Step title="Waiting" />
            </Steps>
        );
        const fillWrapper = mount(fill);
        expect(fillWrapper.exists(`.${BASE_CLASS_PREFIX}-steps`)).toEqual(true);
        fillWrapper.unmount();
    });

    it('Steps with custom className & style', () => {
        const wrapper = mount(
            <Steps className='test' style={{ color: 'red' }}>
                <Step title="Finished" />
                <Step title="In Progress" />
                <Step title="Waiting" />
            </Steps>
        );
        expect(wrapper.exists('.test')).toEqual(true);
        expect(wrapper.find(`.${BASE_CLASS_PREFIX}-steps.test`)).toHaveStyle('color', 'red');
    });

    it('Step with custom className & style', () => {
        const wrapper = mount(
            <Steps >
                <Step className='test' style={{ color: 'blue' }} title="Finished" />
                <Step title="In Progress" />
                <Step title="Waiting" />
            </Steps>
        );
        const firstStep = wrapper.find('Step').at(0);
        expect(firstStep.exists('.test')).toEqual(true);
        expect(firstStep).toHaveStyle('color', 'blue');
    });

    it('Steps with size', () => {
        const wrapper = mount(
            <Steps type="basic" size='small'>
                <Step className='test' style={{ color: 'red' }} title="Finished" />
                <Step title="In Progress" />
                <Step title="Waiting" />
            </Steps>
        );
        expect(wrapper.exists(`.${BASE_CLASS_PREFIX}-steps-small`)).toEqual(true);
    });

    it('Steps with hasLine', () => {
        const hasLineWrapper = mount(
            <Steps type="basic" hasLine={true} current={1}>
                <Step title="Finished" description="This is a description" />
                <Step title="In Progress" description="This is a description" />
                <Step title="Waiting" description="This is a description" />
            </Steps>
        );
        expect(hasLineWrapper.exists(`.${BASE_CLASS_PREFIX}-steps-hasline`)).toEqual(true);
        hasLineWrapper.unmount();

        const noLineWrapper = mount(
            <Steps type="basic" hasLine={false} current={1}>
                <Step title="Finished" description="This is a description" />
                <Step title="In Progress" description="This is a description" />
                <Step title="Waiting" description="This is a description" />
            </Steps>
        );
        expect(noLineWrapper.exists(`.${BASE_CLASS_PREFIX}-steps-hasline`)).toEqual(false);
        noLineWrapper.unmount();
    });

    it('Steps with direction', () => {
        const verticalWrapper = mount(
            <Steps direction="vertical" type="basic" current={1}>
                <Steps.Step title="Finished" description="This is a description" />
                <Steps.Step title="In Progress" description="This is a description" />
                <Steps.Step title="Waiting" description="This is a description" />
            </Steps>
        );
        expect(verticalWrapper.exists(`.${BASE_CLASS_PREFIX}-steps-vertical`)).toEqual(true);
        verticalWrapper.unmount();

        const horizontalWrapper = mount(
            <Steps direction="horizontal" type="basic" current={1}>
                <Steps.Step title="Finished" description="This is a description" />
                <Steps.Step title="In Progress" description="This is a description" />
                <Steps.Step title="Waiting" description="This is a description" />
            </Steps>
        );
        expect(horizontalWrapper.exists(`.${BASE_CLASS_PREFIX}-steps-horizontal`)).toEqual(true);
        horizontalWrapper.unmount();
    });
});
