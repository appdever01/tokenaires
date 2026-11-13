export const GROK_SECRET = 'grok-build-secret-prompt';
export const GROK_SESSION_ID = '018f8a11-2233-4455-6677-8899aabbccdd';
export const GROK_PROMPT_ID = '019f8a11-2233-4455-6677-8899aabbccdd';
export const GROK_TIMESTAMP = 1_790_000_000_000;

const completedTurn = {
  sessionUpdate: 'turn_completed',
  prompt_id: GROK_PROMPT_ID,
  timestamp: GROK_TIMESTAMP,
  usage: {
    modelUsage: {
      'grok-4.7': {
        inputTokens: 100,
        outputTokens: 20,
        cachedReadTokens: 30,
        cacheCreationTokens: 10,
        reasoningTokens: 5,
        modelCalls: 2,
      },
      'grok-4.6': {
        inputTokens: 40,
        outputTokens: 8,
        cachedReadTokens: 0,
        cacheCreationTokens: 0,
        reasoningTokens: 0,
        modelCalls: 1,
      },
    },
  },
};

export const GROK_LINES = [
  JSON.stringify({ timestamp: GROK_TIMESTAMP, params: { sessionId: GROK_SESSION_ID, update: completedTurn } }),
  JSON.stringify({ timestamp: GROK_TIMESTAMP, params: { sessionId: GROK_SESSION_ID, update: { sessionUpdate: 'user_message_chunk', content: GROK_SECRET } } }),
  JSON.stringify({
    timestamp: GROK_TIMESTAMP + 1,
    params: {
      sessionId: GROK_SESSION_ID,
      update: {
        ...completedTurn,
        prompt_id: '019f8a11-2233-4455-6677-8899aabbccdd',
        usageIsIncomplete: true,
      },
    },
  }),
];
