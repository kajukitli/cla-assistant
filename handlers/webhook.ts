import { kv } from "../lib/kv.ts";
import { verifyWebhookSignature } from "../lib/crypto.ts";

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN"); // Bot token for commenting

export async function handleWebhook(req: Request): Promise<Response> {
  try {
    const payload = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const event = req.headers.get("x-github-event");
    
    if (!event) {
      return new Response("Missing event header", { status: 400 });
    }
    
    const data = JSON.parse(payload);
    
    // Handle pull request events
    if (event === "pull_request") {
      return await handlePullRequest(data, signature, payload);
    }
    
    // Handle issue comment events (for CLA signing via comment)
    if (event === "issue_comment") {
      return await handleIssueComment(data, signature, payload);
    }
    
    return new Response("Event not handled", { status: 200 });
    
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
}

async function handlePullRequest(data: any, signature: string | null, payload: string): Promise<Response> {
  const { action, pull_request, repository } = data;
  
  // Only handle opened and synchronize events
  if (!["opened", "synchronize"].includes(action)) {
    return new Response("OK");
  }
  
  const repoName = repository.full_name;
  const prNumber = pull_request.number;
  const author = pull_request.user.login;
  
  // Find repository configuration
  const repoConfig = await getRepoConfig(repoName);
  if (!repoConfig || !repoConfig.enabled) {
    return new Response("Repository not configured or disabled");
  }
  
  // Verify webhook signature if secret is configured
  if (repoConfig.webhookSecret && signature) {
    const isValid = await verifyWebhookSignature(payload, signature, repoConfig.webhookSecret);
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }
  }
  
  // Check if author has signed CLA
  const hasSigned = await checkCLASignature(author, repoName);
  
  if (!hasSigned) {
    // Post comment asking for CLA signature
    await postCLAComment(repoName, prNumber, author, repoConfig);
    
    // Update stats
    await updateRepoStats(repoName, "pending");
  }
  
  return new Response("OK");
}

async function handleIssueComment(data: any, signature: string | null, payload: string): Promise<Response> {
  const { action, comment, issue, repository } = data;
  
  // Only handle created comments on pull requests
  if (action !== "created" || !issue.pull_request) {
    return new Response("OK");
  }
  
  const repoName = repository.full_name;
  const repoConfig = await getRepoConfig(repoName);
  
  if (!repoConfig || !repoConfig.enabled) {
    return new Response("OK");
  }
  
  // Verify webhook signature if secret is configured
  if (repoConfig.webhookSecret && signature) {
    const isValid = await verifyWebhookSignature(payload, signature || "", repoConfig.webhookSecret);
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }
  }
  
  const commentBody = comment.body.toLowerCase().trim();
  const author = comment.user.login;
  
  // Check for CLA agreement phrases
  const claAgreementPhrases = [
    "i have read the cla and i agree",
    "i agree to the cla",
    "i accept the cla",
    "cla signed"
  ];
  
  const agreedToCLA = claAgreementPhrases.some(phrase => 
    commentBody.includes(phrase)
  );
  
  if (agreedToCLA) {
    // Record CLA signature
    const signatureKey = ["cla_signature", comment.user.id, repoName];
    await kv.set(signatureKey, {
      userId: comment.user.id,
      username: author,
      repoName,
      signedAt: Date.now(),
      method: "comment",
      commentUrl: comment.html_url,
      ipAddress: "github-webhook",
      userAgent: "GitHub Webhook",
    });
    
    // Post confirmation comment
    await postCLAConfirmation(repoName, issue.number, author);
    
    // Update stats
    await updateRepoStats(repoName, "signed");
  }
  
  return new Response("OK");
}

async function checkCLASignature(username: string, repoName: string): Promise<boolean> {
  // We need to find the user ID from username first
  for await (const entry of kv.list({ prefix: ["cla_signature"] })) {
    const signature = entry.value as any;
    if (signature.username === username && signature.repoName === repoName) {
      return true;
    }
  }
  return false;
}

async function postCLAComment(repoName: string, prNumber: number, author: string, repoConfig: any): Promise<void> {
  if (!GITHUB_TOKEN) {
    console.log("No GitHub token configured, skipping comment");
    return;
  }
  
  const baseUrl = Deno.env.get("BASE_URL") || "http://localhost:8000";
  const claUrl = `${baseUrl}/sign?repo=${encodeURIComponent(repoName)}&return=${encodeURIComponent(`https://github.com/${repoName}/pull/${prNumber}`)}`;
  
  const commentBody = `## ${repoConfig.claTitle}

Hello @${author}! Thank you for your contribution.

Before we can merge your pull request, we need you to sign our Contributor License Agreement (CLA).

**👉 [Click here to review and sign the CLA](${claUrl})**

### Alternative: Sign via comment

You can also sign the CLA by commenting on this PR with:

\`\`\`
I have read the CLA and I agree
\`\`\`

Once you've signed the CLA, this check will be updated automatically.

---
*This is an automated message from [CLA Assistant](${baseUrl})*`;

  try {
    const response = await fetch(`https://api.github.com/repos/${repoName}/issues/${prNumber}/comments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body: commentBody,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to post CLA comment:", error);
    }
  } catch (error) {
    console.error("Error posting CLA comment:", error);
  }
}

async function postCLAConfirmation(repoName: string, prNumber: number, author: string): Promise<void> {
  if (!GITHUB_TOKEN) {
    return;
  }
  
  const commentBody = `## ✅ CLA Signed

Thank you @${author}! Your CLA signature has been recorded successfully.

This pull request can now be reviewed and merged by the maintainers.

---
*This is an automated message from CLA Assistant*`;

  try {
    const response = await fetch(`https://api.github.com/repos/${repoName}/issues/${prNumber}/comments`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body: commentBody,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to post CLA confirmation:", error);
    }
  } catch (error) {
    console.error("Error posting CLA confirmation:", error);
  }
}

async function getRepoConfig(repoName: string) {
  for await (const entry of kv.list({ prefix: ["user_repo"] })) {
    const repo = entry.value as any;
    if (repo.name === repoName && repo.enabled) {
      return repo;
    }
  }
  return null;
}

async function updateRepoStats(repoName: string, action: "signed" | "pending") {
  for await (const entry of kv.list({ prefix: ["user_repo"] })) {
    const repo = entry.value as any;
    if (repo.name === repoName) {
      const updated = {
        ...repo,
        signedCount: action === "signed" ? (repo.signedCount || 0) + 1 : repo.signedCount,
        pendingCount: action === "pending" ? (repo.pendingCount || 0) + 1 : repo.pendingCount,
        totalPRs: (repo.totalPRs || 0) + 1,
      };
      
      await kv.set(entry.key, updated);
      break;
    }
  }
}