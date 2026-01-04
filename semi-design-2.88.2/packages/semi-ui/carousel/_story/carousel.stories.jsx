import React, { useState } from 'react';
import { Radio, RadioGroup, Button } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconArrowRight } from "@douyinfe/semi-icons";
import Carousel from '../index';

export default {
  title: 'Carousel',
}

const style = {
  width: '600px',
  height: '240px',
};

const contentPinkStyle = {
  display:'flex',
  justifyContent: 'center',
  alignItems: 'center',
  color: '#fff',
  background: 'lightpink',
};

const contentBlueStyle = {
  display:'flex',
  justifyContent: 'center',
  alignItems: 'center',
  color: '#fff',
  background: 'lightBlue',
};

const radioTitleStyle = { 
  marginRight: 20
}

export const BasicUsage = () => (
    <Carousel style={style}>
      <div style={contentPinkStyle}>
        <h3>1</h3>
      </div>
      <div style={contentBlueStyle}>
        <h3>2</h3>
      </div>
      <div style={contentPinkStyle}>
        <h3>3</h3>
      </div>
      <div style={contentBlueStyle}>
        <h3>4</h3>
      </div>
      <div style={contentPinkStyle}>
        <h3>5</h3>
      </div>
    </Carousel>
);

BasicUsage.story = {
  name: 'basic usage',
};

// 主题切换
export const theme = () => {
  const [theme, setTheme] = useState('primary');

  return (
   <div>
     <div> 
       <span style={radioTitleStyle}>主题</span>
       <RadioGroup onChange={e => setTheme(e.target.value)} value={theme}>
        <Radio value='primary'>primary</Radio>
        <Radio value='light'>light</Radio>
        <Radio value='dark'>dark</Radio>
      </RadioGroup>
      </div>
      <br/>
      <Carousel style={style} theme={theme}>
        <div style={contentPinkStyle}>
          <h3>1</h3>
        </div>
        <div style={contentBlueStyle}>
          <h3>2</h3>
        </div>
        <div style={contentPinkStyle}>
         <h3>3</h3>
        </div>
        <div style={contentBlueStyle}>
          <h3>4</h3>
        </div>
        <div style={contentPinkStyle}>
          <h3>5</h3>
       </div>
      </Carousel>
   </div>
  );
}

theme.story = {
  name: 'theme',
};


// 指示器大小、类型、位置
export const indicatorUsage = () => {
  const [size, setSize] = useState('small');
  const [type, setType] = useState('dot');
  const [position, setPosition] = useState('left');

  return (
   <div>
      <div> 
       <span style={radioTitleStyle}>类型</span>
       <RadioGroup onChange={e => setType(e.target.value)} value={type}>
        <Radio value='dot'>dot</Radio>
        <Radio value='line'>line</Radio>
        <Radio value='columnar'>columnar</Radio>
      </RadioGroup>
      </div>
       <div> 
       <span style={radioTitleStyle}>位置</span>
       <RadioGroup onChange={e => setPosition(e.target.value)} value={position}>
        <Radio value='left'>left</Radio>
        <Radio value='center'>center</Radio>
        <Radio value='right'>right</Radio>
      </RadioGroup>
      </div>
      <div> 
       <span style={radioTitleStyle}>尺寸</span>
       <RadioGroup onChange={e => setSize(e.target.value)} value={size}>
        <Radio value={'small'}>small</Radio>
        <Radio value={'medium'}>medium</Radio>
      </RadioGroup>
      </div>
      <br/>
      <Carousel style={style} indicatorType={type} indicatorPosition={position} indicatorSize={size}>
        <div style={contentPinkStyle}>
          <h3>1</h3>
        </div>
        <div style={contentBlueStyle}>
          <h3>2</h3>
        </div>
        <div style={contentPinkStyle}>
         <h3>3</h3>
        </div>
        <div style={contentBlueStyle}>
          <h3>4</h3>
        </div>
        <div style={contentPinkStyle}>
          <h3>5</h3>
       </div>
      </Carousel>
   </div>
  );
}

indicatorUsage.story = {
  name: 'indicator usage',
};

