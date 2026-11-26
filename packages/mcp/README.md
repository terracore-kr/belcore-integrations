# @belcore/mcp

MCP server for Belcore. Gives Claude Desktop, Cursor and other MCP clients a chat tool with long-term memory and an emotion state.

Get an API key at [belcore.xyz/developers/signup](https://belcore.xyz/developers/signup) (5,000 free calls, no card) and set `BELCORE_API_KEY`.

## Usage

```json
{
  "mcpServers": {
    "belcore": { "command": "npx", "args": ["-y", "@belcore/mcp"], "env": { "BELCORE_API_KEY": "sk_live_..." } }
  }
}
```

Tools: `belcore_chat`, `belcore_export_memory`.

## How it works

You keep the conversation history in **your** database and send it with each call. Belcore picks the context that matters from the whole history, answers, and returns the updated emotion state for you to save. Belcore does not store conversation text.

```
your DB ──history──▶ Belcore ──reply + emotion──▶ your DB
```


## Links

- All Belcore integrations: https://github.com/terracore-kr/belcore-integrations
- API docs: https://belcore.xyz/developers#docs

## License

Apache-2.0
