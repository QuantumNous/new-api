import * as Solid from 'solid-js';
import { Link, Outlet } from '@tanstack/solid-router';
import { Route } from "arrow-function.tsx";
const PostsComponent = () => {
  const posts = Route.useLoaderData();
  return <div className="p-2 flex gap-2">
      <ul className="list-disc pl-4">
        <Solid.For each={posts()}>
          {post => {
          return <li className="whitespace-nowrap">
                <Link to="/posts/$postId" params={{
              postId: post.id
            }} className="block py-1 text-blue-800 hover:text-blue-600" activeProps={{
              className: 'text-black font-bold'
            }}>
                  <div>{post.title.substring(0, 20)}</div>
                </Link>
              </li>;
        }}
        </Solid.For>
      </ul>
      <hr />
      <Outlet />
    </div>;
};
export { PostsComponent as component };