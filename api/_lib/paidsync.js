// Minimal MCP client for PaidSync (https://paidsync.ai/mcp): JSON-RPC 2.0
// over streamable HTTP. MCP is PaidSync's API — initialize, then tools/list
// (unmetered) or tools/call (metered, one task per call).
//
// Env: PAIDSYNC_API_KEY (required), PAIDSYNC_MCP_URL (optional override).

const PROTOCOL_VERSION = '2025-03-26';

const endpoint = () => {
  const base = process.env.PAIDSYNC_MCP_URL || 'https://paidsync.ai/mcp';
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}key=${encodeURIComponent(process.env.PAIDSYNC_API_KEY || '')}`;
};

export const paidsyncConfigured = () => Boolean(process.env.PAIDSYNC_API_KEY);

let rpcId = 0;

async function post(body, sessionId) {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify(body),
  });

  const newSession = res.headers.get('mcp-session-id') || sessionId;
  if (res.status === 202) return { payload: null, sessionId: newSession }; // notification ack

  const ct = res.headers.get('content-type') || '';
  let payload = null;
  if (ct.includes('text/event-stream')) {
    // Streamable HTTP: JSON-RPC responses arrive as SSE data lines.
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (!line.startsWith('data:')) continue;
      try {
        const msg = JSON.parse(line.slice(5).trim());
        if (msg.id === body.id) payload = msg;
      } catch {
        /* keep scanning */
      }
    }
  } else {
    payload = await res.json().catch(() => null);
  }

  if (!res.ok && !payload) {
    throw new Error(`PaidSync MCP HTTP ${res.status}`);
  }
  if (payload?.error) {
    throw new Error(`PaidSync MCP error: ${payload.error.message || JSON.stringify(payload.error)}`);
  }
  return { payload, sessionId: newSession };
}

// One session per lambda instance, re-created on demand.
let session = null;

async function ensureSession() {
  if (session) return session;
  const init = await post(
    {
      jsonrpc: '2.0',
      id: ++rpcId,
      method: 'initialize',
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'avail-reporting', version: '1.0.0' },
      },
    },
    null
  );
  await post(
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    init.sessionId
  ).catch(() => {});
  session = init.sessionId || 'stateless';
  return session;
}

async function rpc(method, params) {
  const sid = await ensureSession();
  try {
    const { payload } = await post({ jsonrpc: '2.0', id: ++rpcId, method, params }, sid === 'stateless' ? null : sid);
    return payload?.result;
  } catch (err) {
    session = null; // force a fresh handshake next time
    throw err;
  }
}

// Unmetered: browse the tool catalog (paginated).
export async function paidsyncListTools() {
  const tools = [];
  let cursor;
  for (let i = 0; i < 10; i++) {
    const result = await rpc('tools/list', cursor ? { cursor } : {});
    tools.push(...(result?.tools || []));
    cursor = result?.nextCursor;
    if (!cursor) break;
  }
  return tools;
}

// Metered: one PaidSync task per invocation.
export async function paidsyncCallTool(name, args) {
  const result = await rpc('tools/call', { name, arguments: args });
  if (result?.isError) {
    const text = result?.content?.map((c) => c.text).join('\n') || 'tool error';
    throw new Error(`PaidSync tool ${name} failed: ${text.slice(0, 500)}`);
  }
  // Tool results arrive as content blocks; parse JSON text blocks when present.
  const texts = (result?.content || []).filter((c) => c.type === 'text').map((c) => c.text);
  for (const t of texts) {
    try {
      return JSON.parse(t);
    } catch {
      /* not JSON, keep looking */
    }
  }
  return texts.join('\n') || result;
}
