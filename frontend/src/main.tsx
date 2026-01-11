import React from "react";
import ReactDOM from "react-dom/client";
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";
import "./index.css";
import { Home } from "./pages/Home";
import { Viewer } from "./pages/Viewer";
import { Sender } from "./pages/Sender";
import { Status } from "./pages/Status";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
});

const senderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sender/$room",
  component: Sender,
});

const viewerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/viewer/$room",
  component: Viewer,
});

const statusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/status",
  component: Status,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  senderRoute,
  viewerRoute,
  statusRoute,
]);

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}
