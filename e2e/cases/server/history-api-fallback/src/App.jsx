const pathname = typeof window === 'undefined' ? '/' : window.location.pathname || '/';

const renderPage = () => {
  if (pathname === '/a') {
    return <div>A</div>;
  }

  if (pathname === '/b') {
    return <div>B</div>;
  }

  return (
    <div>
      home
      <div>
        <a href="/a">A</a>
      </div>
      <div>
        <a href="/b">B</a>
      </div>
    </div>
  );
};

export const App = () => renderPage();
