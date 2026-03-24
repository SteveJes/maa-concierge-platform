import { createServer } from "./server.js";

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

const app = createServer();
app.listen({ port, host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
