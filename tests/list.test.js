import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createMemoryContactRepository } from "../src/repositories/contactRepository.js";

// Défi 2 : GET /api/contact?page=&limit= (liste paginée)
describe("GET /api/contact (pagination)", () => {
  let repo;
  let app;
  beforeEach(async () => {
    repo = createMemoryContactRepository();
    for (let i = 1; i <= 12; i++) {
      await repo.create({ name: `Contact ${i}`, email: `c${i}@example.com`, message: `Message numéro ${i}` });
    }
    app = createApp({ contactRepository: repo });
  });

  it("renvoie la 1re page avec 10 éléments par défaut, du plus récent au plus ancien", async () => {
    const res = await request(app).get("/api/contact");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 10, total: 12 });
    expect(res.body.items).toHaveLength(10);
    expect(res.body.items[0].name).toBe("Contact 12");
  });

  it("convertit page et limit (z.coerce) et calcule le décalage", async () => {
    const res = await request(app).get("/api/contact?page=2&limit=5");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 2, limit: 5, total: 12 });
    expect(res.body.items.map((c) => c.name)).toEqual([
      "Contact 7", "Contact 6", "Contact 5", "Contact 4", "Contact 3",
    ]);
  });

  it("n'expose pas l'adresse email des contacts (API3)", async () => {
    const res = await request(app).get("/api/contact");
    for (const item of res.body.items) {
      expect(item).not.toHaveProperty("email");
    }
  });

  it("refuse plus de 50 éléments par page (API4)", async () => {
    const res = await request(app).get("/api/contact?limit=51");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(res.body.details.map((d) => d.field)).toContain("limit");
  });

  it.each([["page=abc"], ["page=0"], ["page=1.5"], ["limit=-3"]])(
    "refuse un paramètre invalide (%s)",
    async (qs) => {
      const res = await request(app).get(`/api/contact?${qs}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("VALIDATION_ERROR");
    }
  );

  it("refuse un paramètre inconnu (.strict())", async () => {
    const res = await request(app).get("/api/contact?admin=true");
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toContain("admin");
  });
});
