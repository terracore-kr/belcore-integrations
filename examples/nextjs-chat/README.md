# Belcore chat example (Next.js)

A chat app with long-term memory in about 100 lines. Copy it, add your key, run it.

```bash
npx degit terracore-kr/belcore-integrations/examples/nextjs-chat my-chat
cd my-chat
npm install
cp .env.example .env.local   # paste your key into BELCORE_API_KEY
npm run dev
```

Get a key at [belcore.xyz/developers/signup](https://belcore.xyz/developers/signup) (5,000 free calls, no card). Open http://localhost:3000.

## Try it

1. Tell it something: *"I'm allergic to peanuts and I'm planning a trip to Lisbon in May."*
2. Talk about other things for a while.
3. Ask: *"What should I watch out for when I eat out on my trip?"*

Stop the server, start it again, reload the page, and ask again. It still knows.

## Where things live

| | |
|---|---|
| `app/api/chat/route.ts` | One chat turn: load history → `generateText` with Belcore → save reply and emotion |
| `lib/store.ts` | **Your database.** A local JSON file here. Replace the two functions with Postgres, Redis or whatever you use |
| `app/page.tsx` | The chat UI |

Belcore does not store the conversation text. You keep the history and send it with each call; Belcore picks the turns that matter from the whole history and answers. It also returns an emotion state, which you save and send back on the next turn.

## Deploying

The JSON file works on your machine but not on serverless hosts, whose file system is temporary. Before deploying, replace `lib/store.ts` with a real database.

## More

- All integrations (LangChain.js, MCP, plain SDK): https://github.com/terracore-kr/belcore-integrations
- API docs: https://belcore.xyz/developers#docs
