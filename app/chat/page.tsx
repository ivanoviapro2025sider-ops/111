'use client';

import React, { useEffect, useState } from 'react';
import ChatWindow from '@/components/chat/ChatWindow';
import { useAgentStore } from '@/stores/agentStore';
import { useChatStore } from '@/stores/chatStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Bot, Settings2, FileText, ChevronRight, ChevronLeft } from 'lucide-react';

export default function ChatPage() {
  const { agents, currentAgentId, setCurrentAgent, fetchAgents } = useAgentStore();
  const { currentChatId } = useChatStore();
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const currentAgent = agents.find(a => a.id === currentAgentId);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <ChatWindow />
      </div>

      {currentChatId && (
        <>
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="h-full w-4 flex items-center justify-center hover:bg-accent transition-colors border-l"
          >
            {rightPanelOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>

          {rightPanelOpen && (
            <div className="w-80 border-l bg-card flex flex-col shrink-0">
              <div className="p-4 border-b">
                <div className="flex items-center gap-2 mb-3">
                  <Settings2 className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Agent Settings</h3>
                </div>

                <Select
                  value={currentAgentId || ''}
                  onValueChange={(value) => setCurrentAgent(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.filter(a => a.isActive).map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: agent.color }}
                          />
                          {agent.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentAgent && (
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                        style={{ backgroundColor: currentAgent.color }}
                      >
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{currentAgent.name}</div>
                        <div className="text-xs text-muted-foreground">{currentAgent.description}</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Model</span>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {currentAgent.model}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Temperature</span>
                        <span>{currentAgent.temperature}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Top P</span>
                        <span>{currentAgent.topP}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max Tokens</span>
                        <span>{currentAgent.maxTokens}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stream</span>
                        <span>{currentAgent.stream ? 'On' : 'Off'}</span>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">Attached Files</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Drag & drop files onto the chat or use the attachment button
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
