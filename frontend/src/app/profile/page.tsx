"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateProfile, useChangePassword, useProfile } from "@/hooks/useProfile";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { User as UserIcon, Lock, Mail, Shield } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { getApiErrorMessage } from "@/lib/api";

export default function ProfilePage() {
  const toast = useToast();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const currentUser = profile || user;

  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile.mutateAsync(formData);
      toast.success("Perfil actualizado correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al actualizar el perfil"));
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Contraseña cambiada correctamente");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al cambiar la contraseña. Verifica tu contraseña actual."));
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState icon={<UserIcon className="w-5 h-5 text-primary/50" />} message="Cargando perfil..." />
      </DashboardLayout>
    );
  }

  const initials = currentUser?.name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() || "U";

  const roleLabel: Record<string, string> = {
    ADMIN: "Administrador",
    CASHIER: "Cajero",
    INVENTORY_USER: "Inventario",
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 lg:space-y-7 max-w-2xl">

        {/* Page Header */}
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-7 rounded-full bg-primary shrink-0" />
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Mi Perfil</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-4">Gestiona tu información personal y seguridad</p>
        </div>

        {/* Avatar Card */}
        <div className="flex items-center gap-4 p-5 rounded-3xl border border-primary/30 bg-primary/10">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center shrink-0">
            <span className="text-xl font-bold text-primary" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>{initials}</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{currentUser?.name}</h2>
            <p className="text-sm text-muted-foreground">{currentUser?.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-background/60 text-primary border border-primary/30">
                <Shield className="w-3 h-3" />
                {roleLabel[currentUser?.role || ""] || currentUser?.role}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${currentUser?.active ? "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" : "bg-red-50 text-red-700 border-red-200/60 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${currentUser?.active ? "bg-emerald-500" : "bg-red-500"}`} />
                {currentUser?.active ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
        </div>

        {/* Personal Info Card */}
        <div className="rounded-3xl border border-accent/30 bg-accent/10 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-accent/20">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Información Personal</h3>
          </div>
          <div className="p-5">
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <Input
                label="Nombre"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">El email no puede ser modificado</p>
              </div>
              <div className="flex justify-end pt-2 border-t border-accent/20">
                <Button type="submit" loading={updateProfile.isPending}>Guardar Cambios</Button>
              </div>
            </form>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="rounded-3xl border border-primary/30 bg-primary/10 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-primary/20">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Cambiar Contraseña</h3>
          </div>
          <div className="p-5">
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <Input
                label="Contraseña Actual"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                required
              />
              <Input
                label="Nueva Contraseña"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                required
                minLength={6}
              />
              <Input
                label="Confirmar Nueva Contraseña"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
              <div className="flex justify-end pt-2 border-t border-primary/20">
                <Button type="submit" loading={changePassword.isPending}>Cambiar Contraseña</Button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
