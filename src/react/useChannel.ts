import { useEffect, useState, useCallback, useRef } from 'react';
import { usePushFloContext } from './PushFloProvider.js';
import type { ConnectionState } from '../types/connection.js';
import type { Message } from '../types/message.js';

export interface UseChannelOptions {
  /** Callback for received messages */
  onMessage?: (message: Message) => void;

  /** Callback for subscription errors */
  onError?: (error: Error) => void;

  /** Maximum number of messages to keep in state */
  maxMessages?: number;
}

export interface UseChannelResult {
  /** Array of received messages */
  messages: Message[];

  /** Most recent message (or null) */
  lastMessage: Message | null;

  /** Current connection state */
  connectionState: ConnectionState;

  /** Whether subscribed to the channel */
  isSubscribed: boolean;

  /** Clear all stored messages */
  clearMessages: () => void;
}

/**
 * Hook for subscribing to a PushFlo channel
 *
 * @example
 * ```tsx
 * function NotificationList() {
 *   const { messages, connectionState } = useChannel('notifications');
 *
 *   if (connectionState === 'connecting') {
 *     return <div>Connecting...</div>;
 *   }
 *
 *   return (
 *     <ul>
 *       {messages.map((msg) => (
 *         <li key={msg.id}>{msg.content.title}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useChannel(
  channel: string,
  options: UseChannelOptions = {}
): UseChannelResult {
  const { connectionState, client } = usePushFloContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const maxMessages = options.maxMessages ?? 100;

  // Handle incoming messages
  const handleMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      const newMessages = [...prev, message];
      // Trim to max messages
      if (newMessages.length > maxMessages) {
        return newMessages.slice(-maxMessages);
      }
      return newMessages;
    });

    // Call user callback
    optionsRef.current.onMessage?.(message);
  }, [maxMessages]);

  // Handle errors
  const handleError = useCallback((error: Error) => {
    optionsRef.current.onError?.(error);
  }, []);

  // Subscribe to channel
  useEffect(() => {
    if (!client || !channel) {
      return;
    }

    const subscription = client.subscribe(channel, {
      onMessage: handleMessage,
      onError: handleError,
      onSubscribed: () => setIsSubscribed(true),
      onUnsubscribed: () => setIsSubscribed(false),
    });

    if (!subscription) {
      return;
    }

    return () => {
      subscription.unsubscribe();
      setIsSubscribed(false);
    };
  }, [client, channel, handleMessage, handleError]);

  // Clear messages function
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    lastMessage: messages.length > 0 ? messages[messages.length - 1]! : null,
    connectionState,
    isSubscribed,
    clearMessages,
  };
}
