import { Component, Show, JSX } from 'solid-js';
import { useAuth } from '../hooks/useAuth';
import { Auth } from './Auth';

interface ProtectedRouteProps {
  children: JSX.Element
}

const ProtectedRoute: Component<ProtectedRouteProps> = (props) => {
  const { user } = useAuth();

  return (
    <Show
      when={user()}
      fallback={
        <div class="flex flex-col mx-auto px-4 py-8 text-center items-center justify-center gap-4">
          <Auth />
          <p>Please login to view this page</p>
        </div>
      }
    > 
      {props.children}
    </Show>
  );
};

export default ProtectedRoute;
