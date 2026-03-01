import { kv } from "../lib/kv.ts";
import { getSession } from "../lib/session.ts";

export async function handleSignCLA(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const repoName = url.searchParams.get("repo");
  const returnUrl = url.searchParams.get("return");
  
  if (!repoName) {
    return new Response("Missing repository parameter", { status: 400 });
  }
  
  if (req.method === "POST") {
    return await signCLA(req, repoName, returnUrl);
  }
  
  // GET - show CLA signing form
  const session = await getSession(req);
  if (!session) {
    // Redirect to auth, then back to CLA signing
    const authUrl = `/auth/github?return=${encodeURIComponent(req.url)}`;
    return Response.redirect(authUrl);
  }
  
  // Check if user already signed this CLA
  const signatureKey = ["cla_signature", session.userId, repoName];
  const existing = await kv.get(signatureKey);
  
  if (existing.value) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>CLA Already Signed</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      </head>
      <body class="bg-gray-50 flex items-center justify-center min-h-screen">
        <div class="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div class="text-center">
            <div class="text-green-600 text-6xl mb-4">✓</div>
            <h1 class="text-2xl font-bold text-gray-900 mb-2">CLA Already Signed</h1>
            <p class="text-gray-600 mb-6">
              You have already signed the CLA for <strong>${repoName}</strong> on 
              ${new Date((existing.value as any).signedAt).toLocaleDateString()}.
            </p>
            ${returnUrl ? `<a href="${returnUrl}" class="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 inline-block">Return to PR</a>` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
    
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }
  
  // Get CLA text from repository configuration
  const repoConfig = await getRepoConfig(repoName);
  if (!repoConfig) {
    return new Response("Repository not found or CLA not configured", { status: 404 });
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sign CLA - ${repoName}</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
      <div class="max-w-4xl mx-auto px-4 py-8">
        <div class="bg-white rounded-lg shadow-lg p-8">
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">${repoConfig.claTitle}</h1>
            <p class="text-gray-600">Repository: <strong>${repoName}</strong></p>
            <p class="text-gray-600">User: <strong>@${session.username}</strong></p>
          </div>
          
          <div class="prose max-w-none mb-8">
            <div class="bg-gray-50 border rounded p-6 overflow-auto" style="max-height: 400px;">
              <pre class="whitespace-pre-wrap text-sm">${repoConfig.claText}</pre>
            </div>
          </div>
          
          <form id="claForm" class="text-center">
            <div class="mb-6">
              <label class="flex items-center justify-center space-x-3">
                <input type="checkbox" id="agreeCheckbox" required 
                       class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                <span class="text-gray-700">I have read and agree to the terms of this Contributor License Agreement</span>
              </label>
            </div>
            
            <div class="space-x-4">
              ${returnUrl ? `<a href="${returnUrl}" class="px-6 py-2 border rounded hover:bg-gray-50 inline-block">Cancel</a>` : ''}
              <button type="submit" id="signButton" disabled 
                      class="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed">
                Sign CLA
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <script>
        const checkbox = document.getElementById('agreeCheckbox');
        const signButton = document.getElementById('signButton');
        
        checkbox.addEventListener('change', () => {
          signButton.disabled = !checkbox.checked;
        });
        
        document.getElementById('claForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          if (!checkbox.checked) {
            alert('You must agree to the CLA terms to sign');
            return;
          }
          
          signButton.disabled = true;
          signButton.textContent = 'Signing...';
          
          try {
            const response = await fetch('/sign?repo=${encodeURIComponent(repoName)}', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ agreed: true })
            });
            
            if (response.ok) {
              // Show success and redirect
              const result = await response.json();
              alert('CLA signed successfully!');
              
              if ('${returnUrl}') {
                window.location.href = '${returnUrl}';
              } else {
                window.location.href = '/dashboard';
              }
            } else {
              const error = await response.text();
              alert('Failed to sign CLA: ' + error);
              signButton.disabled = false;
              signButton.textContent = 'Sign CLA';
            }
          } catch (error) {
            alert('Error signing CLA: ' + error.message);
            signButton.disabled = false;
            signButton.textContent = 'Sign CLA';
          }
        });
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}

async function signCLA(req: Request, repoName: string, returnUrl: string | null): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return new Response("Not authenticated", { status: 401 });
  }
  
  const { agreed } = await req.json();
  if (!agreed) {
    return new Response("Must agree to CLA terms", { status: 400 });
  }
  
  // Store signature
  const signatureKey = ["cla_signature", session.userId, repoName];
  await kv.set(signatureKey, {
    userId: session.userId,
    username: session.username,
    repoName,
    signedAt: Date.now(),
    ipAddress: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown",
    userAgent: req.headers.get("user-agent") || "unknown",
  });
  
  // Update repository stats
  await updateRepoStats(repoName, "signed");
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function getRepoConfig(repoName: string) {
  // Find which user owns this repository configuration
  for await (const entry of kv.list({ prefix: ["user_repo"] })) {
    const repo = entry.value as any;
    if (repo.name === repoName && repo.enabled) {
      return repo;
    }
  }
  return null;
}

async function updateRepoStats(repoName: string, action: "signed" | "pending") {
  // Find and update repository stats
  for await (const entry of kv.list({ prefix: ["user_repo"] })) {
    const repo = entry.value as any;
    if (repo.name === repoName) {
      const updated = {
        ...repo,
        signedCount: action === "signed" ? (repo.signedCount || 0) + 1 : repo.signedCount,
        pendingCount: action === "pending" ? (repo.pendingCount || 0) + 1 : repo.pendingCount,
      };
      
      await kv.set(entry.key, updated);
      break;
    }
  }
}