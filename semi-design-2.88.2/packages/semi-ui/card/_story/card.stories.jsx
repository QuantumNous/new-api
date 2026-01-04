import React, { useState } from 'react';
import {
  Space,
  Button,
  Avatar,
  Typography,
  Row,
  Tabs,
  TabPane,
  Col,
  Skeleton,
  Switch,
  Rating,
} from '@douyinfe/semi-ui/';
import Card from '../index';
import CardGroup from '../cardGroup';
import {
  IconChevronRight,
  IconLikeThumb,
  IconLikeHeart,
  IconEdit,
  IconWrench,
} from '@douyinfe/semi-icons';

const { Text } = Typography;
const { Meta } = Card;

export default {
  title: 'Card',
}

export const Default = () => (
  <Space wrap>
    <Card
      title="基础卡片"
      style={{
        width: 360,
      }}
      aria-label='basic card'
      headerExtraContent={<Text link={{}}>更多</Text>}
    >
      Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。
    </Card>
    <Card
      title="titleisstringtitleisstringtitleisstringtitleisstringtitleisstring"
      style={{
        width: 360,
      }}
      headerExtraContent={<Text link={{}}>更多</Text>}
    >
      Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。
    </Card>
    <Card
      title="标题为字符串标题特别长标题特别长标题特别长标题特别长标题特别长"
      style={{
        width: 360,
      }}
      headerExtraContent={<Text link={{}}>更多</Text>}
    >
      Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。
    </Card>
    <Card
      title={<div>标题为node标题特别长标题特别长标题特别长标题特别长标题特别长</div>}
      style={{
        width: 360,
      }}
      headerExtraContent={<Text link={{}}>更多</Text>}
    >
      Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。
    </Card>
    <Card
      header={
        <div>
          头部内容为node头部内容特别长头部内容特别长头部内容特别长头部内容特别长头部内容特别长
        </div>
      }
      style={{
        width: 360,
      }}
      headerExtraContent={<Text link={{}}>更多</Text>}
    >
      Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。
    </Card>
    <Card
      header={<div>headerheaderheaderheaderheaderheaderheaderheaderheaderheader</div>}
      style={{
        width: 360,
      }}
      headerExtraContent={<Text link={{}}>更多</Text>}
    >
      Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。
    </Card>
  </Space>
);

