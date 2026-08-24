"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useCreateTask,
  useDeleteTask,
  useTaskAssignees,
  useTaskTimeline,
  useTasks,
  useUpdateTask,
  useUpdateTaskStatus,
} from "@/hooks/useTasks";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { getApiErrorMessage } from "@/lib/api";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ClipboardList,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Clock3,
  Calendar,
  User as UserIcon,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Loader2,
  Edit3,
} from "lucide-react";
import { cn, formatDateTime, formatDate } from "@/lib/utils";
import type { TaskStatus } from "@/types";

function getTaskStatusLabel(status: TaskStatus) {
  switch (status) {
    case "PENDING":
      return "Pendiente";
    case "IN_PROGRESS":
      return "En curso";
    case "COMPLETED":
      return "Completada";
    case "CANCELLED":
      return "Cancelada";
  }
}

function getTaskStatusClass(status: TaskStatus) {
  switch (status) {
    case "PENDING":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "IN_PROGRESS":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "COMPLETED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "CANCELLED":
      return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
}

function getTaskEventLabel(type: "CREATED" | "UPDATED" | "STATUS_CHANGED" | "DELETED") {
  switch (type) {
    case "CREATED":
      return "Creada";
    case "UPDATED":
      return "Actualizada";
    case "STATUS_CHANGED":
      return "Cambio de estado";
    case "DELETED":
      return "Eliminada";
  }
}

export default function TasksPage() {
  const toast = useToast();
  const { user: currentUser } = useAuth();

  // Filters & Scope
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("ALL");

  // Selection & Forms
  const [taskInput, setTaskInput] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingDeletedTaskIds, setPendingDeletedTaskIds] = useState<string[]>([]);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [taskDraft, setTaskDraft] = useState({
    title: "",
    description: "",
    assignedToId: "" as string | null,
    dueDate: "" as string | null,
  });

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [newModalDraft, setNewModalDraft] = useState({
    title: "",
    description: "",
    assignedToId: "",
    dueDate: "",
  });

  // Queries & Mutations
  const tasksQuery = useTasks();
  const taskList = tasksQuery.data?.tasks ?? [];
  const assigneesQuery = useTaskAssignees();
  const assignees = assigneesQuery.data ?? [];

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();

  const visibleTaskList = taskList.filter((task) => !pendingDeletedTaskIds.includes(task.id));

  // Filtered List
  const filteredTasks = useMemo(() => {
    return visibleTaskList.filter((task) => {
      // Scope filter
      if (scope === "mine") {
        const isMine =
          task.createdById === currentUser?.id || task.assignedToId === currentUser?.id;
        if (!isMine) return false;
      }

      // Status filter
      if (statusFilter !== "ALL" && task.status !== statusFilter) {
        return false;
      }

      // Assignee filter
      if (selectedAssigneeId !== "ALL") {
        if (selectedAssigneeId === "UNASSIGNED") {
          if (task.assignedToId) return false;
        } else if (task.assignedToId !== selectedAssigneeId) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = task.description?.toLowerCase().includes(q);
        const matchAssignee = task.assignedTo?.name.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchAssignee) return false;
      }

      return true;
    });
  }, [visibleTaskList, scope, statusFilter, selectedAssigneeId, searchQuery, currentUser?.id]);

  // Metrics
  const totalTasks = visibleTaskList.length;
  const pendingTasks = visibleTaskList.filter((t) => t.status === "PENDING").length;
  const inProgressTasks = visibleTaskList.filter((t) => t.status === "IN_PROGRESS").length;
  const completedTasks = visibleTaskList.filter((t) => t.status === "COMPLETED").length;
  const hasCompletedTasks = completedTasks > 0;

  // Resolved selection
  const resolvedSelectedTaskId = (() => {
    if (visibleTaskList.length === 0) {
      return null;
    }
    if (selectedTaskId && visibleTaskList.some((task) => task.id === selectedTaskId)) {
      return selectedTaskId;
    }
    return visibleTaskList[0].id;
  })();

  const selectedTask = visibleTaskList.find((task) => task.id === resolvedSelectedTaskId) ?? null;

  const {
    data: selectedTaskTimeline = [],
    isLoading: isTimelineLoading,
  } = useTaskTimeline(selectedTask?.id ?? "", {
    enabled: !!selectedTask,
  });

  const isTaskEditing = isEditingTask && !!selectedTask;

  const getNextSelectedTaskIdAfterRemoval = (removedTaskIds: string[]) => {
    if (!resolvedSelectedTaskId || removedTaskIds.length === 0) {
      return resolvedSelectedTaskId;
    }

    const removedTaskIdSet = new Set(removedTaskIds);
    if (!removedTaskIdSet.has(resolvedSelectedTaskId)) {
      return resolvedSelectedTaskId;
    }

    return visibleTaskList.find((task) => !removedTaskIdSet.has(task.id))?.id ?? null;
  };

  const handleToggleTask = async (
    taskId: string,
    currentStatus: TaskStatus,
  ) => {
    const nextStatus: TaskStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";
    try {
      await updateTaskStatus.mutateAsync({ id: taskId, status: nextStatus });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar la tarea"));
    }
  };

  const handleSetTaskStatus = async (
    taskId: string,
    status: TaskStatus,
  ) => {
    try {
      await updateTaskStatus.mutateAsync({ id: taskId, status });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar la tarea"));
    }
  };

  const handleQuickAddTask = async () => {
    const trimmed = taskInput.trim();
    if (!trimmed) return;

    try {
      const created = await createTask.mutateAsync({ title: trimmed });
      setSelectedTaskId(created.id);
      setTaskInput("");
      toast.success("Tarea agregada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear la tarea"));
    }
  };

  const handleCreateModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newModalDraft.title.trim();
    if (!trimmed) {
      toast.error("El título es obligatorio");
      return;
    }

    try {
      const created = await createTask.mutateAsync({
        title: trimmed,
        description: newModalDraft.description.trim() || undefined,
        assignedToId: newModalDraft.assignedToId || undefined,
        dueDate: newModalDraft.dueDate ? new Date(newModalDraft.dueDate).toISOString() : undefined,
      });
      setSelectedTaskId(created.id);
      setShowCreateModal(false);
      setNewModalDraft({ title: "", description: "", assignedToId: "", dueDate: "" });
      toast.success("Tarea creada exitosamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear la tarea"));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const previousSelectedTaskId = resolvedSelectedTaskId;
    const nextSelectedTaskId = getNextSelectedTaskIdAfterRemoval([taskId]);

    setPendingDeletedTaskIds((current) =>
      current.includes(taskId) ? current : [...current, taskId],
    );

    if (nextSelectedTaskId !== resolvedSelectedTaskId) {
      setSelectedTaskId(nextSelectedTaskId);
      setIsEditingTask(false);
    }

    try {
      await deleteTask.mutateAsync(taskId);
      setPendingDeletedTaskIds((current) => current.filter((id) => id !== taskId));
      toast.success("Tarea eliminada");
    } catch (error) {
      setPendingDeletedTaskIds((current) => current.filter((id) => id !== taskId));
      if (nextSelectedTaskId !== previousSelectedTaskId) {
        setSelectedTaskId(previousSelectedTaskId);
      }
      toast.error(getApiErrorMessage(error, "No se pudo borrar la tarea"));
    }
  };

  const handleClearCompletedTasks = async () => {
    const completedIds = visibleTaskList
      .filter((task) => task.status === "COMPLETED")
      .map((task) => task.id);

    if (completedIds.length === 0) return;

    const previousSelectedTaskId = resolvedSelectedTaskId;
    const nextSelectedTaskId = getNextSelectedTaskIdAfterRemoval(completedIds);

    setPendingDeletedTaskIds((current) => [...new Set([...current, ...completedIds])]);

    if (nextSelectedTaskId !== resolvedSelectedTaskId) {
      setSelectedTaskId(nextSelectedTaskId);
      setIsEditingTask(false);
    }

    try {
      await Promise.all(completedIds.map((id) => deleteTask.mutateAsync(id)));
      setPendingDeletedTaskIds((current) =>
        current.filter((id) => !completedIds.includes(id)),
      );
      setShowDeleteAllModal(false);
      toast.success("Tareas completadas eliminadas");
    } catch (error) {
      setPendingDeletedTaskIds((current) => current.filter((id) => !completedIds.includes(id)));
      if (nextSelectedTaskId !== previousSelectedTaskId) {
        setSelectedTaskId(previousSelectedTaskId);
      }
      toast.error(getApiErrorMessage(error, "No se pudieron borrar las tareas"));
    }
  };

  const handleEditSelectedTask = () => {
    if (!selectedTask) return;

    setTaskDraft({
      title: selectedTask.title,
      description: selectedTask.description ?? "",
      assignedToId: selectedTask.assignedToId ?? "",
      dueDate: selectedTask.dueDate ? selectedTask.dueDate.substring(0, 10) : "",
    });
    setIsEditingTask(true);
  };

  const handleCancelTaskEdit = () => {
    if (!selectedTask) {
      setTaskDraft({ title: "", description: "", assignedToId: "", dueDate: "" });
      setIsEditingTask(false);
      return;
    }

    setTaskDraft({
      title: selectedTask.title,
      description: selectedTask.description ?? "",
      assignedToId: selectedTask.assignedToId ?? "",
      dueDate: selectedTask.dueDate ? selectedTask.dueDate.substring(0, 10) : "",
    });
    setIsEditingTask(false);
  };

  const handleSaveTaskEdit = async () => {
    if (!selectedTask) return;

    const trimmedTitle = taskDraft.title.trim();
    if (!trimmedTitle) {
      toast.error("La tarea necesita un título para guardarse.");
      return;
    }

    const data: {
      title: string;
      description: string | null;
      assignedToId?: string | null;
      dueDate?: string | null;
    } = {
      title: trimmedTitle,
      description: taskDraft.description.trim() || null,
    };

    if (taskDraft.assignedToId) {
      data.assignedToId = taskDraft.assignedToId;
    }
    if (taskDraft.dueDate) {
      data.dueDate = new Date(taskDraft.dueDate).toISOString();
    }

    try {
      await updateTask.mutateAsync({
        id: selectedTask.id,
        data,
      });
      setIsEditingTask(false);
      toast.success("Tarea actualizada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar la tarea"));
    }
  };

  if (tasksQuery.isLoading) {
    return (
      <DashboardLayout>
        <LoadingState icon={<ClipboardList className="w-5 h-5 text-primary" />} message="Cargando tareas del local..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-1.5 shrink-0 rounded-full bg-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
                Tareas del local
              </h1>
            </div>
            <p className="ml-4.5 mt-1 text-xs sm:text-sm text-muted-foreground">
              Gestión operativa del equipo y seguimiento de actividades
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDeleteAllModal(true)}
              disabled={!hasCompletedTasks || deleteTask.isPending}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/20"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Borrar completadas
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="shadow-sm shadow-primary/25"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nueva tarea
            </Button>
          </div>
        </div>

        {/* Metrics KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <Card className="p-4 border-border/70 hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activas</span>
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <ClipboardList className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{pendingTasks + inProgressTasks}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{totalTasks} en total</p>
          </Card>

          <Card className="p-4 border-border/70 hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pendientes</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{pendingTasks}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Por comenzar</p>
          </Card>

          <Card className="p-4 border-border/70 hover:border-sky-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">En curso</span>
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{inProgressTasks}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">En progreso</p>
          </Card>

          <Card className="p-4 border-border/70 hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Completadas</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{completedTasks}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Finalizadas</p>
          </Card>
        </div>

        {/* Filter Toolbar */}
        <Card className="p-3 border-border/80">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Left: Scope & Status Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Scope Selector */}
              <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    scope === "all"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  Equipo
                </button>
                <button
                  type="button"
                  onClick={() => setScope("mine")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    scope === "mine"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  Mis tareas
                </button>
              </div>

              {/* Status Pills */}
              <div className="hidden sm:flex items-center gap-1">
                {(["ALL", "PENDING", "IN_PROGRESS", "COMPLETED"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                      statusFilter === st
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {st === "ALL" ? "Todas" : getTaskStatusLabel(st)}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Search & Assignee filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar tarea..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-muted/40 rounded-xl text-xs text-foreground placeholder:text-muted-foreground/60 border border-border/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              {assignees.length > 1 && (
                <select
                  value={selectedAssigneeId}
                  onChange={(e) => setSelectedAssigneeId(e.target.value)}
                  className="h-9 px-2.5 bg-muted/40 rounded-xl text-xs text-foreground border border-border/60 focus:border-primary/50 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">Todo el personal</option>
                  <option value="UNASSIGNED">Sin asignar</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </Card>

        {/* Main Content: Split Master-Detail */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Quick Add + Task List (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Quick Add Bar */}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleQuickAddTask();
              }}
            >
              <input
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="Agregar nueva tarea rápida (presiona Enter)..."
                className="h-10 min-w-0 flex-1 rounded-2xl border border-border/70 bg-card px-4 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-xs"
                maxLength={120}
              />
              <Button type="submit" disabled={createTask.isPending || !taskInput.trim()} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {createTask.isPending ? "Guardando" : "Agregar"}
              </Button>
            </form>

            {/* Task List Card */}
            <Card className="overflow-hidden border-border/80 bg-card shadow-xs">
              <div className="border-b border-border/60 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Lista de tareas
                  </h3>
                  <Badge variant="primary" dot>
                    {filteredTasks.length}
                  </Badge>
                </div>

                <div className="sm:hidden flex items-center gap-1">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "ALL" | TaskStatus)}
                    className="h-7 text-[11px] bg-muted/60 rounded-lg px-2 text-foreground border border-border/60"
                  >
                    <option value="ALL">Todas</option>
                    <option value="PENDING">Pendientes</option>
                    <option value="IN_PROGRESS">En curso</option>
                    <option value="COMPLETED">Completadas</option>
                  </select>
                </div>
              </div>

              <div className="p-3 divide-y divide-border/40">
                {filteredTasks.length === 0 ? (
                  <EmptyState
                    icon={<ClipboardList className="h-8 w-8 text-muted-foreground/40" />}
                    title={
                      searchQuery || statusFilter !== "ALL" || scope === "mine"
                        ? "No se encontraron tareas con los filtros aplicados"
                        : "No hay tareas creadas aún"
                    }
                    subtitle={
                      searchQuery || statusFilter !== "ALL"
                        ? "Prueba cambiando o limpiando los filtros de búsqueda."
                        : "Comienza agregando una tarea para organizar las actividades del local."
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    {filteredTasks.map((task) => {
                      const isSelected = task.id === selectedTask?.id;
                      const isOverdue =
                        task.dueDate &&
                        task.status !== "COMPLETED" &&
                        task.status !== "CANCELLED" &&
                        new Date(task.dueDate) < new Date();

                      return (
                        <div
                          key={task.id}
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            setIsEditingTask(false);
                          }}
                          className={cn(
                            "rounded-2xl border p-3.5 transition-all cursor-pointer select-none",
                            isSelected
                              ? "border-primary/50 bg-primary/5 shadow-xs"
                              : "border-border/60 bg-background/50 hover:bg-muted/30 hover:border-border",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {/* Fast Toggle Checkbox */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleTask(task.id, task.status);
                              }}
                              className="mt-0.5 shrink-0 rounded-lg p-0.5 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                              aria-label={`Cambiar estado rápido de ${task.title}`}
                            >
                              {task.status === "COMPLETED" ? (
                                <CheckSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <Square className="h-5 w-5 hover:text-primary" />
                              )}
                            </button>

                            {/* Task Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <span
                                  className={cn(
                                    "text-sm font-semibold transition-all line-clamp-1",
                                    task.status === "COMPLETED"
                                      ? "text-muted-foreground line-through decoration-muted-foreground/60"
                                      : "text-foreground",
                                  )}
                                >
                                  {task.title}
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                    getTaskStatusClass(task.status),
                                  )}
                                >
                                  {getTaskStatusLabel(task.status)}
                                </span>
                              </div>

                              {task.description && (
                                <p className="mt-1 text-xs text-muted-foreground/80 line-clamp-1">
                                  {task.description}
                                </p>
                              )}

                              {/* Badges row */}
                              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                {task.assignedTo ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium text-foreground/80 border border-border/40">
                                    <UserIcon className="h-3 w-3 text-primary" />
                                    {task.assignedTo.name}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/30 px-1.5 py-0.5 text-muted-foreground/70">
                                    <Users className="h-3 w-3" />
                                    Sin asignar
                                  </span>
                                )}

                                {task.dueDate && (
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium border",
                                      isOverdue
                                        ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                        : "bg-muted/60 text-muted-foreground border-border/40",
                                    )}
                                  >
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(task.dueDate)}
                                    {isOverdue && " (Vencida)"}
                                  </span>
                                )}

                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 ml-auto">
                                  <Clock3 className="h-3 w-3" />
                                  {formatDateTime(task.updatedAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column: Selected Task Inspector & Timeline (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {selectedTask ? (
              <Card className="border-border/80 bg-card overflow-hidden shadow-xs">
                {/* Header & Quick Action Buttons */}
                <div className="border-b border-border/60 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Detalle de la tarea
                      </span>
                      <h2 className="text-base font-bold text-foreground mt-0.5 truncate">
                        {selectedTask.title}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedTask.createdBy?.name
                          ? `Creada por ${selectedTask.createdBy.name}`
                          : "Creada desde el dashboard"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isTaskEditing ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleCancelTaskEdit}
                            disabled={updateTask.isPending}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveTaskEdit}
                            disabled={updateTask.isPending}
                          >
                            {updateTask.isPending ? "Guardando" : "Guardar cambios"}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleEditSelectedTask}
                          >
                            <Edit3 className="h-3.5 w-3.5 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteTask(selectedTask.id)}
                            disabled={deleteTask.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Eliminar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status Transition Quick Selectors */}
                  <div className="mt-4 pt-3 border-t border-border/40">
                    <span className="text-[11px] font-semibold text-muted-foreground block mb-2">
                      Estado actual:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map(
                        (status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => handleSetTaskStatus(selectedTask.id, status)}
                            disabled={updateTaskStatus.isPending || selectedTask.status === status}
                            className={cn(
                              "rounded-xl border px-3 py-1 text-xs font-semibold transition-all disabled:opacity-60",
                              selectedTask.status === status
                                ? getTaskStatusClass(status)
                                : "border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted",
                            )}
                          >
                            {getTaskStatusLabel(status)}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>

                {/* Task Details Content / Form */}
                <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/10">
                  {isTaskEditing ? (
                    <div className="space-y-3.5">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-foreground">
                          Título de la tarea
                        </label>
                        <input
                          value={taskDraft.title}
                          onChange={(e) =>
                            setTaskDraft((prev) => ({ ...prev, title: e.target.value }))
                          }
                          maxLength={120}
                          className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-foreground">
                          Descripción o notas
                        </label>
                        <textarea
                          value={taskDraft.description}
                          onChange={(e) =>
                            setTaskDraft((prev) => ({ ...prev, description: e.target.value }))
                          }
                          rows={3}
                          maxLength={500}
                          placeholder="Detalles e instrucciones para el equipo..."
                          className="w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-foreground">
                            Asignar a
                          </label>
                          <select
                            value={taskDraft.assignedToId ?? ""}
                            onChange={(e) =>
                              setTaskDraft((prev) => ({
                                ...prev,
                                assignedToId: e.target.value || null,
                              }))
                            }
                            className="h-10 w-full rounded-xl border border-border/70 bg-card px-2.5 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none"
                          >
                            <option value="">Sin asignar</option>
                            {assignees.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.role})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold text-foreground">
                            Fecha límite
                          </label>
                          <input
                            type="date"
                            value={taskDraft.dueDate ?? ""}
                            onChange={(e) =>
                              setTaskDraft((prev) => ({
                                ...prev,
                                dueDate: e.target.value || null,
                              }))
                            }
                            className="h-10 w-full rounded-xl border border-border/70 bg-card px-3 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Descripción
                        </span>
                        <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed bg-card p-3 rounded-xl border border-border/60">
                          {selectedTask.description?.trim() || "Sin descripción adicional por ahora."}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-card border border-border/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Asignado
                          </span>
                          <span className="font-semibold text-foreground mt-0.5 block truncate">
                            {selectedTask.assignedTo?.name ?? "Sin asignar"}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-card border border-border/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Fecha Límite
                          </span>
                          <span className="font-semibold text-foreground mt-0.5 block truncate">
                            {selectedTask.dueDate ? formatDate(selectedTask.dueDate) : "Sin fecha"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Timeline / Historial Section */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Historial
                      </h3>
                      <Badge variant="secondary">{selectedTaskTimeline.length}</Badge>
                    </div>
                    {isTimelineLoading && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {selectedTaskTimeline.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                      Todavía no hay eventos registrados para esta tarea.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {selectedTaskTimeline.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs space-y-1"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-foreground">
                              {getTaskEventLabel(event.type)}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatDateTime(event.createdAt)}
                            </span>
                          </div>

                          <div className="text-muted-foreground text-[11px]">
                            {event.fromStatus && event.fromStatus !== event.toStatus ? (
                              <span>
                                {getTaskStatusLabel(event.fromStatus)} → {getTaskStatusLabel(event.toStatus)}
                              </span>
                            ) : (
                              <span>{getTaskStatusLabel(event.toStatus)}</span>
                            )}
                          </div>

                          <p className="text-[11px] text-muted-foreground pt-0.5 border-t border-border/40">
                            {event.createdBy?.name ?? "Sistema"}
                            {event.note ? ` - ${event.note}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-12 text-center border-dashed border-border/80 bg-muted/10">
                <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border/60 flex items-center justify-center mx-auto mb-3 text-muted-foreground/50">
                  <ClipboardList className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Ninguna tarea seleccionada</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  Haz clic en una tarea de la lista para ver sus detalles, editarla o consultar su historial de cambios.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Crear Nueva Tarea"
        size="md"
      >
        <form onSubmit={handleCreateModalSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Título <span className="text-rose-500">*</span>
            </label>
            <input
              required
              value={newModalDraft.title}
              onChange={(e) => setNewModalDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Ej: Revisar stock de vitrina..."
              maxLength={120}
              className="h-10 w-full rounded-xl border border-border/80 bg-card px-3 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              Descripción o Instrucciones
            </label>
            <textarea
              value={newModalDraft.description}
              onChange={(e) =>
                setNewModalDraft((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
              maxLength={500}
              placeholder="Detalla qué necesita hacerse y cualquier consideración especial..."
              className="w-full rounded-xl border border-border/80 bg-card px-3 py-2 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Asignar a compañero
              </label>
              <select
                value={newModalDraft.assignedToId}
                onChange={(e) =>
                  setNewModalDraft((prev) => ({ ...prev, assignedToId: e.target.value }))
                }
                className="h-10 w-full rounded-xl border border-border/80 bg-card px-3 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none cursor-pointer"
              >
                <option value="">Sin asignar (general)</option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Fecha Límite
              </label>
              <input
                type="date"
                value={newModalDraft.dueDate}
                onChange={(e) =>
                  setNewModalDraft((prev) => ({ ...prev, dueDate: e.target.value }))
                }
                className="h-10 w-full rounded-xl border border-border/80 bg-card px-3 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createTask.isPending || !newModalDraft.title.trim()}
            >
              {createTask.isPending ? "Creando..." : "Crear tarea"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete All Completed Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        onConfirm={handleClearCompletedTasks}
        title="Borrar tareas completadas"
        message={`Se eliminarán ${completedTasks} tarea${completedTasks !== 1 ? "s" : ""} completada${completedTasks !== 1 ? "s" : ""}. Esta acción no se puede deshacer.`}
        confirmText="Borrar todas"
        cancelText="Cancelar"
      />
    </DashboardLayout>
  );
}
