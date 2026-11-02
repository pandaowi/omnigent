/**
 * TasksBoard - Better-Paseo inspired Kanban Board for Tasks & Agent Automations.
 *
 * Organizes tasks and automated agent workflows into 4 visual state columns:
 * 1. Running (currently executing / running runs)
 * 2. Needs Action / Paused (paused automations or pending user attention)
 * 3. Active (healthy scheduled agent automations)
 * 4. Completed (completed task runs)
 */

import { useMemo } from "react";
import {
  AlertCircleIcon,
  BotIcon,
  CheckCircle2Icon,
  CirclePlayIcon,
  ClockIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { describeSchedule, formatNextRunAt } from "@/lib/scheduleText";
import { cn } from "@/lib/utils";
import type { ScheduledTask } from "@/lib/scheduledTasksApi";

interface TasksBoardProps {
  tasks: ScheduledTask[];
  now: Date;
  busyId?: string;
  onEdit: (task: ScheduledTask) => void;
  onPauseToggle: (task: ScheduledTask) => void;
  onRunNow: (task: ScheduledTask) => void;
  onDelete: (task: ScheduledTask) => void;
  onCardClick?: (task: ScheduledTask) => void;
}

interface ColumnConfig {
  id: "running" | "paused" | "active" | "completed";
  title: string;
  subtitle: string;
  icon: typeof PlayIcon;
  badgeTone: string;
  headerBorder: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: "running",
    title: "Running",
    subtitle: "Active agent workflows",
    icon: Loader2Icon,
    badgeTone: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    headerBorder: "border-blue-500/40",
  },
  {
    id: "paused",
    title: "Needs Action / Paused",
    subtitle: "Paused or awaiting resume",
    icon: PauseIcon,
    badgeTone: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    headerBorder: "border-amber-500/40",
  },
  {
    id: "active",
    title: "Active Scheduled",
    subtitle: "Armed recurring automations",
    icon: CheckCircle2Icon,
    badgeTone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    headerBorder: "border-emerald-500/40",
  },
  {
    id: "completed",
    title: "Completed / Settled",
    subtitle: "Past runs & settled tasks",
    icon: CheckCircle2Icon,
    badgeTone: "bg-muted text-muted-foreground border-border/50",
    headerBorder: "border-border/40",
  },
];

