# SignalAlerts Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot that connects trading signal providers with subscribers. Providers send alerts which are delivered as private messages to their followers. Users can browse providers, follow/unfollow, and receive alerts with quick actions like reply and report. Admins manage providers, view stats, and handle abuse reports.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Signal providers
- Followers/subscribers
- Admins

## Success criteria

- Providers can send alerts and have them delivered to followers
- Followers receive alerts as private messages with quick actions
- Admins can approve providers and manage abuse reports

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu
- **/browse** (command, actor: user, command: /browse) — Browse available providers
- **/search** (command, actor: user, command: /search) — Search for providers by name or description
- **/following** (command, actor: user, command: /following) — View and manage followed providers
- **/become_provider** (command, actor: user, command: /become_provider) — Request to become a signal provider
- **Follow** (button, actor: user, callback: follow:provider_id) — Subscribe to a provider's alerts
  - inputs: provider_id
  - outputs: subscription confirmation
- **Unfollow** (button, actor: user, callback: unfollow:provider_id) — Unsubscribe from a provider's alerts
  - inputs: provider_id
  - outputs: unfollow confirmation
- **Reply to provider** (button, actor: user, callback: reply:signal_id) — Send a message to the provider through the bot
  - inputs: signal_id, message
  - outputs: message sent confirmation
- **Report** (button, actor: user, callback: report:signal_id) — Report a specific signal to admins
  - inputs: signal_id
  - outputs: report submitted confirmation

## Flows

### Provider Onboarding
_Trigger:_ /become_provider

1. User sends /become_provider with display name and description
2. Admin reviews and approves/rejects provider
3. Approved provider receives API token for webhook use

_Data touched:_ Provider

### Signal Sending (Manual)
_Trigger:_ /signal

1. Provider sends /signal with message content
2. Bot asks for optional metadata (symbol, direction, size)
3. Bot records and distributes signal to followers

_Data touched:_ Signal

### Signal Sending (Webhook)
_Trigger:_ Webhook POST

1. Provider sends POST to webhook with payload and API token
2. Bot validates token and distributes signal

_Data touched:_ Signal

### Signal Receiving
_Trigger:_ Signal delivery

1. Bot receives signal
2. Bot sends private message to each follower with signal content and actions

_Data touched:_ Signal, Follower

### Abuse Reporting
_Trigger:_ Report button

1. User reports signal
2. Bot sends report to admin chat with details

_Data touched:_ Signal, Report

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Provider** _(retention: persistent)_ — Signal provider account with display name, description, and approval status
  - fields: provider_id, display_name, description, approved, api_token
- **Follower** _(retention: persistent)_ — Telegram user who follows providers and receives alerts
  - fields: user_id, followed_providers
- **Signal** _(retention: persistent)_ — Trading alert message with content, metadata, and timestamp
  - fields: signal_id, provider_id, content, symbol, direction, size, timestamp
- **Report** _(retention: persistent)_ — Abuse report for a specific signal
  - fields: report_id, signal_id, user_id, timestamp
- **AdminAction** _(retention: persistent)_ — Moderation action taken by admin
  - fields: action_id, action_type, provider_id, timestamp

## Integrations

- **Telegram** (required) — Bot API messaging and user interactions
- **Webhook** (required) — Automated signal submission by providers
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Approve/reject providers
- View abuse reports
- Manage provider mute/revoke
- Configure admin notification chat

## Notifications

- Admin notifications for provider signups awaiting approval
- Admin notifications for abuse reports
- Provider approval/rejection notifications
- Signal delivery confirmation to providers

## Permissions & privacy

- Private message delivery to followers only
- Provider contact info remains hidden from followers
- User identity hidden from providers when using reply feature
- Admins have access to moderation tools and reports

## Edge cases

- Provider sends signal before admin approval
- User tries to follow unapproved provider
- Multiple reports for same signal
- Provider webhook token is invalid or missing
- User sends message to bot that isn't a recognized command

## Required tests

- Provider onboarding and approval workflow
- Signal delivery to followers with metadata
- Abuse reporting and admin notification flow
- Webhook signal submission with token validation
- Private message delivery with quick actions

## Assumptions

- Providers will use either manual or webhook method to send signals
- Admin approval is required for all providers
- Private message delivery is preferred over group/channel distribution
- No built-in payment system is needed initially
