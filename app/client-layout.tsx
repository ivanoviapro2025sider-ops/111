'use client';

import React from 'react';
import Navigation from '@/components/layout/Navigation';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Navigation>{children}</Navigation>
    </TooltipProvider>
  );
}
