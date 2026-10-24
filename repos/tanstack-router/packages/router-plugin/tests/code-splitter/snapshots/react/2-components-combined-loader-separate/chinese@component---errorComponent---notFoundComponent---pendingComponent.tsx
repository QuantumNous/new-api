import * as React from 'react';
function HomeComponent() {
  return <div className="p-2">
      <Demo title="标题很好看，谁说不是呢？" />
      <Demo title="The title looks great, who can deny that?" />
    </div>;
}
interface DemoProps {
  title: string;
}
function Demo({
  title
}: DemoProps) {
  return <h1 style={{
    color: '#2969ff',
    fontSize: '2rem',
    fontWeight: 'bold',
    letterSpacing: '3px'
  }}>
      {title}
    </h1>;
}
export { HomeComponent as component };