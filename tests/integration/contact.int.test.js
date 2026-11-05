import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/app.js";
import { createPgContactRepository } from "../../src/repositories/contactRepository.js";

// Prérequis : docker compose up -d --wait && npm run migrate (variables PG* exportées).
describe("Intégration API ↔ PostgreSQL", () => {
  let pool;
  let app;
  const createdIds = []; // lignes créées par ces tests, supprimées à la fin

  beforeAll(() => {
    pool = new pg.Pool();
    app = createApp({ contactRepository: createPgContactRepository(pool) });
  });

  afterAll(async () => {
    // nettoyage : on ne laisse pas de données de test dans la base
    if (createdIds.length) {
      await pool.query("DELETE FROM contacts WHERE id = ANY($1::int[])", [createdIds]);
    }
    await pool.end();
  });

  it("enregistre un contact dans PostgreSQL", async () => {
    const contact = {
      name: "Ada Lovelace",
      email: `ada-${Date.now()}@example.com`,
      message: "Message enregistré par le test d'intégration.",
    };

    const res = await request(app).post("/api/contact").send(contact);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("received");
    createdIds.push(res.body.id);

    // vérification directe en base, sans passer par l'API
    const { rows } = await pool.query(
      "SELECT name, email, message, created_at FROM contacts WHERE id = $1",
      [res.body.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: contact.name, email: contact.email, message: contact.message });
    expect(rows[0].created_at).toBeInstanceOf(Date);
  });

  it("résiste à une tentative d'injection SQL", async () => {
    const injection = "Robert'); DROP TABLE contacts;--";

    const res = await request(app)
      .post("/api/contact")
      .send({ name: injection, email: "bobby@example.com", message: "Tentative d'injection SQL." });
    expect(res.status).toBe(201);
    createdIds.push(res.body.id);

    // 1. la table contacts existe toujours
    const { rows: table } = await pool.query("SELECT to_regclass('public.contacts') AS t");
    expect(table[0].t).toBe("contacts");

    // 2. la valeur est stockée telle quelle (simple donnée, jamais interprétée comme du SQL)
    const { rows } = await pool.query("SELECT name FROM contacts WHERE id = $1", [res.body.id]);
    expect(rows[0].name).toBe(injection);
  });

  it("n'écrit rien en base quand la requête est invalide", async () => {
    const repo = createPgContactRepository(pool);
    const before = await repo.count();

    const res = await request(app)
      .post("/api/contact")
      .send({ name: "x", email: "pas-un-email", message: "court", isAdmin: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");

    expect(await repo.count()).toBe(before);
  });
});
