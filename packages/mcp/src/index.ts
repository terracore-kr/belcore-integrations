#!/usr/bin/env node
/**
 * @belcore/mcp — MCP server (stdio) exposing Belcore to any MCP client.
 *
 *   BELCORE_API_KEY=sk_live_... npx @belcore/mcp
 *
 * Tools:
 *   belcore_chat           one turn with long-term context selection over the history you pass
 *   belcore_export_memory  download what Belcore holds for an end user (endUserId mode only)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import { Belcore } from "@belcore/sdk"

export function buildServer(client: Belcore) {
  const server = new McpServer({ name: "belcore", version: "0.1.1" })
  const emotion = z.object({ longing: z.number(), sulkiness: z.number(), emotionUpdatedAt: z.number() }).partial()
  server.registerTool(
    "belcore_chat",
    {
      description: "Ask Belcore for one reply. Pass the full conversation history; Belcore selects the relevant long-term context and returns the reply plus updated emotion state. Belcore does not store conversation text.",
      inputSchema: {
        messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1),
        system: z.string().optional(),
        model: z.string().optional(),
        emotion: emotion.optional(),
        endUserId: z.string().optional(),
        subjectId: z.string().optional(),
      },
    },
    async (args) => {
      const res = await client.chat(args)
      return {
        content: [{ type: "text", text: res.reply }],
        structuredContent: { reply: res.reply, emotion: res.emotion ?? null, memory: res.memory ?? null, degraded: res.degraded ?? false },
      }
    },
  )
  server.registerTool(
    "belcore_export_memory",
    {
      description: "Export the numeric state Belcore holds for an end user (only exists if you used endUserId mode).",
      inputSchema: { endUserId: z.string(), subjectId: z.string().optional() },
    },
    async ({ endUserId, subjectId }) => {
      const data = await client.exportMemory(endUserId, { subjectId })
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }
    },
  )
  return server
}

// True when this file is the program being run (also through the npx bin symlink), false when imported.
const isMain = (() => {
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url) } catch { return false }
})()
if (isMain) {
  const server = buildServer(new Belcore())
  await server.connect(new StdioServerTransport())
}
