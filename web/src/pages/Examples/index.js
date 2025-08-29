import React from 'react';
import { Layout, Typography, Card, Empty } from '@douyinfe/semi-ui';

const { Title, Text } = Typography;

const Examples = () => {
  return (
    <Layout>
      <Layout.Content style={{ padding: '24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <Card style={{ padding: '48px 24px' }}>
            <Empty
              image={<div style={{ fontSize: '64px', marginBottom: '16px' }}>🚧</div>}
              title="功能开发中"
              description={
                <div>
                  <Text type="secondary" style={{ fontSize: '16px' }}>
                    示例代码页面正在开发中，敬请期待！
                  </Text>
                  <br />
                  <Text type="tertiary" style={{ fontSize: '14px', marginTop: '8px' }}>
                    我们将为您提供丰富的API调用示例和最佳实践
                  </Text>
                </div>
              }
            />
          </Card>
        </div>
      </Layout.Content>
    </Layout>
  );
};

export default Examples;
