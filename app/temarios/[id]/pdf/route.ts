import { NextResponse } from "next/server";
import { supabase, TEMARIOS_BUCKET } from "@/lib/supabase";

// Genera una signed URL al vuelo y redirige a ella, para abrir el PDF del
// temario (bucket privado) en el visor del navegador.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const { data: subject, error } = await supabase
    .from("subjects")
    .select("pdf_path")
    .eq("id", id)
    .maybeSingle();

  const pdfPath = (subject as { pdf_path: string | null } | null)?.pdf_path;
  if (error || !pdfPath) {
    return new NextResponse("Temario o PDF no encontrado", { status: 404 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(TEMARIOS_BUCKET)
    .createSignedUrl(pdfPath, 60);
  if (signErr || !signed) {
    return new NextResponse(`No se pudo generar el enlace: ${signErr?.message}`, {
      status: 500,
    });
  }

  return NextResponse.redirect(signed.signedUrl);
}
