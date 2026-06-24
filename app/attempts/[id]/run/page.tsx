import { notFound, redirect } from "next/navigation";
import { getRunData } from "@/lib/db";
import RunClient from "./RunClient";

export const dynamic = "force-dynamic";

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getRunData(id);
  if (!data) notFound();

  // Si ya estaba finalizado, no se reanuda: directo a resultados.
  if (data.attempt.finished_at) redirect(`/attempts/${id}/result`);

  return (
    <RunClient
      attemptId={id}
      subjectNombre={data.subject?.nombre ?? "Test"}
      questions={data.questions}
      initialAnswers={data.answers}
    />
  );
}
