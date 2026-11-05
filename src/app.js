import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { healthRouter } from "./routes/health.js";
import { contactRouter } from "./routes/contact.js";
import { errorHandler } from "./middlewares/errorHandler.js";

/**
 * Fabrique de l'application. Le repository est injecté : les tests de routes
 * passent un repository en mémoire, server.js passe le repository PostgreSQL.
 */
export function createApp({ contactRepository }) {
  const app = express();

  // API8 : ne pas révéler la technologie, ajouter les en-têtes de sécurité
  app.disable("x-powered-by");
  app.use(helmet());
  // Derrière un reverse proxy (Nginx, Ingress), activer : app.set("trust proxy", 1);

  // API4 : taille maximale du corps JSON (au-delà : 413 PAYLOAD_TOO_LARGE)
  app.use(express.json({ limit: "10kb" }));

  app.use("/api/health", healthRouter);

  // API4 / API6 : 5 requêtes par minute et par IP, uniquement sur /api/contact
  const contactLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7", // en-têtes RateLimit-* standard
    legacyHeaders: false,       // pas d'anciens en-têtes X-RateLimit-*
    message: { error: "TOO_MANY_REQUESTS" },
  });
  app.use("/api/contact", contactLimiter, contactRouter({ contactRepository }));

  // Route 404 au format JSON pour toutes les autres URL
  app.use((req, res) => res.status(404).json({ error: "NOT_FOUND" }));

  // Le middleware d'erreur doit être déclaré EN DERNIER.
  app.use(errorHandler);
  return app;
}
