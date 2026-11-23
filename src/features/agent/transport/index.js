import { createMockAgentStream } from './mockStream'
import { createSseAgentStream } from './sseStream'

export const AGENT_TRANSPORT_MODE =
  import.meta.env.VITE_AGENT_TRANSPORT || 'mock'

export function createAgentStream() {
  if (AGENT_TRANSPORT_MODE === 'sse') {
    return createSseAgentStream({
      url: import.meta.env.VITE_AGENT_API_URL || '',
    })
  }
  return createMockAgentStream()
}
