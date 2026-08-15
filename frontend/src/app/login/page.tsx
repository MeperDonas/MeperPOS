"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthCard } from "@/components/auth/AuthCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ChevronRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, loading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch {
      setError("Credenciales incorrectas. Verifica tu correo y contrasena.");
    }
  };

  return (
    <AuthCard
      title="Bienvenido de nuevo"
      subtitle="MeperPOS"
      footer={{
        text: "No tienes cuenta?",
        linkText: "Registrarse",
        href: "/register",
      }}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200/60 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
            {error}
          </div>
        )}

        <Input
          type="email"
          label="Correo Electronico"
          placeholder="usuario@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <Input
          type="password"
          label="Contrasena"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <Button
          type="submit"
          disabled={loading}
          loading={loading}
          className="w-full mt-2"
        >
          <span>Iniciar Sesion</span>
          {!loading && <ChevronRight className="w-4 h-4" />}
        </Button>
      </form>
    </AuthCard>
  );
}
