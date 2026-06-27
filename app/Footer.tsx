export default function Footer() {
  // Inyectadas en build desde el CHANGELOG (ver next.config.mjs).
  const version = process.env.APP_VERSION;
  const fecha = process.env.APP_VERSION_DATE;
  const etiquetaVersion = version
    ? ` - Versión [${version}]${fecha ? ` - ${fecha}` : ""}`
    : "";

  return (
    <footer className="footer">
      <span className="muted">© Raúl González{etiquetaVersion}</span>
      <a href="#top" className="to-top">
        ↑ Volver arriba
      </a>
    </footer>
  );
}
