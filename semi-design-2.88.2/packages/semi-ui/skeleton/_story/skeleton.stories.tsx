import React from 'react';
import { storiesOf } from '@storybook/react';
import Skeleton from '../index';
import Button from '../../button';
import Switch from '../../switch';
import Avatar from '../../avatar';

const stories = storiesOf('Skeleton', module);

interface IProps {
    [x:string]: any;
}
interface IState {
    loading: boolean;
}
class Demo extends React.Component<IProps, IState> {
    constructor(props:any) {
      super(props);
      this.state = {loading: true};
    }
  
    showContent() {
      const {loading} = this.state;
      this.setState({
        loading: !loading
      });
    }
  
    render() {
      const {loading} = this.state;
      return (
        <>
          <span style={{display: 'flex', alignItems: 'center'}}>
            <Switch onChange={() => this.showContent()}/>
            <span style={{marginLeft: '10px' }}>显示加载内容</span>
          </span>
          <br/>
          <Skeleton placeholder={(<Skeleton.Avatar size="medium" />)} loading={loading}>
              <Avatar color='blue' style={{marginBottom: 10}}>U</Avatar>
          </Skeleton>
          <br/>
          <Skeleton style={{width: 200, height: 150}} placeholder={(<Skeleton.Image />)} loading={loading}>
              <img src="https://sf3-cdn-tos.douyinstatic.com/obj/eden-cn/slepweh7nupqpognuhbo/semi/831f8189f564e79c25769884c9d3d5f6.jpg" height='150' />
          </Skeleton>
          <br/>
          <Skeleton style={{width: 80}} placeholder={(<Skeleton.Title style={{marginBottom: 10}}/>)} loading={loading}>
              <h4 style={{marginBottom: 0}}>Semi UI</h4>
          </Skeleton>
          <Skeleton style={{width: 240}} placeholder={(<Skeleton.Paragraph rows={2}/>)} loading={loading}>
              <p style={{width: 240}} >精心打磨每一个组件的用户体验，从用户的角度考虑每个组件的使用场景。</p>
          </Skeleton>
          <br/>
          <Skeleton placeholder={(<Skeleton.Button />)} loading={loading}>
              <Button>Button</Button>
          </Skeleton>
        </>
      );
    }
  }
stories.add('Skeleton', () => (<Demo />
));