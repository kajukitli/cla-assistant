import { serveFile } from "https://deno.land/std@0.208.0/http/file_server.ts";
import { handleAuth, handleAuthCallback } from "../handlers/auth.ts";
import { handleDashboard } from "../handlers/dashboard.ts";
import { handleRepoSetup } from "../handlers/repo.ts";
import { handleSignCLA } from "../handlers/cla.ts";

export async function router(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  
  try {
    switch (true) {
      case path === "/":
        return await serveFile(req, "./static/index.html");
        
      case path === "/auth/github":
        return await handleAuth(req);
        
      case path === "/auth/callback":
        return await handleAuthCallback(req);
        
      case path === "/dashboard":
        return await handleDashboard(req);
        
      case path.startsWith("/repo/"):
        return await handleRepoSetup(req);
        
      case path === "/sign":
        return await handleSignCLA(req);
        
      case path.startsWith("/static/"):
        return await serveFile(req, `.${path}`);
        
      default:
        return new Response("Not Found", { status: 404 });
    }
  } catch (error) {
    console.error("Route error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}