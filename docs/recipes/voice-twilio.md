# Voice Channel Recipe — Twilio + Voice Provider

Give your agent a phone number. Users call, speak, and get voice responses.

## Prerequisites

- **Twilio account** — [twilio.com/try-twilio](https://www.twilio.com/try-twilio) (free trial includes $15 credit)
- **Phone number** — Buy one in Twilio Console → Phone Numbers → Buy a Number (~$1.15/mo)
- **Voice provider** (optional) — ElevenLabs, Deepgram, OpenAI, Vapi, LiveKit, or use Twilio's built-in Polly

## Cost

| Component            | Cost               |
| -------------------- | ------------------ |
| Twilio phone number  | $1.15/mo           |
| Twilio voice minutes | $0.014/min inbound |
| ElevenLabs TTS       | $0.01-0.05/min     |
| Deepgram STT         | $0.006/min         |
| Total per minute     | ~$0.02-0.10/min    |

## Setup (5 min)

### Step 1: Get Twilio Credentials

1. Go to [twilio.com/console](https://www.twilio.com/console)
2. Copy **Account SID** and **Auth Token** from the dashboard
3. Buy a phone number with Voice capability

### Step 2: Configure AgentDial

```bash
# Interactive setup (recommended)
agentdial voice setup

# Or manual credential save
agentdial setup
# Select "voice" channel
# Enter Account SID, Auth Token, Phone Number
# Select voice provider (default: Polly built-in)
```

### Step 3: Start Gateway with Tunnel

```bash
agentdial serve --tunnel
```

This starts the gateway on port 3141 and creates a public tunnel URL. The webhook is auto-registered on your Twilio phone number.

### Step 4: Test

```bash
# Verify credentials
agentdial voice test

# Check status
agentdial voice status

# Call your Twilio number from any phone
# Speak a message → agent responds with voice
```

## How It Works

```
Phone Call → Twilio → POST /webhook/voice (TwiML) → Agent → TwiML Response
                                                              ↓
                                                    <Gather> speech input
                                                    <Say> agent response
                                                    Loop until hangup
```

1. User calls your Twilio number
2. Twilio sends webhook to AgentDial with call metadata
3. AgentDial returns TwiML: `<Say>` greeting + `<Gather>` for speech input
4. User speaks → Twilio transcribes → sends `SpeechResult` to webhook
5. AgentDial forwards to agent backend → gets response
6. Returns TwiML with `<Say>` response + new `<Gather>`
7. Loop continues until caller hangs up

## Voice Provider Options

### Built-in (Polly — no extra setup)

Uses Amazon Polly via Twilio. Joanna voice by default. Good for testing.

### ElevenLabs (best quality)

```bash
# During voice setup, select "ElevenLabs"
# Enter your ElevenLabs API key
# Voices: ultra-realistic, supports cloning
```

### Deepgram (cheapest)

```bash
# During voice setup, select "Deepgram"
# Enter your Deepgram API key
# Best STT accuracy at lowest cost
```

## Troubleshooting

| Problem                | Solution                                                 |
| ---------------------- | -------------------------------------------------------- |
| No speech recognized   | Check Twilio number has Voice capability enabled         |
| Agent doesn't respond  | Verify `agentdial serve --tunnel` is running             |
| Webhook fails          | Check tunnel URL is registered: `agentdial voice status` |
| TwiML error            | Check server logs for malformed XML                      |
| Call drops immediately | Verify Account SID and Auth Token are correct            |

## Manual Twilio Webhook Setup

If auto-registration doesn't work:

1. Go to Twilio Console → Phone Numbers → Your Number
2. Under "Voice & Fax" → "A Call Comes In"
3. Set to **Webhook**, paste: `https://YOUR-TUNNEL.trycloudflare.com/webhook/voice`
4. Method: **HTTP POST**