// 箭头主题、显示时机
export const arrowShow = () => {
  const [arrowType, setArrowType] = useState('always');
  const [show, setShow] = useState(true);
  
  return (
   <div>
      <div> 
        <span style={radioTitleStyle}>展示箭头</span>
        <RadioGroup onChange={e => setShow(e.target.value)} value={show}>
          <Radio value={true}>展示</Radio>
          <Radio value={false}>不展示</Radio>
        </RadioGroup>
      </div>
      <div> 
        <span style={radioTitleStyle}>展示时机</span>
        <RadioGroup onChange={e => setArrowType(e.target.value)} value={arrowType}>
          <Radio value='always'>always</Radio>
          <Radio value='hover'>hover</Radio>
        </RadioGroup>
      </div>
      <br/>
      <Carousel style={style} showArrow={show} arrowType={arrowType}>
        <div style={contentPinkStyle}>
          <h3>1</h3>
        </div>
        <div style={contentBlueStyle}>
          <h3>2</h3>
        </div>
        <div style={contentPinkStyle}>
          <h3>3</h3>
        </div>
        <div style={contentBlueStyle}>
          <h3>4</h3>
        </div>
        <div style={contentPinkStyle}>
          <h3>5</h3>
        </div>
      </Carousel>
   </div>
  )
};

arrowShow.story = {
  name: 'arrow show',
};


// 箭头参数
export const customArrow = () => {
  const arrowProps = {
    leftArrow: { children: <IconArrowLeft size='large'/>},
    rightArrow: { children: <IconArrowRight size='large'/> },
  };

  return (
   <div>
      <Carousel style={style} arrowProps={arrowProps}>
        <div style={contentPinkStyle}>
          <h3>1</h3>
        </div>
        <div style={contentBlueStyle}>
          <h3>2</h3>
        </div>
        <div style={contentPinkStyle}>
         <h3>3</h3>
        </div>
        <div style={contentBlueStyle}>
          <h3>4</h3>
        </div>
        <div style={contentPinkStyle}>
          <h3>5</h3>
       </div>
      </Carousel>
   </div>
  );
}

customArrow.story = {
  name: 'custom arrow',
};

// 自动播放参数 
export const autoPlayExample = () => (
   <div>
      <Carousel style={style} autoPlay={{ interval: 1000, hoverToPause: true }}>
      <div style={contentPinkStyle}>
        <h3>1</h3>
      </div>
      <div style={contentBlueStyle}>
        <h3>2</h3>
      </div>
      <div style={contentPinkStyle}>
        <h3>3</h3>
      </div>
      <div style={contentBlueStyle}>
        <h3>4</h3>
      </div>
      <div style={contentPinkStyle}>
        <h3>5</h3>
      </div>
    </Carousel>
   </div>
);

autoPlayExample.story = {
  name: 'auto play example',
};

// 动画效果与速度
export const animationUsage = () => {
  const [animation, setAnimation] = useState('slide');
  const [speed, setSpeed] = useState(1000);
  
  return (
   <div>
      <div> 
        <span style={radioTitleStyle}>动画效果</span>
        <RadioGroup onChange={e => setAnimation(e.target.value)} value={animation}>
          <Radio value='slide'>slide</Radio>
          <Radio value='fade'>fade</Radio>
        </RadioGroup>
      </div>
      <div> 
        <span style={radioTitleStyle}>切换速度</span>
        <RadioGroup onChange={e => setSpeed(e.target.value)} value={speed}>
          <Radio value={1000}>1000ms</Radio>
          <Radio value={2000}>2000ms</Radio>
          <Radio value={3000}>3000ms</Radio>
        </RadioGroup>
      </div>
      <br/>
      <Carousel style={style} speed={speed} animation={animation}>
        <div style={contentPinkStyle}>
          <h3>1</h3>
        </div>
        <div style={contentBlueStyle}>
          <h3>2</h3>
        </div>
        <div style={contentPinkStyle}>
          <h3>3</h3>
        </div>
        <div style={contentBlueStyle}>
          <h3>4</h3>
        </div>
        <div style={contentPinkStyle}>
          <h3>5</h3>
        </div>
      </Carousel>
   </div>
  )
};

animationUsage.story = {
  name: 'animation usage',
};

// 受控的轮播图
class ControlledDemo extends React.Component {
   constructor(props) {
        super(props);
        this.ref = React.createRef();
        this.handleNext=this.handleNext.bind(this);
        this.handlePrev=this.handlePrev.bind(this);
        this.handleGoTo=this.handleGoTo.bind(this);
        this.handlePlay=this.handlePlay.bind(this);
        this.handleStop=this.handleStop.bind(this);
        this.state = {
            activeIndex: 0,
        };
    }

    handleNext(){
        this.ref.current.next();
    }

    handlePrev(){
        this.ref.current.prev();
    }

    handleGoTo(){
        this.ref.current.goTo(2);
    }

    handlePlay(){
        this.ref.current.play();
    }

    handleStop(){
        this.ref.current.stop();
    }

    onChange(activeIndex){
      this.setState({ activeIndex });
    }

