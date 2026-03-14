'use client';

import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { ChatWindow } from '@/components/chat/ChatWindow';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ChatPage() {
  const { projects, fetchProjects } = useProjectStore();
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const selectedProject = projects.find((p) => p.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-6 md:p-8">
      <div className="mb-4 flex items-center gap-4">
        <h1 className="text-2xl font-bold">Chat</h1>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedId ? (
        <div className="flex-1 min-h-0 rounded-lg border">
          <ChatWindow
            projectId={selectedId}
            instruction={selectedProject?.instruction ?? null}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          <p className="text-lg">Select a project to start chatting</p>
          <p className="mt-2 text-sm">
            Chat about your instruction and get AI assistance
          </p>
        </div>
      )}
    </div>
  );
}
