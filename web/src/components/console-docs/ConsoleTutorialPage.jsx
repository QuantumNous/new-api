import React from 'react';
import { ArrowUpRight, BookOpenText, Newspaper, PlayCircle } from 'lucide-react';
import { TUTORIAL_PAGE } from './tutorialGuideData';

const GROUP_ICONS = {
  wechat: BookOpenText,
  blog: Newspaper,
  video: PlayCircle,
};

const ConsoleTutorialPage = () => (
  <div className='console-docs console-docs--tutorial'>
    <header className='console-docs__hero'>
      <div className='console-docs__hero-copy'>
        <div className='console-docs__eyebrow'>
          <span className='console-docs__eyebrow-icon'>
            <BookOpenText size={18} />
          </span>
          <span>学习资源</span>
        </div>
        <h1 className='console-docs__title'>{TUTORIAL_PAGE.title}</h1>
        <p className='console-docs__description'>{TUTORIAL_PAGE.description}</p>
      </div>
    </header>

    <div className='console-docs__content'>
      {TUTORIAL_PAGE.groups.map((group) => {
        const Icon = GROUP_ICONS[group.id] || BookOpenText;

        return (
          <section key={group.id} className='console-docs__section-card'>
            <div className='console-docs__section-head'>
              <div className='console-docs__section-title-wrap'>
                <span className='console-docs__section-icon' aria-hidden='true'>
                  <Icon size={16} />
                </span>
                <h2 className='console-docs__section-title'>{group.title}</h2>
              </div>
            </div>
            <div className='console-docs__section-body console-docs__section-body--padded'>
              <div className='console-docs__tutorial-grid'>
                {group.items.map((item) => (
                  <a
                    key={`${group.id}-${item.href}`}
                    className='console-docs__tutorial-card'
                    href={item.href}
                    rel='noreferrer'
                    target='_blank'
                  >
                    <div className='console-docs__tutorial-media'>
                      <img
                        alt={item.title}
                        className='console-docs__tutorial-image'
                        loading='lazy'
                        src={item.image}
                      />
                    </div>
                    <div className='console-docs__tutorial-copy'>
                      <div className='console-docs__tutorial-title-row'>
                        <h3 className='console-docs__tutorial-title'>{item.title}</h3>
                        <span className='console-docs__tutorial-link-icon'>
                          <ArrowUpRight size={16} />
                        </span>
                      </div>
                      <p className='console-docs__tutorial-description'>
                        {item.description}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  </div>
);

export default ConsoleTutorialPage;
