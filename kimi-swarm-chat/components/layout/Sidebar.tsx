"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Navigation } from "@/components/layout/Navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "h-screen border-r border-zinc-800 bg-zinc-950 p-3 transition-all",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        {!collapsed && <h1 className="text-sm font-bold text-zinc-100">KIMI Swarm Chat</h1>}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed((value) => !value)}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <Navigation collapsed={collapsed} />
    </aside>
  );
}
