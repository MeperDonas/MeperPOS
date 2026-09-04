"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCreateExpenseGroup,
  useCreateExpenseLabel,
  useDeleteExpenseGroup,
  useDeleteExpenseLabel,
  useExpenseGroups,
  useUpdateExpenseGroup,
  useUpdateExpenseLabel,
} from "@/hooks/useExpenses";
import { getApiErrorMessage } from "@/lib/api";
import { Pencil, Plus, Trash2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ExpenseTaxonomyModal({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const { data: groups = [], isLoading, isError } = useExpenseGroups();
  const createGroup = useCreateExpenseGroup();
  const updateGroup = useUpdateExpenseGroup();
  const deleteGroup = useDeleteExpenseGroup();
  const createLabel = useCreateExpenseLabel();
  const updateLabel = useUpdateExpenseLabel();
  const deleteLabel = useDeleteExpenseLabel();
  const [groupName, setGroupName] = useState("");
  const [newLabel, setNewLabel] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ id: string; groupId?: string; value: string } | null>(null);

  if (user?.role !== "ADMIN") return null;

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar la taxonomía"));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gestionar categorías" size="lg">
      <div className="space-y-5">
        <div className="flex items-end gap-2">
          <Input label="Nuevo grupo" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nombre del grupo" />
          <Button type="button" disabled={!groupName.trim() || createGroup.isPending} onClick={() => void run(async () => { await createGroup.mutateAsync({ name: groupName.trim() }); setGroupName(""); }, "Grupo creado")}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo grupo
          </Button>
        </div>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando grupos...</p>}
        {isError && <p role="alert" className="text-sm text-danger">No se pudieron cargar los grupos.</p>}
        {!isLoading && groups.length === 0 && <p className="text-sm text-muted-foreground">No hay grupos configurados.</p>}
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="rounded-2xl border border-border/70 p-4">
              <div className="flex items-center gap-2">
                {editing?.id === group.id ? <Input value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} /> : <h3 className="flex-1 font-bold">{group.name}</h3>}
                {editing?.id === group.id ? <Button size="sm" onClick={() => void run(async () => { await updateGroup.mutateAsync({ id: group.id, data: { name: editing.value.trim() } }); setEditing(null); }, "Grupo actualizado")}>Guardar</Button> : <Button size="sm" variant="ghost" aria-label={`Editar ${group.name}`} onClick={() => setEditing({ id: group.id, value: group.name })}><Pencil className="h-4 w-4" aria-hidden="true" /></Button>}
                <Button size="sm" variant="ghost" aria-label={`Desactivar ${group.name}`} onClick={() => void run(() => deleteGroup.mutateAsync(group.id), "Grupo desactivado")}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
              </div>
              <div className="mt-3 space-y-2 pl-4">
                {(group.labels ?? []).map((label) => (
                  <div key={label.id} className="flex items-center gap-2 text-sm">
                    {editing?.id === label.id ? <Input value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} /> : <span className="flex-1">{label.name}</span>}
                    {editing?.id === label.id ? <Button size="sm" onClick={() => void run(async () => { await updateLabel.mutateAsync({ groupId: group.id, id: label.id, data: { name: editing.value.trim() } }); setEditing(null); }, "Etiqueta actualizada")}>Guardar</Button> : <Button size="sm" variant="ghost" aria-label={`Editar ${label.name}`} onClick={() => setEditing({ id: label.id, groupId: group.id, value: label.name })}><Pencil className="h-4 w-4" aria-hidden="true" /></Button>}
                    <Button size="sm" variant="ghost" aria-label={`Desactivar ${label.name}`} onClick={() => void run(() => deleteLabel.mutateAsync({ groupId: group.id, id: label.id }), "Etiqueta desactivada")}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                  </div>
                ))}
                <div className="flex items-end gap-2 pt-2">
                  <Input label="Nueva etiqueta" value={newLabel[group.id] ?? ""} onChange={(e) => setNewLabel({ ...newLabel, [group.id]: e.target.value })} placeholder="Nombre de la etiqueta" />
                  <Button size="sm" variant="secondary" disabled={!newLabel[group.id]?.trim()} onClick={() => void run(async () => { await createLabel.mutateAsync({ groupId: group.id, data: { name: newLabel[group.id].trim() } }); setNewLabel({ ...newLabel, [group.id]: "" }); }, "Etiqueta creada")}><Plus className="h-4 w-4" aria-hidden="true" /> Agregar</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
