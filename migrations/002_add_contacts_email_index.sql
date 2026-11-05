-- Index sur email : accélère la recherche des messages d'un même expéditeur
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts (email);
