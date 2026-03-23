import React, { useMemo, useState } from 'react';
import { Info, Percent } from 'lucide-react';
import { Claude, OpenAI } from '../../helpers/lobeIcons';
import { CONSOLE_PRICING_PRODUCTS } from './consolePricingData';
import { useIsMobile } from '../../hooks/common/useIsMobile';

const PRODUCT_ICONS = {
  claude: Claude.Color,
  codex: OpenAI,
};

const renderFullFormulaContent = (content) => {
  const leftParenIndex = content.indexOf('（');
  const rightParenIndex = content.lastIndexOf('）');
  const accentText = '渠道折扣';

  if (leftParenIndex === -1 || rightParenIndex <= leftParenIndex) {
    return content;
  }

  const prefix = content.slice(0, leftParenIndex);
  const detail = content.slice(leftParenIndex, rightParenIndex + 1);
  const suffix = content.slice(rightParenIndex + 1);
  const accentIndex = suffix.indexOf(accentText);

  if (accentIndex === -1) {
    return (
      <>
        {prefix}
        <span className='console-model-pricing__formula-detail'>{detail}</span>
        {suffix}
      </>
    );
  }

  const beforeAccent = suffix.slice(0, accentIndex);
  const afterAccent = suffix.slice(accentIndex + accentText.length);

  return (
    <>
      {prefix}
      <span className='console-model-pricing__formula-detail'>{detail}</span>
      {beforeAccent}
      <span className='console-model-pricing__formula-accent'>{accentText}</span>
      {afterAccent}
    </>
  );
};

const renderCellContent = (cell) =>
  cell.accent ? (
    <span className='console-model-pricing__accent-value'>{cell.content}</span>
  ) : cell.label === '公式内容' &&
    typeof cell.content === 'string' &&
    cell.content.includes('渠道折扣') ? (
    renderFullFormulaContent(cell.content)
  ) : (
    cell.content
  );

const SectionCard = ({ title, badge, children }) => (
  <section className='console-model-pricing__section-card'>
    <div className='console-model-pricing__section-head'>
      <div className='console-model-pricing__section-title-wrap'>
        <h2 className='console-model-pricing__section-title'>{title}</h2>
      </div>
      {badge ? <div className='console-model-pricing__section-badge'>{badge}</div> : null}
    </div>
    <div className='console-model-pricing__section-body'>{children}</div>
  </section>
);

const DesktopTable = ({ headers, rows }) => (
  <div className='console-model-pricing__table-shell'>
    <table className='console-model-pricing__table'>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, index) => (
              <td
                key={`${row.key}-${cell.label}-${index}`}
                colSpan={cell.colSpan || 1}
                className={[
                  cell.strong ? 'console-model-pricing__cell--strong' : '',
                  cell.muted ? 'console-model-pricing__cell--muted' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {renderCellContent(cell)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const MobileCards = ({ rows }) => (
  <div className='console-model-pricing__mobile-list'>
    {rows.map((row) => (
      <article key={row.key} className='console-model-pricing__mobile-card'>
        {row.cells.map((cell, index) => (
          <div
            key={`${row.key}-${cell.label}-${index}`}
            className='console-model-pricing__mobile-field'
          >
            <div className='console-model-pricing__mobile-field-label'>
              {cell.label}
            </div>
            <div
              className={[
                'console-model-pricing__mobile-field-value',
                cell.strong ? 'console-model-pricing__cell--strong' : '',
                cell.muted ? 'console-model-pricing__cell--muted' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {renderCellContent(cell)}
            </div>
          </div>
        ))}
      </article>
    ))}
  </div>
);

const ProductTabs = ({ products, activeProductId, onChange }) => (
  <div className='console-model-pricing__tabs'>
    {products.map((product) => {
      const Icon = PRODUCT_ICONS[product.iconKey];
      const isActive = product.id === activeProductId;

      return (
        <button
          key={product.id}
          className={[
            'console-model-pricing__tab',
            isActive ? 'console-model-pricing__tab--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onChange(product.id)}
          type='button'
        >
          <span className='console-model-pricing__tab-icon'>
            <Icon size={20} />
          </span>
          <span>{product.label}</span>
        </button>
      );
    })}
  </div>
);

const ChannelCards = ({ channels }) => (
  <div
    className={[
      'console-model-pricing__channel-grid',
      channels.length === 1 ? 'console-model-pricing__channel-grid--single' : '',
    ]
      .filter(Boolean)
      .join(' ')}
  >
    {channels.map((channel) => (
      <article key={channel.key} className='console-model-pricing__channel-card'>
        <div className='console-model-pricing__channel-icon'>
          <Percent size={16} />
        </div>
        <div className='console-model-pricing__channel-title'>{channel.title}</div>
        <div className='console-model-pricing__channel-discount'>
          {channel.discount}
        </div>
        <div className='console-model-pricing__channel-rate'>{channel.rate}</div>
      </article>
    ))}
  </div>
);

const ConsolePricingPage = () => {
  const isMobile = useIsMobile();
  const [activeProductId, setActiveProductId] = useState('claude');

  const activeProduct = useMemo(
    () =>
      CONSOLE_PRICING_PRODUCTS.find((product) => product.id === activeProductId) ||
      CONSOLE_PRICING_PRODUCTS[0],
    [activeProductId],
  );

  const formulaBadge = (
    <>
      <Info size={14} />
      <span>含渠道优惠</span>
    </>
  );

  return (
    <div className='console-model-pricing'>
      <header className='console-model-pricing__hero'>
        <div className='console-model-pricing__hero-copy'>
          <h1 className='console-model-pricing__title'>模型价格</h1>
          <p className='console-model-pricing__description'>
            查看各产品的模型定价和渠道折扣信息
          </p>
        </div>
        <ProductTabs
          activeProductId={activeProduct.id}
          onChange={setActiveProductId}
          products={CONSOLE_PRICING_PRODUCTS}
        />
      </header>

      <div className='console-model-pricing__content'>
        <SectionCard badge={formulaBadge} title='优惠计算公式'>
          {isMobile ? (
            <MobileCards rows={activeProduct.formulaTable.rows} />
          ) : (
            <DesktopTable
              headers={activeProduct.formulaTable.headers}
              rows={activeProduct.formulaTable.rows}
            />
          )}
        </SectionCard>

        <SectionCard title='官方价格'>
          {isMobile ? (
            <MobileCards rows={activeProduct.officialPricingTable.rows} />
          ) : (
            <DesktopTable
              headers={activeProduct.officialPricingTable.headers}
              rows={activeProduct.officialPricingTable.rows}
            />
          )}
        </SectionCard>

        <SectionCard title='渠道'>
          <ChannelCards channels={activeProduct.channels} />
        </SectionCard>
      </div>
    </div>
  );
};

export default ConsolePricingPage;
