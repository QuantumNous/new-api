import React, { useState, useEffect } from 'react';
import { Card, Spin, Typography, Layout } from '@douyinfe/semi-ui';
import { IconGlobe } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 本地Markdown文档查看器
 * 
 * 功能特性：
 * - 直接在前端渲染markdown文件
 * - 实时HTML渲染
 * - 响应式设计
 * - 美观的样式展示
 */

const { Text, Title } = Typography;
const { Header, Content } = Layout;

const Usage = () => {
  const { t } = useTranslation();
  const [documentContent, setDocumentContent] = useState('');
  const [loading, setLoading] = useState(false);
  
  console.log('[Usage] Component initialized');

  // 加载本地markdown文档
  const loadLocalDocument = async () => {
    console.log('[Usage] Loading local markdown document...');
    setLoading(true);
    
    try {
      // 直接读取markdown文件
      const response = await fetch('/docs/using/using.md');
      
      if (response.ok) {
        const content = await response.text();
        console.log('[Usage] Document loaded successfully, length:', content.length);
        setDocumentContent(content);
      } else {
        console.error('[Usage] Failed to load document, status:', response.status);
        setDocumentContent('');
      }
    } catch (error) {
      console.error('[Usage] Error loading document:', error);
      setDocumentContent('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[Usage] useEffect started');
    
    // 直接加载本地文档
    loadLocalDocument();
  }, []);

  return (
    <Layout style={{ minHeight: '100vh', background: '#f6f7f9' }}>
      <Header style={{ background: '#fff', padding: '16px 24px', borderBottom: '1px solid #e8e8e8' }}>
        <Title level={3} style={{ margin: 0 }}>
          <IconGlobe style={{ marginRight: 8 }} />
          {t('使用须知')}
        </Title>
      </Header>
      
      <Content style={{ padding: '24px' }}>
        <Card 
          title={t('文档内容')} 
          style={{ minHeight: '600px' }}
          bodyStyle={{ padding: 0 }}
        >
          <Spin spinning={loading} tip={t('正在加载文档内容...')}>
            {documentContent ? (
              <div>
                {/* Markdown内容渲染 */}
                <div style={{ 
                  padding: '24px',
                  lineHeight: '1.8',
                  fontSize: '14px',
                  background: 'white',
                  borderRadius: '8px',
                  margin: '0 24px 24px 24px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}>
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // 自定义样式
                      h1: ({node, ...props}) => <h1 style={{color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '10px', marginTop: '30px', marginBottom: '15px'}} {...props} />,
                      h2: ({node, ...props}) => <h2 style={{color: '#2c3e50', borderBottom: '1px solid #ecf0f1', paddingBottom: '8px', marginTop: '30px', marginBottom: '15px'}} {...props} />,
                      h3: ({node, ...props}) => <h3 style={{color: '#2c3e50', marginTop: '30px', marginBottom: '15px'}} {...props} />,
                      h4: ({node, ...props}) => <h4 style={{color: '#2c3e50', marginTop: '30px', marginBottom: '15px'}} {...props} />,
                      h5: ({node, ...props}) => <h5 style={{color: '#2c3e50', marginTop: '30px', marginBottom: '15px'}} {...props} />,
                      h6: ({node, ...props}) => <h6 style={{color: '#2c3e50', marginTop: '30px', marginBottom: '15px'}} {...props} />,
                      p: ({node, ...props}) => <p style={{marginBottom: '15px'}} {...props} />,
                      code: ({node, inline, ...props}) => 
                        inline ? 
                          <code style={{
                            background: '#f8f9fa',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
                            fontSize: '0.9em'
                          }} {...props} /> :
                          <code {...props} />,
                      pre: ({node, ...props}) => <pre style={{
                        background: '#f8f9fa',
                        padding: '15px',
                        borderRadius: '6px',
                        overflowX: 'auto',
                        borderLeft: '4px solid #3498db'
                      }} {...props} />,
                      blockquote: ({node, ...props}) => <blockquote style={{
                        borderLeft: '4px solid #3498db',
                        margin: '20px 0',
                        padding: '10px 20px',
                        background: '#f8f9fa',
                        fontStyle: 'italic'
                      }} {...props} />,
                      table: ({node, ...props}) => <table style={{
                        borderCollapse: 'collapse',
                        width: '100%',
                        margin: '20px 0'
                      }} {...props} />,
                      th: ({node, ...props}) => <th style={{
                        border: '1px solid #ddd',
                        padding: '12px',
                        textAlign: 'left',
                        background: '#f8f9fa',
                        fontWeight: 'bold'
                      }} {...props} />,
                      td: ({node, ...props}) => <td style={{
                        border: '1px solid #ddd',
                        padding: '12px',
                        textAlign: 'left'
                      }} {...props} />,
                      img: ({node, ...props}) => <img style={{
                        maxWidth: '100%',
                        height: 'auto',
                        borderRadius: '4px',
                        margin: '10px 0'
                      }} {...props} />,
                      a: ({node, ...props}) => <a style={{
                        color: '#3498db',
                        textDecoration: 'none'
                      }} {...props} />,
                      ul: ({node, ...props}) => <ul style={{
                        margin: '15px 0',
                        paddingLeft: '30px'
                      }} {...props} />,
                      ol: ({node, ...props}) => <ol style={{
                        margin: '15px 0',
                        paddingLeft: '30px'
                      }} {...props} />,
                      li: ({node, ...props}) => <li style={{
                        margin: '5px 0'
                      }} {...props} />,
                      hr: ({node, ...props}) => <hr style={{
                        border: 'none',
                        borderTop: '1px solid #ecf0f1',
                        margin: '30px 0'
                      }} {...props} />
                    }}
                  >
                    {documentContent}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div 
                style={{ 
                  padding: '60px 24px',
                  textAlign: 'center',
                  color: '#999'
                }}
              >
                <IconGlobe size="48px" style={{ color: '#ddd', marginBottom: 16 }} />
                <Text type="tertiary">
                  {loading ? t('正在加载文档内容...') : t('文档加载失败')}
                </Text>
                <br />
                <Text type="tertiary" size="small">
                  {t('请检查 docs/using/using.md 文件是否存在')}
                </Text>
              </div>
            )}
          </Spin>
        </Card>
      </Content>
    </Layout>
  );
};

export default Usage;
