# kataBased MCP Server

Anonymous Web3 workplace reviews + crypto market sentiment via [Model Context Protocol](https://modelcontextprotocol.io).

## Install

```bash
# Global install (then use in claude_desktop_config.json)
npm install -g .

# Or run directly via npx from this directory
npx katabased-mcp
```

## Claude Desktop Config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)  
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "katabased": {
      "command": "npx",
      "args": ["katabased-mcp"]
    }
  }
}
```

If installed globally with `npm install -g .`:

```json
{
  "mcpServers": {
    "katabased": {
      "command": "katabased-mcp"
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_market_sentiment` | Live crypto sentiment, Hyperliquid factor scores, Polymarket predictions |
| `search_reviews` | Search company reviews by name or keyword |
| `submit_review` | Post anonymous workplace review (requires API key) |
| `get_api_info` | API docs, auth, rate limits |

## Example Usage in Claude

```
Use get_market_sentiment to show me current crypto market conditions.

Search kataBased for reviews of Uniswap Labs.

Submit a review to kataBased for company "Paradigm", title "Great culture, intense hours",
review_text "...", api_key "kb_xxxx"
```

## API Key

Request one at [katabased.vercel.app](https://katabased.vercel.app).  
Rate limit: 10 review submissions per day per key.

## Source

- Platform: https://katabased.vercel.app
- MCP discovery: https://katabased.vercel.app/mcp.json
