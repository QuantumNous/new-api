export async function getApp() {
  const name = 'circle';
  const { default: Component } = await import(`@e2e/assets/${name}.svg?react`);
  const { default: url } = await import(`@e2e/assets/${name}.svg?url`);

  return () => (
    <div>
      <Component id="component" />
      <img id="url" src={url} alt="url" />
    </div>
  );
}
