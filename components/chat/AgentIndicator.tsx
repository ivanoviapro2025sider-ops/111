'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Bot } from 'lucide-react';

interface AgentIndicatorProps {
  agentName: string;
  agentColor: string;
  handoffFrom?: string;
}

export default function AgentIndicator({ agentName, agentColor, handoffFrom }: AgentIndicatorProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="flex items-center justify-center gap-2 py-2 px-4"
      >
        {handoffFrom && (
          <>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Bot className="w-3 h-3" />
              <span>{handoffFrom}</span>
            </div>
            <motion.div
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </>
        )}
        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: handoffFrom ? 0.4 : 0 }}
          className="flex items-center gap-1.5 bg-muted rounded-full px-3 py-1"
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: agentColor }}
          />
          <span className="text-xs font-medium">{agentName}</span>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