export function TasksBoard({
  tasks,
  now,
  busyId,
  onEdit,
  onPauseToggle,
  onRunNow,
  onDelete,
  onCardClick,
}: TasksBoardProps) {
  // Partition tasks into board columns:
  const partitioned = useMemo(() => {
    const running: ScheduledTask[] = [];
    const paused: ScheduledTask[] = [];
    const active: ScheduledTask[] = [];
    const completed: ScheduledTask[] = [];

    for (const task of tasks) {
      if (busyId === task.id || task.lastRunStatus === "running") {
        running.push(task);
      } else if (task.state === "paused") {
        paused.push(task);
      } else if (task.lastRunStatus === "succeeded" || task.state === "completed") {
        completed.push(task);
      } else if (task.state === "active") {
        active.push(task);
      } else {
        completed.push(task);
      }
    }

    return { running, paused, active, completed };
  }, [tasks, busyId]);

  return (
    <div
      data-testid="tasks-board"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start pb-8"
    >
      {COLUMNS.map((col) => {
        const colTasks = partitioned[col.id];
        const Icon = col.icon;
        const isRunningCol = col.id === "running";

        return (
          <div
            key={col.id}
            data-testid={`tasks-board-column-${col.id}`}
            className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/40 p-3 min-h-[360px]"
          >
            {/* Column Header */}
            <div className={cn("flex items-center justify-between pb-2 border-b", col.headerBorder)}>
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    isRunningCol && "animate-spin text-blue-500",
                    col.id === "paused" && "text-amber-500",
                    col.id === "active" && "text-emerald-500",
                    col.id === "completed" && "text-muted-foreground",
                  )}
                />
                <span className="text-sm font-semibold text-foreground tracking-tight">
                  {col.title}
                </span>
              </div>
              <Badge variant="outline" className={cn("text-xs font-semibold px-2 py-0.5", col.badgeTone)}>
                {colTasks.length}
              </Badge>
            </div>

            {/* Column Tasks */}
            <div className="flex flex-col gap-2.5 flex-1">
              {colTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg h-32">
                  <span>No tasks in this column</span>
                </div>
              ) : (
                colTasks.map((task) => (
                  <TaskKanbanCard
                    key={task.id}
                    task={task}
                    columnId={col.id}
                    now={now}
                    isBusy={busyId === task.id}
                    onEdit={onEdit}
                    onPauseToggle={onPauseToggle}
                    onRunNow={onRunNow}
                    onDelete={onDelete}
                    onClick={() => onCardClick?.(task)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskKanbanCard({
  task,
  columnId,
  now,
  isBusy,
  onEdit,
  onPauseToggle,
  onRunNow,
  onDelete,
  onClick,
}: {
  task: ScheduledTask;
  columnId: ColumnConfig["id"];
  now: Date;
  isBusy: boolean;
  onEdit: (task: ScheduledTask) => void;
  onPauseToggle: (task: ScheduledTask) => void;
  onRunNow: (task: ScheduledTask) => void;
  onDelete: (task: ScheduledTask) => void;
  onClick?: () => void;
}) {
  const scheduleText = useMemo(
    () => describeSchedule(task.rrule, task.timezone),
    [task.rrule, task.timezone],
  );
  const nextRunText = useMemo(
    () => (task.state === "active" ? formatNextRunAt(task.rrule, task.timezone, now) : null),
    [task.rrule, task.timezone, task.state, now],
  );

  return (
    <div
      data-testid={`task-card-${task.id}`}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border border-border/80 bg-background/80 p-3 shadow-xs transition-all duration-150 hover:border-border hover:shadow-sm hover:bg-background",
        isBusy && "ring-1 ring-blue-500/50 bg-blue-500/[0.03]",
      )}
    >
      {/* Card Header & Title */}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onClick}
          className="text-left font-medium text-sm text-foreground hover:underline line-clamp-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {task.name}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-6 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity"
              disabled={isBusy}
            >
              <MoreHorizontalIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuItem onClick={() => onRunNow(task)}>
              <CirclePlayIcon className="mr-2 size-3.5 text-emerald-500" />
              Run now
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPauseToggle(task)}>
              {task.state === "paused" ? (
                <>
                  <PlayIcon className="mr-2 size-3.5 text-blue-500" />
                  Resume automation
                </>
              ) : (
                <>
                  <PauseIcon className="mr-2 size-3.5 text-amber-500" />
                  Pause automation
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <PencilIcon className="mr-2 size-3.5 text-muted-foreground" />
              Edit details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(task)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2Icon className="mr-2 size-3.5" />
              Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Prompt preview snippet */}
      {task.prompt && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {task.prompt}
        </p>
      )}

      {/* Meta tags & schedule */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate">
          <ClockIcon className="size-3 shrink-0 text-muted-foreground/70" />
          <span className="truncate">{scheduleText}</span>
        </div>
        {nextRunText && (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium truncate">
            <span>● Next: {nextRunText}</span>
          </div>
        )}
      </div>

      {/* Card Footer: Quick Actions & Agent Badge */}
      <div className="flex items-center justify-between gap-1.5 pt-1">
        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted/60 border border-border/60 text-muted-foreground font-mono">
          <BotIcon className="size-3" />
          {task.agent_name || "lead-agent"}
        </span>

        <div className="flex items-center gap-1">
          {columnId === "paused" ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => onPauseToggle(task)}
              className="h-6 text-[10px] gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            >
              <PlayIcon className="size-2.5" />
              Resume
            </Button>
          ) : (
            <Button
              size="xs"
              variant="outline"
              onClick={() => onRunNow(task)}
              disabled={isBusy}
              className="h-6 text-[10px] gap-1 hover:border-emerald-500/50 hover:text-emerald-500"
            >
              <PlayIcon className="size-2.5 text-emerald-500" />
              Run
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
