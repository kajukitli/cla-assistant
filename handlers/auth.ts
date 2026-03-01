import { kv } from "../lib/kv.ts";
import { generateState } from "../lib/crypto.ts";

const GITHUB_CLIENT_ID = Deno.env.get("GITHUB_CLIENT_ID")!;
const GITHUB_CLIENT_SECRET = Deno.env.get("GITHUB_CLIENT_SECRET")!;
const BASE_URL = Deno.env.get("BASE_URL") || "http://localhost:8000";

export async function handleAuth(_req: Request): Promise<Response> {
  const state = generateState();
  
  // Store state temporarily
  await kv.set(["auth_state", state], { created: Date.now() }, { expireIn: 600_000 });
  
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", `${BASE_URL}/auth/callback`);
  authUrl.searchParams.set("scope", "read:user user:email repo");
  authUrl.searchParams.set("state", state);
  
  return Response.redirect(authUrl.toString());
}

export async function handleAuthCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  
  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }
  
  // Verify state
  const stateEntry = await kv.get(["auth_state", state]);
  if (!stateEntry.value) {
    return new Response("Invalid state", { status: 400 });
  }
  
  // Delete used state
  await kv.delete(["auth_state", state]);
  
  try {
    // Exchange code for token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    if (!accessToken) {
      return new Response("Failed to get access token", { status: 400 });
    }
    
    // Get user info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/vnd.github+json",
      },
    });
    
    const userData = await userResponse.json();
    
    // Store user session
    const sessionId = crypto.randomUUID();
    await kv.set(["session", sessionId], {
      userId: userData.id,
      username: userData.login,
      accessToken,
      created: Date.now(),
    }, { expireIn: 86400_000 }); // 24 hours
    
    // Store user data
    await kv.set(["user", userData.id], {
      username: userData.login,
      name: userData.name,
      email: userData.email,
      avatarUrl: userData.avatar_url,
      lastLogin: Date.now(),
    });
    
    // Set session cookie and redirect
    const response = Response.redirect(`${BASE_URL}/dashboard`);
    response.headers.set(
      "Set-Cookie",
      `session=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`
    );
    
    return response;
    
  } catch (error) {
    console.error("Auth error:", error);
    return new Response("Authentication failed", { status: 500 });
  }
}