/** Transforme les erreurs Zod en liste { field, message }. */
function toDetails(error) {
  return error.issues.map((issue) => ({
    // champ en trop (.strict()) : le nom est dans issue.keys et non dans issue.path
    field: issue.path.length ? issue.path.join(".") : (issue.keys?.join(", ") ?? "body"),
    message: issue.message,
  }));
}

/**
 * Middleware générique de validation du corps (Zod).
 * Échec : 400 { error: "VALIDATION_ERROR", details: [{ field, message }] }
 * Succès : req.body est remplacé par les données validées et nettoyées.
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: toDetails(result.error) });
  }
  req.body = result.data;
  next();
};

/**
 * Validation des paramètres d'URL (?page=&limit=).
 * Avec Express 5, req.query est en lecture seule : les valeurs validées
 * sont placées dans res.locals.query.
 */
export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ error: "VALIDATION_ERROR", details: toDetails(result.error) });
  }
  res.locals.query = result.data;
  next();
};