export function Simple() {
  return (
    <Space align="start" vertical spacing="medium">
      <Card
        style={{
          width: 360,
        }}
      >
        Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。
      </Card>
      <Card
        style={{
          width: 360,
        }}
        bodyStyle={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Meta
          title="Semi Doc"
          avatar={
            <Avatar
              size="default"
              alt="Card meta avatar"
              src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg"
            />
          }
        />
        <Text link={{}}>
          <IconChevronRight />
        </Text>
      </Card>
    </Space>
  );
}

export const Cover = () => (
  <Card
    style={{
      width: 360,
    }}
    cover={
      <img
        alt="example"
        src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg"
      />
    }
  >
    <Meta title="卡片封面" />
  </Card>
);

export const Bordered = () => (
  <div
    style={{
      display: 'inline-block',
      padding: 20,
      backgroundColor: 'var(--semi-color-fill-0)',
    }}
  >
    <Card
      style={{
        width: 360,
      }}
      bordered={false}
      title="Semi Design"
    >
      基于 Semi Design 的中后台设计案例聚合分享平台，海量案例和模板代码助力体验 & 效率提升。
    </Card>
  </div>
);

export const HeaderLineFooterLine = () => (
  <Card
    style={{
      width: 360,
    }}
    title="Semi Design"
    headerLine={true}
    footerLine={false}
    footer="footer"
  >
    基于 Semi Design 的中后台设计案例聚合分享平台，海量案例和模板代码助力体验 & 效率提升。
  </Card>
);

export const Shadows = () => (
  <Space>
    <Card
      style={{
        width: 360,
      }}
      title="没有设置shadows"
    >
      基于 Semi Design 的中后台设计案例聚合分享平台，海量案例和模板代码助力体验 & 效率提升。
    </Card>
    <Card
      style={{
        width: 360,
      }}
      title="shadows为hover"
      shadows="hover"
    >
      基于 Semi Design 的中后台设计案例聚合分享平台，海量案例和模板代码助力体验 & 效率提升。
    </Card>
    <Card
      style={{
        width: 360,
      }}
      title="shadows为always"
      shadows="always"
    >
      基于 Semi Design 的中后台设计案例聚合分享平台，海量案例和模板代码助力体验 & 效率提升。
    </Card>
  </Space>
);

export const MetaDemo = () => (
  <Card
    style={{
      width: 360,
    }}
    title={
      <Meta
        title="Semi Doc"
        description="全面、易用、优质"
        avatar={
          <Avatar
            alt="Card meta avatar"
            size="default"
            src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg"
          />
        }
      />
    }
    headerExtraContent={<Text link={{}}>More</Text>}
    cover={
      <img
        alt="example"
        src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg"
      />
    }
    footerLine={true}
    footerStyle={{
      display: 'flex',
      justifyContent: 'flex-end',
    }}
    footer={
      <Space>
        <Button theme="borderless" type="primary">
          精选案例
        </Button>
        <Button theme="solid" type="primary">
          开始使用
        </Button>
      </Space>
    }
  >
    Semi Design 是由抖音前端团队与 UED
    团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
    Web 应用。
  </Card>
);

export const Inner = () => (
  <Card
    title="Card title"
    style={{
      width: 360,
    }}
  >
    <Card
      title="Inner Card title"
      style={{
        marginBottom: 20,
      }}
      headerExtraContent={<Text link={{}}>More</Text>}
    >
      Inner Card content
    </Card>
    <Card title="Inner Card title" headerExtraContent={<Text link={{}}>More</Text>}>
      Inner Card content
    </Card>
  </Card>
);

export const Grid = () => (
  <div
    style={{
      backgroundColor: 'var(--semi-color-fill-0)',
      padding: 20,
    }}
  >
    <Row gutter={[16, 16]}>
      <Col span={8}>
        <Card title="Card Title" bordered={false}>
          Card Content
        </Card>
      </Col>
      <Col span={8}>
        <Card title="Card Title" bordered={false}>
          Card Content
        </Card>
      </Col>
      <Col span={8}>
        <Card title="Card Title" bordered={false}>
          Card Content
        </Card>
      </Col>
    </Row>
    <Row gutter={[16, 16]}>
      <Col span={16}>
        <Card title="Card Title" bordered={false}>
          Card Content
        </Card>
      </Col>
      <Col span={8}>
        <Card title="Card Title" bordered={false}>
          Card Content
        </Card>
      </Col>
    </Row>
  </div>
);

export function Loading() {
  const [loading, setLoading] = useState(true);
  const { Meta } = Card;
  const { Title, Paragraph, Image } = Skeleton;
  return (
    <Space vertical align="start" spacing="medium">
      <Switch onChange={v => setLoading(!v)} aria-label='switch card loading status'/>
      <Card
        style={{
          width: 360,
        }}
        loading={loading}
        aria-busy={loading}
      >
        <Meta title="Semi Doc" description="全面、易用、优质" />
      </Card>
      <Card
        style={{
          width: 360,
        }}
        title={
          <Meta
            title={
              <Skeleton
                style={{
                  width: 80,
                }}
                placeholder={<Title />}
                loading={loading}
              >
                <Typography.Title heading={5}>Semi Doc</Typography.Title>
              </Skeleton>
            }
            description={
              <Skeleton
                style={{
                  width: 150,
                  marginTop: 12,
                }}
                placeholder={<Paragraph rows={1} />}
                loading={loading}
              >
                <Typography.Text>全面、易用、优质</Typography.Text>
              </Skeleton>
            }
            avatar={
              <Skeleton placeholder={<Skeleton.Avatar />} loading={loading}>
                <Avatar
                  size="default"
                  src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg"
                />
              </Skeleton>
            }
          />
        }
        headerExtraContent={
          <Skeleton
            style={{
              width: 50,
            }}
            placeholder={<Paragraph rows={1} />}
            loading={loading}
          >
            <Typography.Text link={{}}>More</Typography.Text>
          </Skeleton>
        }
        cover={
          <Skeleton
            style={{
              width: '100%',
              height: 110,
            }}
            placeholder={<Image />}
            loading={loading}
          >
            <img
              alt="example"
              src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg"
            />
          </Skeleton>
        }
      ></Card>
    </Space>
  );
}


export const WithTabs = () => (
  <Card title="Card title">
    <Tabs
      type="line"
      style={{
        marginTop: -20,
        marginBottom: -20,
      }}
    >
      <TabPane tab="Tab 1" itemKey="1">
        <p>content1</p>
        <p>content1</p>
        <p>content1</p>
      </TabPane>
      <TabPane tab="Tab 2" itemKey="2">
        <p>content2</p>
        <p>content2</p>
        <p>content2</p>
      </TabPane>
    </Tabs>
  </Card>
);

export const Actions = () => (
  <Space align="start">
    <Card
      style={{
        width: 360,
      }}
      title={
        <Meta
          title="Semi Doc"
          description="全面、易用、优质"
          avatar={
            <Avatar
              size="default"
              alt="Card meta avatar"
              src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg"
            />
          }
        />
      }
      actions={[<Rating defaultValue={4} />]}
      headerLine={false}
      footerLine={false}
      footerStyle={{
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      footer={
        <Space>
          <Button theme="solid" type="primary">
            打分
          </Button>
        </Space>
      }
    >
      Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。
    </Card>
    <Card
      style={{
        width: 360,
      }}
      title={
        <Meta
          title="Semi Doc"
          description="全面、易用、优质"
          avatar={
            <Avatar
              alt="Card meta avatar"
              size="default"
              src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg"
            />
          }
        />
      }
      actions={[<IconLikeThumb />, <IconLikeHeart />, <IconEdit />, <IconWrench />]}
      headerLine={false}
    >
      Semi Design 是由抖音前端团队与 UED
      团队共同设计开发并维护的设计系统。设计系统包含设计语言以及一整套可复用的前端组件，帮助设计师与开发者更容易地打造高质量的、用户体验一致的、符合设计规范的
      Web 应用。
    </Card>
  </Space>
);

export const CardGroupDemo = () => (
  <CardGroup spacing={12}>
    {new Array(3).fill(null).map((v, idx) => (
      <Card
        key={idx}
        style={{
          width: 300,
        }}
        title={
          <Meta
            title="Semi Doc"
            description="全面、易用、优质"
            avatar={
              <Avatar
                alt="Card meta avatar"
                size="default"
                src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/card-meta-avatar-docs-demo.jpg"
              />
            }
          />
        }
        headerExtraContent={<Text link>More</Text>}
        cover={
          <img
            alt="example"
            src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/card-cover-docs-demo.jpeg"
          />
        }
      >
        Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。
      </Card>
    ))}
  </CardGroup>
);

export const CardGroupGrid = () => (
  <CardGroup type="grid">
    {new Array(7).fill(null).map((v, idx) => (
      <Card
        key={idx}
        shadows="hover"
        title="Card title"
        headerLine={false}
        style={{
          width: 260,
        }}
        headerExtraContent={<Text link>More</Text>}
      >
        <Text>Card content</Text>
      </Card>
    ))}
  </CardGroup>
);