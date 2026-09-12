const loaderHelper = () => fetch('/api');
const ComponentHelper = () => <span>helper</span>;
const SplitLoader = async () => loaderHelper();
export { SplitLoader as loader };
const SplitComponent = () => <div>
      <ComponentHelper />
    </div>;
export { SplitComponent as component };