import pg from "pg";

/** Repository PostgreSQL : connexion configurée par PGHOST, PGUSER, PGPASSWORD, PGDATABASE. */
export function createPgContactRepository(pool = new pg.Pool()) {
  return {
    async create({ name, email, message }) {
      // Requête PARAMÉTRÉE : les valeurs ne sont jamais concaténées dans le SQL.
      const { rows } = await pool.query(
        "INSERT INTO contacts (name, email, message) VALUES ($1, $2, $3) RETURNING id",
        [name, email, message]
      );
      return rows[0];
    },
    async count() {
      const { rows } = await pool.query("SELECT count(*)::int AS n FROM contacts");
      return rows[0].n;
    },
    // Défi 2 : liste paginée. L'email n'est volontairement pas renvoyé (API3 : exposition excessive).
    async list({ limit, offset }) {
      const { rows } = await pool.query(
        "SELECT id, name, message, created_at FROM contacts ORDER BY id DESC LIMIT $1 OFFSET $2",
        [limit, offset]
      );
      return rows;
    },
  };
}

/** Repository en mémoire, utilisé par les tests de routes. */
export function createMemoryContactRepository() {
  const items = [];
  return {
    items,
    async create(contact) {
      const saved = { id: items.length + 1, ...contact };
      items.push(saved);
      return saved;
    },
    async count() {
      return items.length;
    },
    async list({ limit, offset }) {
      return [...items]
        .reverse()
        .slice(offset, offset + limit)
        // eslint-disable-next-line no-unused-vars
        .map(({ email, ...publicFields }) => publicFields);
    },
  };
}
