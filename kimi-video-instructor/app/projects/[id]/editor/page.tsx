'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { InstructionEditor } from '@/components/editor/InstructionEditor';
import { ChatWindow } from '@/components/chat/ChatWindow';

export default function EditorPage() {
  const params = useParams();
  const id = params.id as string;
  const { currentProject, fetchProject } = useProjectStore();
  const { setInstruction } = useEditorStore();

  useEffect(() => {
    if (id) fetchProject(id);
  }, [id, fetchProject]);

  useEffect(() => {
    if (currentProject?.instruction) {
      setInstruction(currentProject.instruction);
    }
    return () => setInstruction(null);
  }, [currentProject?.instruction, setInstruction]);

  if (!currentProject || currentProject.id !== id) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="grid h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[1fr_320px]">
      <div className="min-h-0 overflow-auto">
        <InstructionEditor />
      </div>
      <div className="border-l">
        <ChatWindow
          projectId={id}
          instruction={currentProject.instruction ?? null}
        />
      </div>
    </div>
  );
}
