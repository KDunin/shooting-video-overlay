"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@kdunin/component-library";
import { useLocation } from "@tanstack/react-router";
import { HomeIcon } from "lucide-react";
import type * as React from "react";

const navMain = [{ title: "Dashboard", url: "/", icon: <HomeIcon /> }];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center h-12 gap-2 p-2 overflow-hidden group-data-[collapsible=icon]:p-0 transition-[width,height,padding]">
              <img
                src="/logo.webp"
                className="aspect-square size-8 rounded-lg shrink-0"
                width={32}
                height={32}
                alt="Receipt Scanner"
              />
              <span className="truncate font-semibold">Budget Tracker</span>
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
                render={
                  <a href={item.url}>
                    {item.icon}
                    {item.title}
                  </a>
                }
              />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
