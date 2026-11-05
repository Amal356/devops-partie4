/**
 * Middleware d'erreur centralisé (4 arguments : c'est ainsi qu'Express le reconnaît).
 * Le client ne reçoit qu'un code d'erreur générique, jamais la stack trace
 * ni le message SQL : le détail est journalisé côté serveur uniquement.
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "INVALID_JSON" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "PAYLOAD_TOO_LARGE" });
  }

  console.error("[erreur]", req.method, req.originalUrl, err);
  return res.status(500).json({ error: "INTERNAL_ERROR" });
}
