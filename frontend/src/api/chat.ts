import type { ChatMessage } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const chatApi = {
  streamMessage: async (
    sessionId: string,
    message: string,
    history: ChatMessage[],
    accessToken: string,
    onToken: (token: string) => void,
    onDone: (contextEntries: { line_number: number; level: string; message: string }[]) => void,
    onError: (err: string) => void
  ): Promise<void> => {
    const response = await fetch(`${BASE_URL}/chat/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok) {
      onError(`HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.token) {
              onToken(payload.token);
            } else if (payload.done) {
              onDone(payload.context_entries || []);
            } else if (payload.error) {
              onError(payload.error);
            }
          } catch {
            // Non-JSON line, skip
          }
        }
      }
    }
  },

  getChatHistory: async (sessionId: string, accessToken: string): Promise<ChatMessage[]> => {
    const response = await fetch(`${BASE_URL}/chat/sessions/${sessionId}/chat-history`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.history || [];
  },
};
