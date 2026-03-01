import { kv } from "./kv.ts";

export async function getSession(req: Request) {
  const cookies = req.headers.get("cookie");
  if (!cookies) return null;
  
  const sessionMatch = cookies.match(/session=([^;]+)/);
  if (!sessionMatch) return null;
  
  const sessionId = sessionMatch[1];
  const session = await kv.get(["session", sessionId]);
  
  return session.value as any;
}