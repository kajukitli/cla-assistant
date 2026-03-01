import { kv } from "../lib/kv.ts";
import { getSession } from "../lib/session.ts";

export async function handleDashboard(req: Request): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return Response.redirect("/");
  }
  
  // Get user's repos
  const userRepos = [];
  for await (const entry of kv.list({ prefix: ["user_repo", session.userId] })) {
    userRepos.push(entry.value);
  }
  
  // Get user's signed CLAs
  const signedCLAs = [];
  for await (const entry of kv.list({ prefix: ["cla_signature", session.userId] })) {
    signedCLAs.push(entry.value);
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>CLA Assistant - Dashboard</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
      <nav class="bg-white shadow-lg">
        <div class="max-w-7xl mx-auto px-4">
          <div class="flex justify-between items-center py-6">
            <h1 class="text-xl font-bold">CLA Assistant</h1>
            <div class="flex items-center space-x-4">
              <span class="text-gray-600">@${session.username}</span>
              <a href="/auth/logout" class="text-red-600 hover:text-red-800">Logout</a>
            </div>
          </div>
        </div>
      </nav>
      
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <!-- Managed Repositories -->
          <div class="bg-white rounded-lg shadow p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold">Managed Repositories</h2>
              <button onclick="showAddRepo()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                Add Repository
              </button>
            </div>
            
            <div class="space-y-3">
              ${userRepos.length === 0 
                ? '<p class="text-gray-500 italic">No repositories configured</p>'
                : userRepos.map(repo => `
                    <div class="flex items-center justify-between border rounded p-3">
                      <div>
                        <div class="font-medium">${repo.name}</div>
                        <div class="text-sm text-gray-500">${repo.claTitle || 'Default CLA'}</div>
                      </div>
                      <div class="flex space-x-2">
                        <a href="/repo/${repo.name}" class="text-blue-600 hover:text-blue-800 text-sm">Configure</a>
                        <button onclick="removeRepo('${repo.name}')" class="text-red-600 hover:text-red-800 text-sm">Remove</button>
                      </div>
                    </div>
                  `).join('')
              }
            </div>
          </div>
          
          <!-- Signed CLAs -->
          <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-lg font-semibold mb-4">Signed CLAs</h2>
            
            <div class="space-y-3">
              ${signedCLAs.length === 0 
                ? '<p class="text-gray-500 italic">No CLAs signed yet</p>'
                : signedCLAs.map(cla => `
                    <div class="border rounded p-3">
                      <div class="font-medium">${cla.repoName}</div>
                      <div class="text-sm text-gray-500">Signed on ${new Date(cla.signedAt).toLocaleDateString()}</div>
                    </div>
                  `).join('')
              }
            </div>
          </div>
          
        </div>
      </div>
      
      <!-- Add Repository Modal -->
      <div id="addRepoModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div class="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 class="text-lg font-semibold mb-4">Add Repository</h3>
          <form id="addRepoForm">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Repository Name</label>
              <input type="text" name="repoName" placeholder="owner/repository" 
                     class="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="flex justify-end space-x-3">
              <button type="button" onclick="hideAddRepo()" class="px-4 py-2 border rounded hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                Add Repository
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <script>
        function showAddRepo() {
          document.getElementById('addRepoModal').classList.remove('hidden');
        }
        
        function hideAddRepo() {
          document.getElementById('addRepoModal').classList.add('hidden');
        }
        
        document.getElementById('addRepoForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const repoName = formData.get('repoName');
          
          try {
            const response = await fetch('/repo/add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ repoName })
            });
            
            if (response.ok) {
              location.reload();
            } else {
              alert('Failed to add repository');
            }
          } catch (error) {
            alert('Error adding repository');
          }
        });
        
        async function removeRepo(repoName) {
          if (!confirm('Remove this repository?')) return;
          
          try {
            const response = await fetch('/repo/remove', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ repoName })
            });
            
            if (response.ok) {
              location.reload();
            } else {
              alert('Failed to remove repository');
            }
          } catch (error) {
            alert('Error removing repository');
          }
        }
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}