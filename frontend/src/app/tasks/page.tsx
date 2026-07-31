"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  useCreateTask,
  useDeleteTask,
  useTaskTimeline,
  useTasks,
  useUpdateTask,
  useUpdateTaskStatus,
} from "@/hooks/useTasks";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/contexts/ToastContext";
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
  Loader2,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

function getTaskStatusLabel(status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED") {
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

function getTaskStatusClass(status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED") {
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
  const [taskInput, setTaskInput] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingDeletedTaskIds, setPendingDeletedTaskIds] = useState<string[]>([]);
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [taskDraft, setTaskDraft] = useState({ title: "", description: "" });
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  const tasksQuery = useTasks();
  const taskList = tasksQuery.data?.tasks ?? [];
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const updateTaskStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();

  const visibleTaskList = taskList.filter((task) => !pendingDeletedTaskIds.includes(task.id));

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

  const completedTasks = visibleTaskList.filter((task) => task.status === "COMPLETED").length;
  const hasCompletedTasks = completedTasks > 0;

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
    currentStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
  ) => {
    const nextStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";
    try {
      await updateTaskStatus.mutateAsync({ id: taskId, status: nextStatus });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar la tarea"));
    }
  };

  const handleSetTaskStatus = async (
    taskId: string,
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
  ) => {
    try {
      await updateTaskStatus.mutateAsync({ id: taskId, status });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar la tarea"));
    }
  };

  const handleAddTask = async () => {
    const trimmed = taskInput.trim();
    if (!trimmed) {
      return;
    }

    try {
      const createdTask = await createTask.mutateAsync({ title: trimmed });
      setSelectedTaskId(createdTask.id);
      setTaskInput("");
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

    if (completedIds.length === 0) {
      return;
    }

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
    } catch (error) {
      setPendingDeletedTaskIds((current) => current.filter((id) => !completedIds.includes(id)));
      if (nextSelectedTaskId !== previousSelectedTaskId) {
        setSelectedTaskId(previousSelectedTaskId);
      }
      toast.error(getApiErrorMessage(error, "No se pudieron borrar las tareas"));
    }
  };

  const handleEditSelectedTask = () => {
    if (!selectedTask) {
      return;
    }

    setTaskDraft({
      title: selectedTask.title,
      description: selectedTask.description ?? "",
    });
    setIsEditingTask(true);
  };

  const handleCancelTaskEdit = () => {
    if (!selectedTask) {
      setTaskDraft({ title: "", description: "" });
      setIsEditingTask(false);
      return;
    }

    setTaskDraft({
      title: selectedTask.title,
      description: selectedTask.description ?? "",
    });
    setIsEditingTask(false);
  };

  const handleSaveTaskEdit = async () => {
    if (!selectedTask) {
      return;
    }

    const trimmedTitle = taskDraft.title.trim();
    if (!trimmedTitle) {
      toast.error("La tarea necesita un titulo para guardarse.");
      return;
    }

    try {
      await updateTask.mutateAsync({
        id: selectedTask.id,
        data: {
          title: trimmedTitle,
          description: taskDraft.description.trim() || null,
        },
      });
      setIsEditingTask(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo guardar la tarea"));
    }
  };

  if (tasksQuery.isLoading) {
    return (
      <DashboardLayout>
        <LoadingState icon={<ClipboardList className="w-5 h-5 text-primary/50" />} message="Cargando tareas..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5 lg:space-y-7">
        {/* Page Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <div className="h-7 w-1 shrink-0 rounded-full bg-primary" />
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">
                Tareas del local
              </h1>
            </div>
            <p className="ml-4 text-sm text-muted-foreground">
              Gestión operativa de tareas con timeline append-only
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="border-border/60 bg-muted text-foreground">
              {completedTasks}/{visibleTaskList.length} completadas
            </Badge>
            <Badge
              variant="secondary"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            >
              API real
            </Badge>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Task List */}
          <div className="space-y-4">
            {/* Add Task Form */}
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                handleAddTask();
              }}
            >
              <input
                value={taskInput}
                onChange={(event) => setTaskInput(event.target.value)}
                placeholder="Agregar nueva tarea..."
                className="h-10 min-w-0 flex-1 rounded-xl border border-border/60 bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                maxLength={120}
              />
              <Button type="submit" disabled={createTask.isPending} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {createTask.isPending ? "Guardando" : "Agregar"}
              </Button>
            </form>

            {/* Task List */}
            <div className="overflow-hidden rounded-3xl border border-primary/30 bg-primary/10">
              <div className="border-b border-primary/20 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Lista de tareas</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteAllModal(true)}
                    disabled={!hasCompletedTasks || deleteTask.isPending}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Borrar completadas
                  </Button>
                </div>
              </div>

              <div className="p-3">
                {visibleTaskList.length === 0 ? (
                  <EmptyState icon={<ClipboardList className="h-8 w-8" />} title="No hay tareas creadas aún" />
                ) : (
                  <div className="space-y-2">
                    {visibleTaskList.map((task) => {
                      const isSelected = task.id === selectedTask?.id;

                      return (
                        <div
                          key={task.id}
                          className={`rounded-2xl border px-3 py-2.5 transition cursor-pointer ${
                            isSelected
                              ? "border-primary/40 bg-primary/20"
                              : "border-primary/20 bg-background/40 hover:border-primary/40"
                          }`}
                          onClick={() => {
                            setSelectedTaskId(task.id);
                            setIsEditingTask(false);
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleTask(task.id, task.status);
                              }}
                              className="mt-0.5 shrink-0 rounded-md text-left"
                              aria-label={`Cambiar estado rápido de ${task.title}`}
                            >
                              {task.status === "COMPLETED" ? (
                                <CheckSquare className="h-4 w-4 text-primary" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <span
                                  className={`block text-sm ${
                                    task.status === "COMPLETED"
                                      ? "text-muted-foreground line-through"
                                      : "text-foreground"
                                  }`}
                                >
                                  {task.title}
                                </span>
                                <span
                                  className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getTaskStatusClass(task.status)}`}
                                >
                                  {getTaskStatusLabel(task.status)}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Clock3 className="h-3.5 w-3.5" />
                                <span>{formatDateTime(task.updatedAt)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Task Detail Panel */}
          <div className="space-y-4">
            {selectedTask ? (
              <>
                {/* Task Actions */}
                <div className="rounded-3xl border border-accent/30 bg-accent/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-foreground">
                        {selectedTask.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedTask.createdBy?.name
                          ? `Creada por ${selectedTask.createdBy.name}`
                          : "Creada desde el dashboard"}
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteTask(selectedTask.id)}
                      disabled={deleteTask.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Eliminar
                    </Button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const).map(
                      (status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleSetTaskStatus(selectedTask.id, status)}
                          disabled={updateTaskStatus.isPending || selectedTask.status === status}
                          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${getTaskStatusClass(status)}`}
                        >
                          {getTaskStatusLabel(status)}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {/* Task Edit */}
                <div className="rounded-3xl border border-primary/30 bg-primary/10 p-4">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Detalle editable
                    </p>
                    {isTaskEditing ? (
                      <div className="flex items-center gap-2">
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
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleEditSelectedTask}
                      >
                        Editar
                      </Button>
                    )}
                  </div>

                  {isTaskEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Título
                        </label>
                        <input
                          value={taskDraft.title}
                          onChange={(event) =>
                            setTaskDraft((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          maxLength={120}
                          className="h-10 w-full rounded-2xl border border-primary/30 bg-background/60 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Descripción
                        </label>
                        <textarea
                          value={taskDraft.description}
                          onChange={(event) =>
                            setTaskDraft((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          rows={3}
                          maxLength={280}
                          placeholder="Detalle opcional para el equipo"
                          className="w-full rounded-2xl border border-primary/30 bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {selectedTask.title}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {selectedTask.description?.trim() ||
                          "Sin descripción adicional por ahora."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div className="rounded-3xl border border-accent/30 bg-accent/10 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Historial
                    </p>
                    {isTimelineLoading && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {selectedTaskTimeline.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-accent/30 bg-background/40 px-3 py-4 text-xs text-muted-foreground text-center">
                      Todavía no hay eventos registrados para esta tarea.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedTaskTimeline.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-2xl border border-accent/20 bg-background/40 px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold text-foreground">
                                {getTaskEventLabel(event.type)}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {event.fromStatus && event.fromStatus !== event.toStatus
                                  ? `${getTaskStatusLabel(event.fromStatus)} → ${getTaskStatusLabel(event.toStatus)}`
                                  : getTaskStatusLabel(event.toStatus)}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {formatDateTime(event.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {event.createdBy?.name ?? "Sistema"}
                            {event.note ? ` - ${event.note}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-primary/30 bg-primary/5 px-3 py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-background/60 border border-primary/20 flex items-center justify-center mb-3">
                  <ClipboardList className="w-6 h-6 text-muted-foreground/30" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Selecciona una tarea para ver los detalles
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

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
