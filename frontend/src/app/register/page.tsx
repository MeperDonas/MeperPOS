"use client";

import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/Button";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <AuthCard
      title="Registro de Usuarios"
      subtitle="MeperPOS"
      footer={{
        text: "Ya tienes cuenta?",
        linkText: "Iniciar Sesion",
        href: "/login",
      }}
    >
      <div className="text-center space-y-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-2">
          <Lock className="w-7 h-7 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Acceso restringido
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            El registro de nuevos usuarios esta deshabilitado en esta
            plataforma. Solo un <strong>Administrador</strong> puede crear
            cuentas desde el panel de gestion.
          </p>
        </div>

        <div className="bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-4 text-sm text-amber-900 dark:text-amber-200">
          Si necesitas acceso, contacta al administrador del sistema para que
          te cree una cuenta.
        </div>

        <Button
          type="button"
          className="w-full"
          onClick={() => router.push("/login")}
        >
          Ir al Inicio de Sesion
        </Button>
      </div>
    </AuthCard>
  );
}
