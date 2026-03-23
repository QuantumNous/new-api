import React from 'react';

const ConsolePageShell = ({
  children,
  className = '',
  contentClassName = '',
  fullWidth = false,
}) => {
  const sectionClassName = [
    'console-page-shell',
    fullWidth ? 'console-page-shell--full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const innerClassName = ['console-page-shell__inner', contentClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={sectionClassName}>
      <div className={innerClassName}>{children}</div>
    </section>
  );
};

export default ConsolePageShell;
