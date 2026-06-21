import { SidebarInset, SidebarProvider, SidebarTrigger } from "@kdunin/component-library";
import { AppSidebar } from "#/components/app-sidebar";
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";

import TanStackQueryProvider from "#/integrations/tanstack-query/root-provider";
import TanStackQueryDevtools from "#/integrations/tanstack-query/devtools";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";
import { getLogToClient } from "#/lib/logto";
import { createServerFn } from "@tanstack/react-start";

interface MyRouterContext {
  queryClient: QueryClient;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const fetchUser = createServerFn({ method: "GET" }).handler(async () => {
  if (process.env.AUTH_ENABLED !== "true") {
    return { userInfo: {} as Record<string, unknown>, claims: {} as Record<string, unknown>, isAuthenticated: true };
  }
  try {
    const client = await getLogToClient();
    const resp = await client.getContext({ getAccessToken: false });
    return {
      userInfo: (resp.userInfo ?? {}) as Record<string, unknown>,
      claims: (resp.claims ?? {}) as Record<string, unknown>,
      isAuthenticated: resp.isAuthenticated,
    };
  } catch {
    return { userInfo: {} as Record<string, unknown>, claims: {} as Record<string, unknown>, isAuthenticated: false };
  }
});

const signInFn = createServerFn({ method: "GET" }).handler(async () => {
  const logtoClient = await getLogToClient();
  await logtoClient.signIn({
    redirectUri: `${process.env.VITE_BASE_URL}/callback`,
  });
});

export const signOutFn = createServerFn({ method: "GET" }).handler(async () => {
  const logtoClient = await getLogToClient();
  await logtoClient.signOut(`${process.env.VITE_BASE_URL}/`);
});

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ location }) => {
    if (location.pathname.startsWith("/api")) {
      return {};
    }

    const { userInfo, isAuthenticated, claims } = await fetchUser();

    if (!isAuthenticated) {
      await signInFn();
    }

    return {
      user: userInfo,
      isAuthenticated,
      claims,
    };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ShotLens" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="h-screen overflow-hidden font-sans antialiased [overflow-wrap:anywhere]">
        <TanStackQueryProvider>
          <SidebarProvider className="h-screen">
            <AppSidebar variant="inset" />
            <SidebarInset>
              <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
                <SidebarTrigger className="w-auto px-4" />
              </header>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[
              { name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> },
              TanStackQueryDevtools,
            ]}
          />
        </TanStackQueryProvider>
        <Scripts />
      </body>
    </html>
  );
}
