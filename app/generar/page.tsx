import { redirect } from "next/navigation";
import GenerateForm from "../GenerateForm";
import ConfigNotice, { appConfigured } from "../ConfigNotice";
import { esGestor } from "@/lib/perfil";

export const dynamic = "force-dynamic";

export default function GenerarPage() {
  // Perfil Estudiante: la subida de temarios está deshabilitada en esta instancia.
  if (!esGestor()) redirect("/");
  if (!appConfigured) return <ConfigNotice />;

  return (
    <>
      <h1>Subir Temario a la plataforma</h1>
      <p className="muted">
        Sube un temario en PDF, elige la dificultad y se generará un test de
        hasta 40 preguntas.
      </p>
      <GenerateForm />
    </>
  );
}
