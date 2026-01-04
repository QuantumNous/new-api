import React from 'react';
import { storiesOf } from '@storybook/react';
import SideSheet from '../index';
import Button from '../../button';

const stories = storiesOf('SideSheet', module);

interface IProps {
    [x:string]: any;
}
interface IState {
    visible: boolean;
}
class Demo extends React.Component<IProps, IState> {
    constructor(props:any) {
      super(props);
      this.state = { visible: false};
    }
    show() {
      this.setState({
        visible: true
      });
    }
    handleCancel() {  
      this.setState({
        visible: false
      });
    }
    render() {
        const { visible } = this.state;
      return (
        <>
          <Button onClick={() => this.show()}>Open SideSheet</Button>
          <SideSheet
            title="滑动侧边栏" 
            visible={visible} 
            onCancel={() => this.handleCancel()}
          >
            <p>This is the content of a basic sidesheet.</p>
            <p>Here is more content...</p>
          </SideSheet>
        </>
      );
    }
  }

stories.add('SideSheet', () => (<Demo />
));