# Email Channel Recipe — SendGrid

Give your agent an email address. Users email in, agent responds.

## Prerequisites

- **SendGrid account** — [signup.sendgrid.com](https://signup.sendgrid.com) (60-day trial, 100 emails/day)
- **Verified sender** — Single Sender Verification or Domain Authentication
- **For inbound email** — Domain with DNS access (for MX records)

## Cost

| Component              | Cost                      |
| ---------------------- | ------------------------- |
| SendGrid trial         | Free (60 days, 100/day)   |
| SendGrid Essentials    | $19.95/mo (50K emails/mo) |
| Alternative: AgentMail | Contact for pricing       |

> **Note:** SendGrid eliminated their permanent free tier in May 2025. After 60-day trial, minimum is $19.95/mo.

## Setup (3-10 min)

### Step 1: Get SendGrid API Key

1. Go to [app.sendgrid.com](https://app.sendgrid.com) → Settings → API Keys
2. Create API Key → Full Access (or Mail Send only)
3. Copy the key (shown only once)

### Step 2: Verify Sender

**Single Sender Verification (quick):**

1. Settings → Sender Authentication → Single Sender Verification
2. Add your email address, verify via confirmation email

**Domain Authentication (recommended for production):**

1. Settings → Sender Authentication → Domain Authentication
2. Add CNAME records to your DNS
3. Verify in SendGrid dashboard

### Step 3: Configure AgentDial

```bash
# Interactive setup
agentdial setup
# Select "email" channel
# Enter: API Key, From Email, From Name

# Or programmatic
echo '{"apiKey":"SG.xxx","fromEmail":"agent@yourdomain.com","fromName":"My Agent"}' \
  > ~/.agentdial/credentials/email.json
chmod 600 ~/.agentdial/credentials/email.json
```

### Step 4: Test Outbound

```bash
# Verify credentials
agentdial test email

# Start gateway
agentdial serve --tunnel
```

### Step 5: Set Up Inbound (Optional)

To RECEIVE emails, configure SendGrid Inbound Parse:

1. Go to Settings → Inbound Parse
2. Add your domain + subdomain (e.g., `agent.yourdomain.com`)
3. Set MX record: `agent.yourdomain.com → mx.sendgrid.net` (priority 10)
4. Destination URL: `https://YOUR-TUNNEL.trycloudflare.com/webhook/email`
5. Check "POST the raw, full MIME message" (optional)

## How It Works

### Outbound (Agent → User)

```
Agent Response → EmailAdapter.send() → SendGrid /mail/send → User Inbox
```

### Inbound (User → Agent)

```
User sends email → MX record → SendGrid → POST /webhook/email → Agent → Reply email
```

## Email Formatting

AgentDial renders agent responses as styled HTML emails:

- **Text** → `<p>` tags with line breaks
- **Rich cards** → Bordered divs with images, titles, descriptions
- **Action buttons** → Purple styled links (Energy brand color)

## Alternative: AgentMail

[AgentMail](https://agentmail.to) is a YC-backed API built specifically for AI agents:

- **npm:** `agentmail-sdk`
- **Inbox creation:** API call creates `agent-name@agentmail.to` inbox
- **Webhook support:** Built-in webhook for inbound emails
- **No DNS setup needed** — uses AgentMail's domain
- **Pricing:** Contact for details

To use AgentMail instead of SendGrid, you'd need a custom adapter (not yet built). The email adapter interface is designed to be swappable.

## Troubleshooting

| Problem               | Solution                                                         |
| --------------------- | ---------------------------------------------------------------- |
| 403 on send           | API key lacks Mail Send permission — regenerate with Full Access |
| Emails go to spam     | Set up Domain Authentication (not just Single Sender)            |
| Inbound not working   | Check MX record propagation: `dig MX agent.yourdomain.com`       |
| HTML rendering broken | Check email client compatibility — test with Gmail + Outlook     |
| Rate limited          | Free trial: 100/day. Check SendGrid Activity Feed for details    |

## Security Notes

- Store API key in `~/.agentdial/credentials/email.json` (0600 permissions)
- Never commit API keys to git
- Use environment variables in production: `SENDGRID_API_KEY`
- Inbound Parse webhook should validate sender to prevent spam
