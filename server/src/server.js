import { app } from "./app.js";
import { config } from "./config/env.js";
import { client, testConnection } from "./db/index.js";

async function main() {
  const connected = await testConnection();
  if (!connected) {
    console.error("MongoDB connection failed. Please check your .env file or MongoDB Atlas settings.");
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`Neev server listening on http://localhost:${config.port}`);
  });
}

process.on("SIGINT", async () => {
  await client.close();
  process.exit(0);
});

main();
