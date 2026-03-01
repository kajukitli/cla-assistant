# Deployment Guide

## Deno Deploy

### Quick Deploy

```bash
# 1. Create project and deploy
deno deploy create

# 2. Or deploy to existing project
deno deploy --app=your-app-name
```

The `deno deploy create` command will:
- Ask you to authorize via browser at https://console.deno.com/auth?code=XXXX-XXXX
- Create a new Deno Deploy application
- Upload and deploy your code
- Provide the deployment URL

### Manual Steps

1. **Visit https://dash.deno.com/**
2. **Create New Project**: Click "New Project" 
3. **Connect GitHub**: Link your GitHub account and select the `cla-assistant` repository
4. **Configure**:
   - Entrypoint: `main.ts`
   - Build command: (leave empty)
   - Install command: (leave empty)

### Environment Variables

Set these in the Deno Deploy dashboard:

```bash
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
GITHUB_TOKEN=your_github_bot_token
BASE_URL=https://your-app.deno.dev
```

### GitHub OAuth Setup

1. **Create GitHub OAuth App**:
   - Go to GitHub Settings > Developer settings > OAuth Apps
   - New OAuth App
   - Homepage URL: `https://your-app.deno.dev`  
   - Callback URL: `https://your-app.deno.dev/auth/callback`

2. **Create GitHub Bot Token**:
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Generate new token with `repo` scope for posting comments

### Webhook Setup

For each repository you want to manage:

1. **Go to Repository Settings > Webhooks**
2. **Add webhook**:
   - Payload URL: `https://your-app.deno.dev/webhook`
   - Content type: `application/json`  
   - Events: `Pull requests` and `Issue comments`
   - Secret: (optional, for security)

## Alternative Deployments

### Self-Hosted

```bash
# Clone and setup
git clone https://github.com/kajukitli/cla-assistant.git
cd cla-assistant
cp .env.example .env

# Edit .env with your values
# GITHUB_CLIENT_ID=...
# GITHUB_CLIENT_SECRET=...
# GITHUB_TOKEN=...
# BASE_URL=https://your-domain.com

# Run
deno task start
```

### Docker

```dockerfile
FROM denoland/deno:1.38.0

WORKDIR /app
COPY . .

RUN deno cache --unstable-kv main.ts

EXPOSE 8000

CMD ["run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "--unstable-kv", "main.ts"]
```

### Railway / Render / Fly.io

1. **Connect repository**
2. **Set build command**: `deno cache --unstable-kv main.ts`
3. **Set start command**: `deno run --allow-net --allow-env --allow-read --allow-write --unstable-kv main.ts`
4. **Add environment variables** (see above)

## Post-Deployment

1. **Test OAuth**: Visit your app and try signing in with GitHub
2. **Add a repository**: Configure a test repository with CLA
3. **Test webhook**: Open a test PR to verify automatic CLA checking
4. **Monitor logs**: Check deployment logs for any errors

Your CLA Assistant should now be live and ready to manage contributor license agreements!