     render() {
       return (
        <div>
          <Carousel style={style} animation='slide' ref={this.ref} activeIndex={this.state.activeIndex} onChange={this.onChange.bind(this)}>
            <div style={contentPinkStyle}>
              <h3>1</h3>
            </div>
            <div style={contentBlueStyle}>
              <h3>2</h3>
            </div>
            <div style={contentPinkStyle}>
              <h3>3</h3>
            </div>
            <div style={contentBlueStyle}>
             <h3>4</h3>
            </div>
            <div style={contentPinkStyle}>
              <h3>5</h3>
           </div>
          </Carousel>
          <br/>
          <Button onClick={this.handlePrev} style={{ marginRight: 10 }}>prev</Button>
          <Button onClick={this.handleNext} style={{ marginRight: 10 }}>next</Button>
          <Button onClick={this.handleGoTo} style={{ marginRight: 10 }}>goTo3</Button>
          <Button onClick={this.handlePlay} style={{ marginRight: 10 }}>play</Button>
          <Button onClick={this.handleStop} style={{ marginRight: 10 }}>stop</Button>
        </div>
        )
     }
}

export const controlledUsage  = () => <ControlledDemo />;

controlledUsage.story = {
  name: 'controlled usage',
};

class RefDemo extends React.Component {
   constructor(props) {
        super(props);
        this.ref = React.createRef();
        this.handleNext=this.handleNext.bind(this);
        this.handlePrev=this.handlePrev.bind(this);
        this.handleGoTo=this.handleGoTo.bind(this);
        this.handlePlay=this.handlePlay.bind(this);
        this.handleStop=this.handleStop.bind(this);
    }

    handleNext(){
        this.ref.current.next();
    }

    handlePrev(){
        this.ref.current.prev();
    }

    handleGoTo(){
        this.ref.current.goTo(2);
    }

    handlePlay(){
        this.ref.current.play();
    }

    handleStop(){
        this.ref.current.stop();
    }


     render() {
       return (
        <div>
          <Carousel style={style} animation='slide' ref={this.ref}>
            <div style={contentPinkStyle}>
              <h3>1</h3>
            </div>
            <div style={contentBlueStyle}>
              <h3>2</h3>
            </div>
            <div style={contentPinkStyle}>
              <h3>3</h3>
            </div>
            <div style={contentBlueStyle}>
             <h3>4</h3>
            </div>
            <div style={contentPinkStyle}>
              <h3>5</h3>
           </div>
          </Carousel>
          <br/>
          <Button onClick={this.handlePrev} style={{ marginRight: 10 }}>prev</Button>
          <Button onClick={this.handleNext} style={{ marginRight: 10 }}>next</Button>
          <Button onClick={this.handleGoTo} style={{ marginRight: 10 }}>goTo3</Button>
          <Button onClick={this.handlePlay} style={{ marginRight: 10 }}>play</Button>
          <Button onClick={this.handleStop} style={{ marginRight: 10 }}>stop</Button>
        </div>
        )
     }
}

export const refUsage  = () => <RefDemo />;

refUsage.story = {
  name: 'ref usage',
};

export const slideDirection = () => (
    <Carousel style={style} autoPlay={false} slideDirection='right'>
      <div style={contentPinkStyle}>
        <h3>index0</h3>
      </div>
      <div style={contentPinkStyle}>
        <h3>index1</h3>
      </div>
      <div style={contentPinkStyle}>
        <h3>index2</h3>
      </div>
    </Carousel>
);

slideDirection.story = {
  name: 'slide direction',
};

export const fix1482 = () => {
  const [children, setChildren] = useState([1, 2]);
  const carouselRef = React.useRef();

  React.useEffect(() => {
    setChildren([3, 4, 5]);
  },[])

  return (
    <div 
      onMouseEnter={() => {
        console.log('onMouseEnter play');
        carouselRef.current.play();
      }}
      onMouseLeave={() => {
        console.log('onMouseLeave stop');
        carouselRef.current.stop();
      }}
    >
      <Carousel style={style} autoPlay={false} ref={carouselRef}>
        {children.map((item, index)=>{
          return (
            <div style={contentPinkStyle} key={index}>
              <h3>index{index}</h3>
            </div>
          )
        })}
      </Carousel>
    </div>
);
}

fix1482.story = {
  name: 'fix-1482',
};


export const OnlyOneChildrenNotPlay = () => (
    <Carousel style={style} autoPlay onChange={e => {console.log('onChange', e)}}>
      <div style={contentPinkStyle}>
        <h3>1</h3>
      </div>
    </Carousel>
);

export const renderStateInChildren = () => {
  const [curIndex, setCurIndex] = useState(0);

  return (
    <Carousel style={style}
      autoPlay={false}
      activeIndex={curIndex}
      onChange={(index) => {setCurIndex(index)}}>
        {[1, 2, 3, 4].map((src, index) => {
          return (
            <div style={contentPinkStyle} key={index}>
              {curIndex}
            </div>
          )
        })}
    </Carousel>
  )
};