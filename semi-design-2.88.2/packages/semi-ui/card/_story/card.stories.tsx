import React from 'react';
import { storiesOf } from '@storybook/react';
import Card from '../index';
import CardGroup from '../cardGroup';
import Avatar from '../../avatar';
import Typography from '../../typography';

const { Text } = Typography;
const { Meta } = Card;

const stories = storiesOf('Card', module);

stories.add('default', () => (
    <CardGroup>
      <Card
        style={{ width: 300 }}
        title={
          <Meta 
            title="Semi Doc" 
            description="全面、易用、优质" 
            avatar={
              <Avatar 
                size="default"
                alt="example"
                src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg'
              />
            }
          />
        }
        headerExtraContent={
          <Text link={{ }}>
              More
          </Text>
        }
        cover={ 
          <img 
            alt="example" 
            src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
          />
        }
      >
        Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。
      </Card>
      <Card
        style={{ width: 300 }}
        title={
          <Meta 
            title="Semi Doc" 
            description="全面、易用、优质" 
            avatar={
              <Avatar 
                alt="example"
                size="default"
                src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg'
              />
            }
          />
        }
        headerExtraContent={
          <Text link={{ }}>
              More
          </Text>
        }
        cover={ 
          <img 
            alt="example" 
            src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
          />
        }
      >
        Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。
      </Card>
      <Card
        style={{ width: 300 }}
        title={
          <Meta 
            title="Semi Doc" 
            description="全面、易用、优质" 
            avatar={
              <Avatar 
                alt='example'
                size="default"
                src='https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg'
              />
            }
          />
        }
        headerExtraContent={
          <Text link={{ }}>
              More
          </Text>
        }
        cover={ 
          <img 
            alt="example" 
            src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg" 
          />
        }
      >
        Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。
      </Card>
    </CardGroup>
))