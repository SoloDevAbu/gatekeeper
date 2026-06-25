"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert, MessageSquare, Server, Plus, Clock } from "lucide-react";

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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface ConversationSummary {
  conversationId: string;
  preview: string;
  updatedAt: string;
}

const navItems = [
  { title: "Policy Manager", url: "/policies", icon: ShieldAlert },
  { title: "MCP Servers", url: "/servers", icon: Server },
];

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = React.useState<
    ConversationSummary[]
  >([]);

  // Fetch conversation list whenever the route changes (catches new conversations)
  React.useEffect(() => {
    fetchConversations();
  }, [pathname]);

  async function fetchConversations() {
    try {
      const res = await fetch("http://localhost:3001/api/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      // agent-service may not be running yet — silently ignore
    }
  }

  const activeConversationId = pathname?.startsWith("/c/")
    ? pathname.split("/c/")[1]
    : null;

  return (
    <Sidebar variant="inset" className="border-r">
      <SidebarHeader className="border-b px-3 py-3">
        {/* Logo */}
        <div className="mb-3 flex items-center gap-2 px-1 text-base font-bold text-primary">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <span>Gatekeeper</span>
        </div>

        {/* New Chat button */}
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full justify-start gap-2 font-medium"
          onClick={() => router.push("/")}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </SidebarHeader>

      <SidebarContent className="overflow-y-auto py-2">
        {/* Conversation History */}
        {conversations.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 text-[10px] tracking-widest uppercase">
              Recent Chats
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {conversations.map((conv) => {
                  const isActive = activeConversationId === conv.conversationId;
                  return (
                    <SidebarMenuItem key={conv.conversationId}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="h-auto px-3 py-2"
                        tooltip={conv.preview}
                      >
                        <Link href={`/c/${conv.conversationId}`}>
                          <div className="flex w-full min-w-0 flex-col gap-0.5">
                            <span className="block truncate text-xs leading-snug font-medium">
                              {conv.preview}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-2.5 w-2.5 shrink-0" />
                              {formatRelativeTime(conv.updatedAt)}
                            </span>
                          </div>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Static navigation */}
        <SidebarGroup
          className={conversations.length > 0 ? "mt-2 border-t pt-2" : ""}
        >
          <SidebarGroupLabel className="px-3 text-[10px] tracking-widest uppercase">
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.url ||
                  (item.url !== "/" && pathname?.startsWith(item.url));

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
