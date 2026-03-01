# CLA Assistant

A modern, lightweight Contributor License Agreement (CLA) assistant built with Deno and powered by GitHub integration.

## Features

- **Automated CLA Checking**: Automatically checks if contributors have signed the CLA on new pull requests
- **GitHub OAuth Integration**: Secure authentication with GitHub
- **Customizable CLAs**: Configure custom CLA text for each repository
- **Multiple Repositories**: Manage multiple repositories from a single dashboard  
- **Webhook Integration**: Real-time PR monitoring via GitHub webhooks
- **Flexible Signing**: Contributors can sign via web interface or PR comments
- **Deno KV Storage**: Fast, secure data storage with Deno's built-in key-value store

## Quick Start

### 1. Prerequisites

- [Deno](https://deno.land/) installed
- GitHub OAuth App created
- GitHub Bot token (for posting comments)

### 2. Setup GitHub OAuth App

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create new OAuth App with:
   - Homepage URL: `http://localhost:8000`
   - Authorization callback URL: `http://localhost:8000/auth/callback`
3. Note the Client ID and Client Secret

### 3. Setup GitHub Bot Token

1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate a token with `repo` scope for posting comments
3. Or create a GitHub App for more advanced integration

### 4. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit with your values
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret  
GITHUB_TOKEN=your_bot_token
BASE_URL=http://localhost:8000
```

### 5. Run

```bash
# Development with auto-reload
deno task dev

# Production
deno task start
```

## Usage

### For Repository Owners

1. **Sign in**: Visit the app and sign in with GitHub
2. **Add Repository**: Add your repository in the dashboard
3. **Configure CLA**: Customize your CLA text and settings
4. **Setup Webhook**: Add webhook URL to your repository:
   - URL: `https://your-app.com/webhook`
   - Content type: `application/json`
   - Events: `Pull requests`, `Issue comments`
   - Secret: (optional, for security)

### For Contributors

When opening a PR on a configured repository:

1. **Automatic Check**: CLA Assistant checks if you've signed the CLA
2. **Sign if Needed**: If not signed, you'll get a comment with a link
3. **Two Ways to Sign**:
   - Click the link to sign via web interface
   - Comment "I have read the CLA and I agree" on the PR
4. **Confirmation**: Get automatic confirmation when CLA is signed

## API Routes

- `GET /` - Landing page
- `GET /auth/github` - GitHub OAuth login
- `GET /auth/callback` - OAuth callback
- `GET /dashboard` - User dashboard (requires auth)
- `GET /repo/{repoName}` - Repository configuration
- `GET /sign?repo={name}` - CLA signing page
- `POST /webhook` - GitHub webhook endpoint

## Data Storage

Uses Deno KV with these key patterns:

```
["session", sessionId] - User sessions
["user", userId] - User data  
["user_repo", userId, repoName] - Repository configurations
["cla_signature", userId, repoName] - CLA signatures
["auth_state", state] - OAuth state (temporary)
```

## Deployment

### Deno Deploy

```bash
# Deploy to Deno Deploy
deployctl deploy --project=cla-assistant main.ts

# Set environment variables in Deno Deploy dashboard
```

### Docker

```dockerfile
FROM denoland/deno:1.38.0

WORKDIR /app
COPY . .

RUN deno cache main.ts

EXPOSE 8000

CMD ["run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "main.ts"]
```

### Self-hosted

```bash
# Clone and run
git clone <this-repo>
cd cla-assistant
cp .env.example .env
# Edit .env with your values
deno task start
```

## Development

```bash
# Run with auto-reload
deno task dev

# Format code
deno fmt

# Lint code  
deno lint

# Check types
deno check main.ts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.