import { z } from "zod";

// Schéma strict du formulaire de contact.
export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    message: z.string().trim().min(10).max(2000),
  })
  .strict(); // tout champ inconnu (ex. isAdmin) est refusé : protection API3

// Défi 2 : paramètres de pagination de GET /api/contact?page=&limit=
// Les paramètres d'URL sont des chaînes : z.coerce.number() les convertit en nombres.
export const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10), // API4 : 50 éléments maximum
  })
  .strict();
