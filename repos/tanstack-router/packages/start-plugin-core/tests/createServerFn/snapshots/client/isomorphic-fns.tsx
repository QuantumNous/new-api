import { createClientRpc } from '@tanstack/react-start/client-rpc';
import { createFileRoute } from '@tanstack/react-router';
import { createIsomorphicFn, createServerFn } from '@tanstack/react-start';
import { useState } from 'react';
const getEnv = createIsomorphicFn().server(() => 'server').client(() => 'client');
const getServerEnv = createServerFn().handler(createClientRpc("6049dd46bc00e0980e387f3e74924b40e92f37634a3fe74a1a1facda9e9207c2"));
const getEcho = createIsomorphicFn().server((input: string) => 'server received ' + input).client(input => 'client received ' + input);
const getServerEcho = createServerFn().handler(createClientRpc("ebb82e0293952b7b1dde3f664dec4c139471c046d06d4dc4ca172f4f45e386d1"));
export const Route = createFileRoute('/isomorphic-fns')({
  component: RouteComponent,
  loader() {
    return {
      envOnLoad: getEnv()
    };
  }
});
function RouteComponent() {
  const {
    envOnLoad
  } = Route.useLoaderData();
  const [results, setResults] = useState<Partial<Record<string, string>>>();
  async function handleClick() {
    const envOnClick = getEnv();
    const echo = getEcho('hello');
    const [serverEnv, serverEcho] = await Promise.all([getServerEnv(), getServerEcho({
      data: 'hello'
    })]);
    setResults({
      envOnClick,
      echo,
      serverEnv,
      serverEcho
    });
  }
  const {
    envOnClick,
    echo,
    serverEnv,
    serverEcho
  } = results || {};
  return <div>
      <button onClick={handleClick} data-testid="test-isomorphic-results-btn">
        Run
      </button>
      {!!results && <div>
          <h1>
            <code>getEnv</code>
          </h1>
          When we called the function on the server it returned:
          <pre data-testid="server-result">{JSON.stringify(serverEnv)}</pre>
          When we called the function on the client it returned:
          <pre data-testid="client-result">{JSON.stringify(envOnClick)}</pre>
          When we called the function during SSR it returned:
          <pre data-testid="ssr-result">{JSON.stringify(envOnLoad)}</pre>
          <br />
          <h1>
            <code>echo</code>
          </h1>
          When we called the function on the server it returned:
          <pre data-testid="server-echo-result">
            {JSON.stringify(serverEcho)}
          </pre>
          When we called the function on the client it returned:
          <pre data-testid="client-echo-result">{JSON.stringify(echo)}</pre>
        </div>}
    </div>;
}