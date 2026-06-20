# shadcn MCP and `@kdunin/component-library`

## This project

- **`@kdunin/component-library`** has **no** dedicated MCP server. Components are installed only as an **npm dependency** and imported from the package root.
- There is **no** shadcn-style CLI for this library — do not run `shadcn add` or treat MCP “install” commands as applicable to this repo. When MCP returns `get_add_command_for_items`, ignore it for implementation here; use package imports instead.

## How to use official shadcn MCP here

Use the **shadcn** MCP tools (or `bunx shadcn@latest docs` / `view` / `search`) for **discovery and documentation**:

- Search and view registry items, read examples, and pull doc URLs.
- When translating examples into this codebase, replace paths like `@/components/ui/...` with:

  ```ts
  import { Button, Card, /* … */ } from "@kdunin/component-library"
  ```

- Upstream docs often show **Radix** (`asChild`) or **Base** (`render`) variants. This library is built on **`@base-ui/react`** — follow the **base** branches and [rules/base-vs-radix.md](./rules/base-vs-radix.md), not Radix-only snippets.

For project-specific layout (Vite app, `styles.css`, Tailwind `@source`), read the app — there is no MCP equivalent.

---

## shadcn MCP Server (upstream)

The upstream shadcn CLI can expose an MCP server for editors: search, browse, view, and **install** from registries (install does not apply to this template).

### Setup

```bash
shadcn mcp        # start the MCP server (stdio)
shadcn mcp init   # write config for your editor
```

Editor config files:

| Editor      | Config file              |
| ----------- | ------------------------ |
| Claude Code | `.mcp.json`              |
| Cursor      | `.cursor/mcp.json`       |
| VS Code     | `.vscode/mcp.json`       |
| OpenCode    | `opencode.json`          |
| Codex       | `~/.codex/config.toml` (manual) |

### Tools

> **Tip:** MCP tools handle registry operations (search, view, install). For **this** template, use them for reference only; implementation imports come from `@kdunin/component-library`.

### `shadcn:get_project_registries`

Returns registry names from `components.json`. Errors if no `components.json` exists.

**Input:** none

### `shadcn:list_items_in_registries`

Lists all items from one or more registries.

**Input:** `registries` (string[]), `limit` (number, optional), `offset` (number, optional)

### `shadcn:search_items_in_registries`

Fuzzy search across registries.

**Input:** `registries` (string[]), `query` (string), `limit` (number, optional), `offset` (number, optional)

### `shadcn:view_items_in_registries`

View item details including full file contents.

**Input:** `items` (string[]) — e.g. `["@shadcn/button", "@shadcn/card"]`

### `shadcn:get_item_examples_from_registries`

Find usage examples and demos with source code.

**Input:** `registries` (string[]), `query` (string) — e.g. `"accordion-demo"`, `"button example"`

### `shadcn:get_add_command_for_items`

Returns the upstream CLI install command — **not used** for `@kdunin/component-library`; use package imports instead.

**Input:** `items` (string[]) — e.g. `["@shadcn/button"]`

### `shadcn:get_audit_checklist`

Returns a checklist for verifying components (imports, deps, lint, TypeScript).

**Input:** none

---

## Configuring Registries (upstream / generic shadcn projects)

Registries are set in `components.json`. The `@shadcn` registry is always built-in.

```json
{
  "registries": {
    "@acme": "https://acme.com/r/{name}.json",
    "@private": {
      "url": "https://private.com/r/{name}.json",
      "headers": { "Authorization": "Bearer ${MY_TOKEN}" }
    }
  }
}
```

- Names must start with `@`.
- URLs must contain `{name}`.
- `${VAR}` references are resolved from environment variables.

Community registry index: `https://ui.shadcn.com/r/registries.json`
