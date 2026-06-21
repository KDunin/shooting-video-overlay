"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@kdunin/component-library";
import { useLocation, useRouteContext } from "@tanstack/react-router";
import { Columns2Icon, HomeIcon, LogOutIcon, VideoIcon } from "lucide-react";
import type * as React from "react";
import { signOutFn } from "#/routes/__root";

const navMain = [
  { title: "Library", url: "/", icon: <HomeIcon /> },
  { title: "Compare", url: "/compare", icon: <Columns2Icon /> },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();
  const ctx = useRouteContext({ from: "__root__", select: (c) => ({ user: c.user, isAuthenticated: c.isAuthenticated }) });

  const authEnabled = typeof process !== "undefined" && process.env?.AUTH_ENABLED === "true";

  const displayName =
    (ctx?.user?.name as string | undefined) ??
    (ctx?.user?.username as string | undefined) ??
    (ctx?.user?.email as string | undefined) ??
    "You";

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center h-12 gap-2 p-2 overflow-hidden group-data-[collapsible=icon]:p-0 transition-[width,height,padding]">
              <VideoIcon className="size-8 shrink-0 text-primary" />
              <span className="truncate font-semibold">ShotLens</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {navMain.map((item) => (
            <SidebarMenuItem key={item.title} className="px-2">
              <SidebarMenuButton
                className="h-12"
                isActive={pathname === item.url}
                asChild
              >
                <a href={item.url}>
                  {item.icon}
                  {item.title}
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      {authEnabled && ctx?.isAuthenticated && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem className="px-2">
              <div className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden truncate">
                {displayName}
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem className="px-2">
              <SidebarMenuButton className="h-10" asChild>
                <button type="button" onClick={() => signOutFn()}>
                  <LogOutIcon />
                  Sign out
                </button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}

      <SidebarRail />
    </Sidebar>
  );
}
