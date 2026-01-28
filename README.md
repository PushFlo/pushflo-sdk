# @pushflo/sdk

Official TypeScript SDK for [PushFlo](https://pushflo.dev) real-time messaging service.

## Features

- **Zero runtime dependencies** - Built entirely on native Web APIs
- **Full TypeScript support** - Complete type definitions included
- **Three entry points** - Browser client, server client, and React hooks
- **Auto-reconnection** - Automatic reconnection with exponential backoff
- **Lightweight** - Minimal bundle size

## Installation

```bash
# npm
npm install @pushflo/sdk

# yarn
yarn add @pushflo/sdk

# pnpm
pnpm add @pushflo/sdk
```

## Quick Start - Browser (60 seconds)

```typescript
import { PushFloClient } from '@pushflo/sdk';

// 1. Create client
const client = new PushFloClient({
  publishKey: 'pub_xxxxxxxxxxxxx', // Get from console.pushflo.dev
});

// 2. Connect
await client.connect();

// 3. Subscribe to channel
const subscription = client.subscribe('notifications', {
  onMessage: (message) => {
    console.log('Received:', message.content);
    console.log('Event type:', message.eventType);
    console.log('Timestamp:', new Date(message.timestamp));
  },
});

// 4. Cleanup when done
subscription.unsubscribe();
client.disconnect();
```

## Quick Start - Server (60 seconds)

```typescript
import { PushFloServer } from '@pushflo/sdk/server';

// 1. Create server client
const pushflo = new PushFloServer({
  secretKey: 'sec_xxxxxxxxxxxxx', // Get from console.pushflo.dev
});

// 2. Publish a message
const result = await pushflo.publish('notifications', {
  title: 'New Order',
  orderId: '12345',
  amount: 99.99,
});

console.log('Message ID:', result.id);
console.log('Delivered to:', result.delivered, 'subscribers');
```

## Quick Start - React (60 seconds)

```tsx
// App.tsx - Wrap your app with provider
import { PushFloProvider } from '@pushflo/sdk/react';

function App() {
  return (
    <PushFloProvider publishKey="pub_xxxxxxxxxxxxx">
      <NotificationList />
    </PushFloProvider>
  );
}

// NotificationList.tsx - Subscribe to channel
import { useChannel } from '@pushflo/sdk/react';

function NotificationList() {
  const { messages, connectionState } = useChannel('notifications');

  if (connectionState === 'connecting') {
    return <div>Connecting...</div>;
  }

  return (
    <ul>
      {messages.map((msg) => (
        <li key={msg.id}>
          <strong>{msg.content.title}</strong>
          <span>{new Date(msg.timestamp).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}
```

## Browser Client

### Connection State Handling

```typescript
import { PushFloClient, ConnectionState } from '@pushflo/sdk';

const client = new PushFloClient({ publishKey: 'pub_xxx' });

// Listen to connection changes
client.onConnectionChange((state: ConnectionState) => {
  switch (state) {
    case 'disconnected':
      console.log('Disconnected from PushFlo');
      break;
    case 'connecting':
      console.log('Connecting to PushFlo...');
      break;
    case 'connected':
      console.log('Connected to PushFlo!');
      break;
    case 'error':
      console.log('Connection error');
      break;
  }
});

await client.connect();
```

### Client Options

```typescript
const client = new PushFloClient({
  // Required
  publishKey: 'pub_xxxxxxxxxxxxx',

  // Optional
  baseUrl: 'https://api.pushflo.dev',  // Custom API URL
  autoConnect: false,                   // Auto-connect on creation
  debug: false,                         // Enable debug logging
  connectionTimeout: 30000,             // Connection timeout (ms)
  heartbeatInterval: 25000,             // Heartbeat interval (ms)
  autoReconnect: true,                  // Auto-reconnect on disconnect
  maxReconnectAttempts: 0,              // Max reconnect attempts (0 = infinite)
  reconnectDelay: 1000,                 // Initial reconnect delay (ms)
  maxReconnectDelay: 30000,             // Max reconnect delay (ms)
});
```

### Subscription Options

```typescript
const subscription = client.subscribe('notifications', {
  onMessage: (message) => {
    console.log('Received:', message);
  },
  onError: (error) => {
    console.error('Subscription error:', error);
  },
  onSubscribed: () => {
    console.log('Successfully subscribed');
  },
  onUnsubscribed: () => {
    console.log('Unsubscribed');
  },
});

// Later: unsubscribe
subscription.unsubscribe();
```

### Event Listeners

```typescript
// Listen for all messages
client.on('message', (message) => {
  console.log('Message on', message.channel, ':', message.content);
});

// Listen for errors
client.on('error', (error) => {
  console.error('Error:', error);
});

// Listen for connection events
client.on('connected', (info) => {
  console.log('Connected with client ID:', info.clientId);
});

client.on('disconnected', (reason) => {
  console.log('Disconnected:', reason);
});
```

## Server Client

### Channel Management

```typescript
import { PushFloServer } from '@pushflo/sdk/server';

const pushflo = new PushFloServer({ secretKey: 'sec_xxx' });

// List all channels
const { channels, pagination } = await pushflo.listChannels({
  page: 1,
  pageSize: 25,
});
console.log('Channels:', channels);
console.log('Total:', pagination.total);

// Get a specific channel
const channel = await pushflo.getChannel('notifications');
console.log('Channel:', channel.name, '- Messages:', channel.messageCount);

// Create a new channel
const newChannel = await pushflo.createChannel({
  name: 'Order Updates',
  slug: 'order-updates',
  description: 'Real-time order status updates',
  isPrivate: false,
});
console.log('Created:', newChannel.slug);

// Update a channel
const updated = await pushflo.updateChannel('order-updates', {
  description: 'Updated description',
});

// Delete a channel
await pushflo.deleteChannel('order-updates');
console.log('Channel deleted');
```

### Message History

```typescript
import { PushFloServer } from '@pushflo/sdk/server';

const pushflo = new PushFloServer({ secretKey: 'sec_xxx' });

// Get message history
const { messages, pagination } = await pushflo.getMessageHistory('notifications', {
  page: 1,
  pageSize: 50,
});

messages.forEach((msg) => {
  console.log(`[${msg.eventType}] ${JSON.stringify(msg.content)}`);
});

console.log(`Page ${pagination.page} of ${pagination.totalPages}`);
```

### Publishing with Event Types

```typescript
import { PushFloServer } from '@pushflo/sdk/server';

const pushflo = new PushFloServer({ secretKey: 'sec_xxx' });

// Publish with custom event type
await pushflo.publish('orders',
  { orderId: '123', status: 'shipped' },
  { eventType: 'order.shipped' }
);

// Subscribe and filter by event type (browser client)
client.subscribe('orders', {
  onMessage: (message) => {
    if (message.eventType === 'order.shipped') {
      showShippingNotification(message.content);
    } else if (message.eventType === 'order.delivered') {
      showDeliveryNotification(message.content);
    }
  },
});
```

### Server Options

```typescript
const pushflo = new PushFloServer({
  // Required
  secretKey: 'sec_xxxxxxxxxxxxx',

  // Optional
  baseUrl: 'https://api.pushflo.dev',  // Custom API URL
  timeout: 30000,                       // Request timeout (ms)
  debug: false,                         // Enable debug logging
  retryAttempts: 3,                     // Retry failed requests
});
```

## React Integration

### Provider Options

```tsx
import { PushFloProvider } from '@pushflo/sdk/react';

function App() {
  return (
    <PushFloProvider
      publishKey={process.env.NEXT_PUBLIC_PUSHFLO_PUBLISH_KEY!}
      baseUrl={process.env.NEXT_PUBLIC_PUSHFLO_BASE_URL}
      autoConnect={true}
      debug={process.env.NODE_ENV === 'development'}
    >
      <Dashboard />
    </PushFloProvider>
  );
}
```

### usePushFlo Hook

```tsx
import { usePushFlo } from '@pushflo/sdk/react';

function Dashboard() {
  const { connectionState, isConnected, connect, disconnect } = usePushFlo();

  return (
    <div>
      <p>Status: {connectionState}</p>
      <button onClick={connect} disabled={isConnected}>Connect</button>
      <button onClick={disconnect} disabled={!isConnected}>Disconnect</button>
    </div>
  );
}
```

### useChannel Hook

```tsx
import { useChannel } from '@pushflo/sdk/react';

function NotificationBell() {
  const { messages, lastMessage, clearMessages, isSubscribed } = useChannel('notifications', {
    onMessage: (msg) => {
      // Play sound, show toast, etc.
      playNotificationSound();
    },
    maxMessages: 100, // Limit stored messages
  });

  return (
    <div>
      <span>({messages.length} new)</span>
      {lastMessage && <p>Latest: {lastMessage.content.title}</p>}
      <button onClick={clearMessages}>Clear</button>
    </div>
  );
}
```

## Error Handling

```typescript
import {
  PushFloClient,
  PushFloError,
  ConnectionError,
  AuthenticationError
} from '@pushflo/sdk';

const client = new PushFloClient({ publishKey: 'pub_xxx' });

try {
  await client.connect();
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key:', error.message);
  } else if (error instanceof ConnectionError) {
    console.error('Connection failed:', error.message);
    if (error.retryable) {
      console.log('Will auto-retry...');
    }
  } else if (error instanceof PushFloError) {
    console.error('PushFlo error:', error.code, error.message);
  } else {
    throw error;
  }
}

// Listen for runtime errors
client.on('error', (error) => {
  console.error('Runtime error:', error);
});
```

### Error Types

| Error Class | Description | Retryable |
|-------------|-------------|-----------|
| `PushFloError` | Base error class | Varies |
| `ConnectionError` | WebSocket connection issues | Yes |
| `AuthenticationError` | Invalid/missing API key | No |
| `NetworkError` | HTTP request failures | Varies |

## Environment Variables

```bash
# .env.local (Next.js)
NEXT_PUBLIC_PUSHFLO_PUBLISH_KEY=pub_xxxxxxxxxxxxx
NEXT_PUBLIC_PUSHFLO_BASE_URL=https://api.pushflo.dev
PUSHFLO_SECRET_KEY=sec_xxxxxxxxxxxxx

# .env (Vite)
VITE_PUSHFLO_PUBLISH_KEY=pub_xxxxxxxxxxxxx
VITE_PUSHFLO_BASE_URL=https://api.pushflo.dev

# .env (Node.js server)
PUSHFLO_SECRET_KEY=sec_xxxxxxxxxxxxx
PUSHFLO_BASE_URL=https://api.pushflo.dev
```

## TypeScript Types

```typescript
import type {
  // Connection
  ConnectionState,
  ClientOptions,
  ServerOptions,

  // Channels
  Channel,
  ChannelInput,

  // Messages
  Message,
  PublishOptions,
  PublishResult,

  // API
  Pagination,

  // Subscriptions
  Subscription,
  SubscriptionOptions,
} from '@pushflo/sdk';
```

## API Keys

| Key Prefix | Permissions | Use Case |
|------------|-------------|----------|
| `pub_xxx` | Read/Subscribe | Browser clients |
| `sec_xxx` | Read/Write/Publish | Server-side code |
| `mgmt_xxx` | Full access | Channel management |

## Troubleshooting

### Connection Issues

```typescript
// Enable debug logging
const client = new PushFloClient({
  publishKey: 'pub_xxx',
  debug: true, // Logs all WebSocket activity
});
```

### CORS Errors

CORS is configured on the PushFlo servers. If you see CORS errors, ensure:
- You're using the correct API endpoint
- Your domain is registered in the PushFlo console

### React Strict Mode

The SDK handles React Strict Mode correctly. The client is cleaned up and recreated as needed during development.

### Server-Side Rendering (SSR)

The browser client requires `WebSocket` which is not available on the server. Use the SDK only in client components or with dynamic imports:

```tsx
// Next.js App Router
'use client';

import { PushFloProvider } from '@pushflo/sdk/react';
```

## License

MIT
