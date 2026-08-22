"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateProfile, useChangePassword, useProfile } from "@/hooks/useProfile";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { User as UserIcon, Lock, Mail, Shield, CheckCircle2 } from "lucide-react";
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
    if (passwordData.newPassword.length < 10) {
      toast.error("La contraseña debe tener al menos 10 caracteres");
      return;
    }
    try {
      await changePassword.mutateAsync({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Contraseña cambiada correctamente");
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Error al cambiar la contraseña. Verifica tu contraseña actual."
        )
      );
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState
          icon={<UserIcon className="w-5 h-5 text-primary/50" />}
          message="Cargando perfil..."
        />
      </DashboardLayout>
    );
  }

  const initials =
    currentUser?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const roleLabel: Record<string, string> = {
    ADMIN: "Administrador",
    CASHIER: "Cajero",
    INVENTORY_USER: "Inventario",
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 lg:space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <div className="w-1 h-6 rounded-full bg-primary shrink-0" />
              <h1 className="text-xl lg:text-2xl font-extrabold text-foreground">
                Mi Perfil
              </h1>
            </div>
            <p className="text-xs text-muted-foreground ml-4">
              Gestiona tu información personal y credenciales de acceso
            </p>
          </div>
        </div>

        {/* Top Mini Hero Card */}
        <div className="rounded-3xl border border-border/80 bg-card p-4 lg:p-5 shadow-xs flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-primary-light border border-primary/30 text-primary flex items-center justify-center font-bold text-lg shrink-0">
              {initials}
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {currentUser?.name}
              </h2>
              <p className="text-xs text-muted-foreground font-mono">
                {currentUser?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary-light text-primary font-mono text-xs font-bold border border-primary/20">
              <Shield className="w-3.5 h-3.5" />
              {roleLabel[currentUser?.role || ""] || currentUser?.role}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 font-mono text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3 h-3" />
              Activo
            </span>
          </div>
        </div>

        {/* 2-Column Horizontal Parallel Bento Grid (Zero Scroll) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
          {/* Column 1: Datos Personales */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 lg:p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
                <div className="w-8 h-8 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Información Personal
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Actualiza tu nombre visible en el sistema
                  </p>
                </div>
              </div>

              <form id="profile-form" onSubmit={handleProfileUpdate} className="space-y-3.5">
                <Input
                  label="Nombre Completo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Tu nombre completo"
                  icon={<UserIcon className="w-4 h-4" />}
                  required
                />

                <Input
                  label="Correo Electrónico"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                  icon={<Mail className="w-4 h-4" />}
                  type="email"
                  required
                />
              </form>
            </div>

            <div className="pt-3 border-t border-border/60">
              <Button
                type="submit"
                form="profile-form"
                loading={updateProfile.isPending}
                className="w-full"
              >
                Guardar Cambios
              </Button>
            </div>
          </div>

          {/* Column 2: Seguridad y Contraseña */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 lg:p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-border/60">
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-danger flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-800">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Seguridad y Contraseña
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Mínimo 10 caracteres recomendados
                  </p>
                </div>
              </div>

              <form id="password-form" onSubmit={handlePasswordChange} className="space-y-3">
                <Input
                  label="Contraseña Actual"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, currentPassword: e.target.value })
                  }
                  placeholder="••••••••••••"
                  icon={<Lock className="w-4 h-4" />}
                  required
                />

                <Input
                  label="Nueva Contraseña"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                  }
                  placeholder="••••••••••••"
                  icon={<Lock className="w-4 h-4" />}
                  required
                />

                <Input
                  label="Confirmar Nueva Contraseña"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                  }
                  placeholder="••••••••••••"
                  icon={<Lock className="w-4 h-4" />}
                  required
                />
              </form>
            </div>

            <div className="pt-3 border-t border-border/60">
              <Button
                type="submit"
                form="password-form"
                variant="secondary"
                loading={changePassword.isPending}
                className="w-full"
              >
                Actualizar Contraseña
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
