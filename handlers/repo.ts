import { kv } from "../lib/kv.ts";
import { getSession } from "../lib/session.ts";

export async function handleRepoSetup(req: Request): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return Response.redirect("/");
  }
  
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  
  if (req.method === "POST" && pathParts[2] === "add") {
    return await addRepository(req, session);
  }
  
  if (req.method === "POST" && pathParts[2] === "remove") {
    return await removeRepository(req, session);
  }
  
  if (req.method === "POST" && pathParts[2] === "configure") {
    return await configureRepository(req, session);
  }
  
  // GET /repo/{repoName} - show configuration page
  const repoName = pathParts.slice(2).join("/");
  const repoKey = ["user_repo", session.userId, repoName];
  const repoData = await kv.get(repoKey);
  
  if (!repoData.value) {
    return new Response("Repository not found", { status: 404 });
  }
  
  const repo = repoData.value as any;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Configure ${repoName} - CLA Assistant</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
      <nav class="bg-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4">
          <div class="flex justify-between items-center py-6">
            <div class="flex items-center space-x-4">
              <a href="/dashboard" class="text-blue-600 hover:text-blue-800">← Dashboard</a>
              <h1 class="text-xl font-bold">Configure ${repoName}</h1>
            </div>
          </div>
        </div>
      </nav>
      
      <div class="max-w-4xl mx-auto px-4 py-8">
        <form id="configForm" class="bg-white rounded-lg shadow p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <!-- Basic Settings -->
            <div class="space-y-4">
              <h3 class="text-lg font-semibold">Basic Settings</h3>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">CLA Title</label>
                <input type="text" name="claTitle" value="${repo.claTitle || ''}" 
                       placeholder="Contributor License Agreement"
                       class="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Webhook Secret</label>
                <input type="text" name="webhookSecret" value="${repo.webhookSecret || ''}" 
                       placeholder="Optional webhook secret"
                       class="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500">
                <p class="text-sm text-gray-500 mt-1">
                  Webhook URL: <code class="bg-gray-100 px-2 py-1 rounded">${Deno.env.get("BASE_URL") || "http://localhost:8000"}/webhook</code>
                </p>
              </div>
              
              <div class="flex items-center">
                <input type="checkbox" name="enabled" ${repo.enabled ? 'checked' : ''} 
                       class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                <label class="ml-2 text-sm text-gray-700">Enable CLA checking</label>
              </div>
            </div>
            
            <!-- CLA Content -->
            <div class="space-y-4">
              <h3 class="text-lg font-semibold">CLA Content</h3>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">License Text</label>
                <textarea name="claText" rows="12" 
                          placeholder="Enter your CLA text here..."
                          class="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500">${repo.claText || DEFAULT_CLA_TEXT}</textarea>
              </div>
            </div>
            
          </div>
          
          <!-- Action Buttons -->
          <div class="flex justify-end space-x-3 mt-6 pt-6 border-t">
            <a href="/dashboard" class="px-4 py-2 border rounded hover:bg-gray-50">
              Cancel
            </a>
            <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              Save Configuration
            </button>
          </div>
        </form>
        
        <!-- Statistics -->
        <div class="bg-white rounded-lg shadow p-6 mt-6">
          <h3 class="text-lg font-semibold mb-4">Statistics</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="text-center">
              <div class="text-2xl font-bold text-green-600">${repo.signedCount || 0}</div>
              <div class="text-sm text-gray-500">Contributors Signed</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-yellow-600">${repo.pendingCount || 0}</div>
              <div class="text-sm text-gray-500">Pending Signatures</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-blue-600">${repo.totalPRs || 0}</div>
              <div class="text-sm text-gray-500">Total PRs Checked</div>
            </div>
          </div>
        </div>
      </div>
      
      <script>
        document.getElementById('configForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          
          const config = {
            claTitle: formData.get('claTitle'),
            claText: formData.get('claText'),
            webhookSecret: formData.get('webhookSecret'),
            enabled: formData.has('enabled')
          };
          
          try {
            const response = await fetch('/repo/configure', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ repoName: '${repoName}', config })
            });
            
            if (response.ok) {
              alert('Configuration saved successfully!');
            } else {
              alert('Failed to save configuration');
            }
          } catch (error) {
            alert('Error saving configuration');
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

async function addRepository(req: Request, session: any): Promise<Response> {
  const { repoName } = await req.json();
  
  if (!repoName || !repoName.includes('/')) {
    return new Response("Invalid repository name", { status: 400 });
  }
  
  const repoKey = ["user_repo", session.userId, repoName];
  
  await kv.set(repoKey, {
    name: repoName,
    owner: session.username,
    enabled: false,
    claTitle: "Contributor License Agreement",
    claText: DEFAULT_CLA_TEXT,
    webhookSecret: "",
    signedCount: 0,
    pendingCount: 0,
    totalPRs: 0,
    createdAt: Date.now(),
  });
  
  return new Response("OK");
}

async function removeRepository(req: Request, session: any): Promise<Response> {
  const { repoName } = await req.json();
  const repoKey = ["user_repo", session.userId, repoName];
  
  await kv.delete(repoKey);
  
  return new Response("OK");
}

async function configureRepository(req: Request, session: any): Promise<Response> {
  const { repoName, config } = await req.json();
  const repoKey = ["user_repo", session.userId, repoName];
  
  const existing = await kv.get(repoKey);
  if (!existing.value) {
    return new Response("Repository not found", { status: 404 });
  }
  
  const updated = {
    ...existing.value,
    ...config,
    updatedAt: Date.now(),
  };
  
  await kv.set(repoKey, updated);
  
  return new Response("OK");
}

const DEFAULT_CLA_TEXT = `# Contributor License Agreement

By submitting a contribution to this project, you agree that:

1. You have the right to submit the contribution under the project's license
2. You grant the project maintainers a perpetual, worldwide, non-exclusive, no-charge license to use your contribution
3. Your contribution is made under the same license terms as the project

Please sign this CLA by commenting "I have read the CLA and I agree" on this pull request.

Thank you for your contribution!`;