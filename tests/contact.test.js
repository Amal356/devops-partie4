import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createMemoryContactRepository } from "../src/repositories/contactRepository.js";

const valid = { name: "Ada Lovelace", email: "ada@example.com", message: "Bonjour, ceci est un test." };

/** Renvoie la liste des champs signalés dans une réponse VALIDATION_ERROR. */
const fieldsOf = (res) => res.body.details.map((d) => d.field);

describe("POST /api/contact", () => {
  let repo;
  let app;
  beforeEach(() => {
    repo = createMemoryContactRepository();
    app = createApp({ contactRepository: repo });
  });

  it("accepte un message valide (201)", async () => {
    const res = await request(app).post("/api/contact").send(valid);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "received" });
    expect(res.body.id).toBeDefined();
    expect(repo.items).toHaveLength(1);
  });

  // ---------- Validation (Zod) ----------

  it("refuse un email invalide (400 VALIDATION_ERROR)", async () => {
    const res = await request(app).post("/api/contact").send({ ...valid, email: "pas-un-email" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(fieldsOf(res)).toContain("email");
    expect(repo.items).toHaveLength(0);
  });

  it("refuse un champ manquant", async () => {
    const { message, ...sansMessage } = valid;
    const res = await request(app).post("/api/contact").send(sansMessage);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(fieldsOf(res)).toContain("message");
    expect(repo.items).toHaveLength(0);
  });

  it("refuse un champ supplémentaire (ex. isAdmin: true)", async () => {
    const res = await request(app).post("/api/contact").send({ ...valid, isAdmin: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(fieldsOf(res)).toContain("isAdmin");
    expect(repo.items).toHaveLength(0);
  });

  it("refuse un type inattendu (message: 42, name: ['a'])", async () => {
    const res = await request(app).post("/api/contact").send({ ...valid, message: 42, name: ["a"] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(fieldsOf(res)).toEqual(expect.arrayContaining(["name", "message"]));
    expect(repo.items).toHaveLength(0);
  });

  // ---------- Erreurs centralisées ----------

  it("refuse un JSON mal formé (400 INVALID_JSON)", async () => {
    const res = await request(app)
      .post("/api/contact")
      .set("Content-Type", "application/json")
      .send('{"name": "Ada",'); // JSON tronqué
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "INVALID_JSON" });
    expect(res.text).not.toContain("stack");
  });

  it("refuse un corps de plus de 10 ko (413)", async () => {
    const res = await request(app)
      .post("/api/contact")
      .send({ ...valid, message: "x".repeat(11 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "PAYLOAD_TOO_LARGE" });
    expect(repo.items).toHaveLength(0);
  });

  it("stocke tel quel un nom contenant une tentative d'injection SQL", async () => {
    const injection = "Robert'); DROP TABLE contacts;--";
    const res = await request(app).post("/api/contact").send({ ...valid, name: injection });
    expect(res.status).toBe(201);
    expect(repo.items).toHaveLength(1);
    // la chaîne est une simple donnée : elle est stockée sans être interprétée
    expect(repo.items[0].name).toBe(injection);
  });

  it("ne renvoie jamais de stack trace en cas d'erreur 500", async () => {
    const secret = "password authentication failed for user contact (SQL)";
    const failingRepo = {
      create: async () => {
        throw new Error(secret);
      },
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(createApp({ contactRepository: failingRepo }))
      .post("/api/contact")
      .send(valid);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "INTERNAL_ERROR" });
    expect(res.text).not.toContain("stack");
    expect(res.text).not.toContain(secret);
    expect(errorSpy).toHaveBeenCalled(); // l'erreur est bien journalisée côté serveur
    errorSpy.mockRestore();
  });

  // ---------- Durcissement HTTP ----------

  it("ajoute les headers de sécurité Helmet (x-content-type-options, ...)", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["strict-transport-security"]).toBeDefined();
  });

  it("ne renvoie pas le header x-powered-by", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("répond 429 après trop de requêtes sur /api/contact", async () => {
    for (let i = 0; i < 5; i++) {
      const ok = await request(app).post("/api/contact").send(valid);
      expect(ok.status).toBe(201);
    }
    const res = await request(app).post("/api/contact").send(valid);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: "TOO_MANY_REQUESTS" });
    expect(res.headers["ratelimit-policy"]).toBeDefined();
    expect(repo.items).toHaveLength(5);
  });

  it("ne limite pas /api/health (le rate limit ne s'applique qu'à /api/contact)", async () => {
    for (let i = 0; i < 8; i++) {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
    }
  });
});

describe("Routes inconnues", () => {
  it("répond 404 au format JSON", async () => {
    const app = createApp({ contactRepository: createMemoryContactRepository() });
    const res = await request(app).get("/api/nimporte-quoi");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "NOT_FOUND" });
  });
});
