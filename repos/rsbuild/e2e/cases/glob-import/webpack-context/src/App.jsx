const context = import.meta.webpackContext('./components', {
  regExp: /\.jsx$/,
  recursive: false,
});

const fileNames = context.keys();

const App = () => {
  const components = fileNames.map((fileName) => {
    const module = context(fileName);
    const Component = module.default;
    return <Component key={fileName} />;
  });

  return <div>{components}</div>;
};

export default App;
