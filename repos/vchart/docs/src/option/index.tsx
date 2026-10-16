import { useContext, useEffect, useState } from 'react';
import { Layout } from '@arco-design/web-react';
import { useLocation } from 'react-router-dom';
import { IOptionOutlineNode, Outline, recordOutline } from './outline';
import { Description, IOptionDescriptionNode } from './description';

import './index.css';
import { LanguageContext } from '../i18n';

interface IProps {
  baseUrl: string;
  getOutline: () => Promise<any>;
  getDescription: (pathName: string) => Promise<any>;
  style?: React.CSSProperties;
  descriptionStyle?: React.CSSProperties;
  outlineStyle?: React.CSSProperties;
}

export function OptionDocument(props: IProps) {
  const { language, setLanguage } = useContext(LanguageContext);

  const location = useLocation();
  const pathName = decodeURI(location.pathname);

  const [outline, setOutline] = useState<IOptionOutlineNode | null>(null);
  const [description, setDescription] = useState<IOptionDescriptionNode[]>([]);

  const [siderWidth, setSiderWidth] = useState<number>(280);

  const handleMoving = (event: any, { width }: any) => {
    setSiderWidth(Math.max(width, 120));
  };

  useEffect(() => {
    props.getOutline().then(outline => {
      setOutline(outline);
    });
  }, [language]);

  useEffect(() => {
    props.getDescription(pathName).then(description => {
      setDescription(description);
    });
  }, [language, pathName]);

  return (
    <Layout
      hasSider={true}
      style={{
        background: 'white',
        color: '#000000',
        ...(props.style ?? {})
      }}
    >
      <Layout.Sider
        style={{
          width: siderWidth,
          // borderRight: '1px solid rgb(229, 230, 235)',
          // boxShadow: '0 2px 5px 0 rgba(0, 0, 0, 0.08)',
          ...(props.outlineStyle ?? {})
        }}
        resizeBoxProps={{
          directions: ['right'],
          onMoving: handleMoving
        }}
      >
        {outline ? <Outline baseUrl={props.baseUrl} outline={outline} /> : null}
      </Layout.Sider>
      <Layout.Content
        style={{
          ...(props.descriptionStyle ?? {})
        }}
      >
        {description && outline ? (
          <Description
            baseUrl={props.baseUrl}
            descriptions={description}
            recordedOutline={recordOutline(outline)}
            outlineWidth={siderWidth}
            style={{ minHeight: '100%' }}
          />
        ) : null}
      </Layout.Content>
    </Layout>
  );
}
