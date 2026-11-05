import { Router } from "express";
import { validate, validateQuery } from "../middlewares/validate.js";
import { contactSchema, listQuerySchema } from "../schemas/contact.js";

export function contactRouter({ contactRepository }) {
  const router = Router();

  // validate() s'exécute AVANT le handler : seules des données valides arrivent ici
  router.post("/", validate(contactSchema), async (req, res, next) => {
    try {
      const { name, email, message } = req.body; // données validées uniquement
      const saved = await contactRepository.create({ name, email, message });
      res.status(201).json({ id: saved.id, status: "received" });
    } catch (err) {
      next(err);
    }
  });

  // Défi 2 : liste paginée, 50 éléments maximum par page (API4).
  // En production, cette route devrait être réservée à un administrateur (API1 / API5).
  router.get("/", validateQuery(listQuerySchema), async (req, res, next) => {
    try {
      const { page, limit } = res.locals.query;
      const [items, total] = await Promise.all([
        contactRepository.list({ limit, offset: (page - 1) * limit }),
        contactRepository.count(),
      ]);
      res.json({ page, limit, total, items });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
