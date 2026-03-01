import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { router } from "./routes/mod.ts";
import { handleWebhook } from "./handlers/webhook.ts";

const port = Number(Deno.env.get("PORT")) || 8000;

console.log(`🚀 CLA Assistant running on port ${port}`);

await serve(async (req) => {
  const url = new URL(req.url);
  
  if (url.pathname === "/webhook" && req.method === "POST") {
    return await handleWebhook(req);
  }
  
  return await router(req);
}, { port });