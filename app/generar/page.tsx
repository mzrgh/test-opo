import GenerateForm from "../GenerateForm";
import ConfigNotice, { appConfigured } from "../ConfigNotice";

export const dynamic = "force-dynamic";

export default function GenerarPage() {
  if (!appConfigured) return <ConfigNotice />;

  return (
    <>
      <h1>Generar un test nuevo</h1>
      <p className="muted">
        Sube un temario en PDF, elige la dificultad y se generará un test de
        hasta 40 preguntas.
      </p>
      <GenerateForm />
    </>
  );
}
