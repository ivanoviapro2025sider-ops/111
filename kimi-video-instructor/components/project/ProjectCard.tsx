'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProjectStatus } from './ProjectStatus';
import { formatDuration, formatFileSize } from '@/lib/utils';
import type { Project } from '@/types/project';
import { ExternalLink, Eye, Pencil } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
}

function getProcessingProgress(project: Project): number | undefined {
  if (project.status !== 'processing') return undefined;
  const state = project.pipelineState;
  if (!state?.stages) return undefined;
  const stages = Object.values(state.stages);
  const completed = stages.filter((s) => s.status === 'completed').length;
  const total = stages.length;
  const currentStage = state.stages[state.currentStage];
  const stageProgress = currentStage?.progress ?? 0;
  return Math.round(((completed + stageProgress / 100) / total) * 100);
}

export function ProjectCard({ project }: ProjectCardProps) {
  const stepsCount = project.instruction?.totalSteps ?? project.instruction?.steps?.length ?? 0;
  const processingProgress = getProcessingProgress(project);
  const createdDate = new Date(project.createdAt).toLocaleDateString();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg">{project.name}</CardTitle>
          <CardDescription>{project.videoFileName}</CardDescription>
        </div>
        <ProjectStatus
          status={project.status}
          progress={processingProgress}
        />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>{formatDuration(project.videoDuration)}</span>
          <span>{stepsCount} steps</span>
          <span>{createdDate}</span>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button asChild size="sm">
          <Link href={`/projects/${project.id}`}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${project.id}/processing`}>
            <Eye className="mr-2 h-4 w-4" />
            View Status
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${project.id}/editor`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
