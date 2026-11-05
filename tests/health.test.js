import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createMemoryContactRepository } from "../src/repositories/contactRepository.js";

// Exemple complet : servez-vous-en comme modèle pour contact.test.js.
describe("GET /api/health", () => {
  const app = createApp({ contactRepository: createMemoryContactRepository() });

  it("répond 200 avec status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
