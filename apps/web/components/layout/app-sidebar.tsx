"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  ShieldAlert, 
  MessageSquare, 
  History,
  CheckSquare,
  Server,
  LayoutDashboard
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"

const navItems = [
  { title: "Chat", url: "/", icon: MessageSquare },
  { title: "Policy Manager", url: "/policies", icon: ShieldAlert },
  { title: "MCP Servers", url: "/servers", icon: Server },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar variant="inset" className="border-r">
      <SidebarHeader className="flex h-16 items-center justify-center border-b px-4 mt-2">
        <div className="flex items-center gap-2 font-bold text-xl w-full px-2 text-primary">
          <ShieldAlert className="h-6 w-6" />
          <span>Gatekeeper</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="py-4">
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.url || (item.url !== "/" && pathname?.startsWith(item.url))
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="text-xs text-muted-foreground text-center w-full">
          v1.0.0-beta
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
