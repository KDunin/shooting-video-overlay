# shadcn CLI — reference only for this template

**This monorepo does not use the shadcn CLI to add or update components.** UI comes from the **`@kdunin/component-library`** package (see [SKILL.md](./SKILL.md)). There is no equivalent `shadcn add` for that package.

Use the CLI **only** when you need documentation URLs or to browse the public registry from a terminal:

```bash
# Documentation links (fetch the printed URLs for examples and API notes).
bunx shadcn@latest docs button dialog select

# Inspect registry metadata (optional).
bunx shadcn@latest view @shadcn/button
bunx shadcn@latest search @shadcn -q "sidebar"
```

Prefer the **shadcn MCP** in the editor when available — see [mcp.md](./mcp.md).

When examples use `@/components/ui/...` or Radix-only APIs, translate to:

- Imports from `@kdunin/component-library`
- **Base UI** patterns per [rules/base-vs-radix.md](./rules/base-vs-radix.md)

---

## Upstream CLI (not used for installs here)

The stock shadcn CLI supports `init`, `add`, `search`, `view`, `docs`, `info`, `build`, presets, and registries. That workflow assumes components are copied into the repo. **Do not run `init` / `add` for this template** to “get” components — add or bump **`@kdunin/component-library`** in `package.json` instead.

Full upstream command reference: [ui.shadcn.com](https://ui.shadcn.com/docs/cli) and the default shadcn skill upstream docs.
