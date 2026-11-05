import { createApp } from "./app.js";
import { createPgContactRepository } from "./repositories/contactRepository.js";

const port = Number(process.env.PORT ?? 4000);
const app = createApp({ contactRepository: createPgContactRepository() });

app.listen(port, () => console.log(`contact-api écoute sur le port ${port}`));
