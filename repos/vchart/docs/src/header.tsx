import { useNavigate } from 'react-router-dom';
import menu from '../menu.json';
import { LanguageContext, LanguageEnum } from './i18n';
import { useContext } from 'react';

export function Header() {
  const { language, setLanguage } = useContext(LanguageContext);
  const navigate = useNavigate();

  return (
    <div className="navigator-container" style={{ zIndex: 1 }}>
      <div className="navigator-left">
        <div
          style={{
            marginRight: 16,
            cursor: 'pointer',
            paddingTop: 12,
            paddingBottom: 16,
            height: 48
          }}
        ></div>
        <div
          style={{
            marginRight: 8,
            cursor: 'pointer',
            display: 'flex',
            height: 24,
            lineHeight: '24px',
            fontWeight: 'bold'
          }}
        >
          VisActor Documents
        </div>
        <div
          style={{
            marginLeft: 8,
            marginRight: 8,
            borderLeft: '1px solid #1B1F23',
            opacity: 0.08,
            height: 14
          }}
        ></div>
        {menu.map(menuItem => {
          return (
            <div className="navigator-link" key={menuItem.menu} onClick={() => navigate(`/vchart/${menuItem.menu}`)}>
              <a>{menuItem.menu}</a>
            </div>
          );
        })}
      </div>
      <div className="navigator-right" style={{ width: 100 }}>
        <div
          className="navigator-tool"
          onClick={() => setLanguage(language === LanguageEnum.chinese ? LanguageEnum.english : LanguageEnum.chinese)}
        >
          {language}
        </div>
      </div>
    </div>
  );
}
