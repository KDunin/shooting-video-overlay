---
name: shadcn
description: UI from @kdunin/component-library — a shadcn-compatible component package on @base-ui/react. Use official shadcn MCP or bunx shadcn@latest docs/view/search for reference only; implement with package imports (no shadcn CLI, no local components.json installs). Applies when building or styling UI, forms, overlays, or when users mention shadcn, Base UI, or this library.
user-invocable: false
---

# `@kdunin/component-library` (shadcn-compatible)

This template ships UI as the npm package **`@kdunin/component-library`**: a **shadcn-compatible** API built on **`@base-ui/react`**. There is **no** shadcn CLI and **no** MCP for the library itself — you import named exports from the package.

## Project context (static)

```json
{
  "uiPackage": "@kdunin/component-library",
  "primitives": "@base-ui/react",
  "docsSource": "Official shadcn/ui docs + MCP (reference only — translate imports and use Base UI patterns)",
  "stylesImport": "@import \"@kdunin/component-library/styles\"",
  "note": "components.json in apps may exist for editor tooling; it does not install components for this workflow"
}
```

## Imports

```tsx
import {
  Button,
  Card,
  CardContent,
  Dialog,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
} from "@kdunin/component-library"
```

Do **not** import from `@/components/ui/...` for primitives unless the app truly vendors a file there. Default pattern: **everything from `@kdunin/component-library`**.

## Documentation and MCP (reference only)

1. **shadcn MCP** — Use `shadcn:*` tools to search registries, view items, and pull examples. Details: [mcp.md](./mcp.md).
2. **CLI docs** — `bunx shadcn@latest docs <component>` prints URLs for official docs and examples. Fetch those pages when you need API detail.
3. **Translate** — Replace `@/components/ui/...` and local paths with `@kdunin/component-library`. When docs show **Radix** (`asChild`) vs **Base** (`render`), follow **Base** — see [rules/base-vs-radix.md](./rules/base-vs-radix.md).
4. **Do not** run `shadcn add`, `shadcn init`, or use MCP install commands to modify this repo’s UI sources. There is no CLI for `@kdunin/component-library`.

## Principles

1. **Use the package first.** Prefer exports from `@kdunin/component-library` before writing bespoke markup.
2. **Compose, don't reinvent.** Settings page = Tabs + Card + form controls. Dashboard = Sidebar + Card + Chart + Table.
3. **Use built-in variants before custom styles.** `variant="outline"`, `size="sm"`, etc.
4. **Use semantic colors.** `bg-primary`, `text-muted-foreground` — never raw values like `bg-blue-500`.

## Critical Rules

These rules are **always enforced**. Each links to a file with Incorrect/Correct code pairs.

### Styling & Tailwind → [styling.md](./rules/styling.md)

- **`className` for layout, not styling.** Never override component colors or typography.
- **No `space-x-*` or `space-y-*`.** Use `flex` with `gap-*`. For vertical stacks, `flex flex-col gap-*`.
- **Use `size-*` when width and height are equal.** `size-10` not `w-10 h-10`.
- **Use `truncate` shorthand.** Not `overflow-hidden text-ellipsis whitespace-nowrap`.
- **No manual `dark:` color overrides.** Use semantic tokens (`bg-background`, `text-muted-foreground`).
- **Use `cn()` for conditional classes.** Don't write manual template literal ternaries.
- **No manual `z-index` on overlay components.** Dialog, Sheet, Popover, etc. handle their own stacking.

### Forms & Inputs → [forms.md](./rules/forms.md)

- **Forms use `FieldGroup` + `Field`.** Never use raw `div` with `space-y-*` or `grid gap-*` for form layout.
- **`InputGroup` uses `InputGroupInput`/`InputGroupTextarea`.** Never raw `Input`/`Textarea` inside `InputGroup`.
- **Buttons inside inputs use `InputGroup` + `InputGroupAddon`.**
- **Option sets (2–7 choices) use `ToggleGroup`.** Don't loop `Button` with manual active state.
- **`FieldSet` + `FieldLegend` for grouping related checkboxes/radios.** Don't use a `div` with a heading.
- **Field validation uses `data-invalid` + `aria-invalid`.** `data-invalid` on `Field`, `aria-invalid` on the control. For disabled: `data-disabled` on `Field`, `disabled` on the control.

### Component Structure → [composition.md](./rules/composition.md)

- **Items always inside their Group.** `SelectItem` → `SelectGroup`. `DropdownMenuItem` → `DropdownMenuGroup`. `CommandItem` → `CommandGroup`.
- **Base UI uses `render` for custom triggers (not `asChild`).** → [base-vs-radix.md](./rules/base-vs-radix.md)
- **Dialog, Sheet, and Drawer always need a Title.** `DialogTitle`, `SheetTitle`, `DrawerTitle` required for accessibility. Use `className="sr-only"` if visually hidden.
- **Use full Card composition.** `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`. Don't dump everything in `CardContent`.
- **Button has no `isPending`/`isLoading`.** Compose with `Spinner` + `data-icon` + `disabled`.
- **`TabsTrigger` must be inside `TabsList`.** Never render triggers directly in `Tabs`.
- **`Avatar` always needs `AvatarFallback`.** For when the image fails to load.

### Use Components, Not Custom Markup → [composition.md](./rules/composition.md)

- **Use existing components before custom markup.** Check if a component exists before writing a styled `div`.
- **Callouts use `Alert`.** Don't build custom styled divs.
- **Empty states use `Empty`.** Don't build custom empty state markup.
- **Toast via `sonner`.** Use `toast()` from `sonner`.
- **Use `Separator`** instead of `<hr>` or `<div className="border-t">`.
- **Use `Skeleton`** for loading placeholders. No custom `animate-pulse` divs.
- **Use `Badge`** instead of custom styled spans.

### Icons → [icons.md](./rules/icons.md)

- **Icons in `Button` use `data-icon`.** `data-icon="inline-start"` or `data-icon="inline-end"` on the icon.
- **No sizing classes on icons inside components.** Components handle icon sizing via CSS. No `size-4` or `w-4 h-4`.
- **Pass icons as objects, not string keys.** `icon={CheckIcon}`, not a string lookup.

## Key Patterns

```tsx
// Form layout: FieldGroup + Field, not div + Label.
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">Email</FieldLabel>
    <Input id="email" />
  </Field>
</FieldGroup>

// Validation: data-invalid on Field, aria-invalid on the control.
<Field data-invalid>
  <FieldLabel>Email</FieldLabel>
  <Input aria-invalid />
  <FieldDescription>Invalid email.</FieldDescription>
</Field>

// Icons in buttons: data-icon, no sizing classes.
<Button>
  <SearchIcon data-icon="inline-start" />
  Search
</Button>

// Spacing: gap-*, not space-y-*.
<div className="flex flex-col gap-4">  // correct
<div className="space-y-4">           // wrong

// Equal dimensions: size-*, not w-* h-*.
<Avatar className="size-10">   // correct
<Avatar className="w-10 h-10"> // wrong

// Status colors: Badge variants or semantic tokens, not raw colors.
<Badge variant="secondary">+20.1%</Badge>    // correct
<span className="text-emerald-600">+20.1%</span> // wrong
```

## Component Selection

| Need                       | Use                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| Button/action              | `Button` with appropriate variant                                                                   |
| Form inputs                | `Input`, `Select`, `Combobox`, `Switch`, `Checkbox`, `RadioGroup`, `Textarea`, `InputOTP`, `Slider` |
| Toggle between 2–5 options | `ToggleGroup` + `ToggleGroupItem`                                                                   |
| Data display               | `Table`, `Card`, `Badge`, `Avatar`                                                                  |
| Navigation                 | `Sidebar`, `NavigationMenu`, `Breadcrumb`, `Tabs`, `Pagination`                                     |
| Overlays                   | `Dialog` (modal), `Sheet` (side panel), `Drawer` (bottom sheet), `AlertDialog` (confirmation)       |
| Feedback                   | `sonner` (toast), `Alert`, `Progress`, `Skeleton`, `Spinner`                                        |
| Command palette            | `Command` inside `Dialog`                                                                           |
| Charts                     | `Chart` (wraps Recharts)                                                                            |
| Layout                     | `Card`, `Separator`, `Resizable`, `ScrollArea`, `Accordion`, `Collapsible`                          |
| Empty states               | `Empty`                                                                                             |
| Menus                      | `DropdownMenu`, `ContextMenu`, `Menubar`                                                            |
| Tooltips/info              | `Tooltip`, `HoverCard`, `Popover`                                                                   |

## Workflow

1. **Discover** — shadcn MCP search/view, or `bunx shadcn@latest docs <name>`, or [ui.shadcn.com](https://ui.shadcn.com).
2. **Implement** — import from `@kdunin/component-library`; follow Base UI rules in [base-vs-radix.md](./rules/base-vs-radix.md).
3. **Style** — app global CSS imports `@kdunin/component-library/styles`; extend tokens per [customization.md](./customization.md).
4. **Icons** — match `lucide-react` (or project’s chosen icon package) to the library’s peer range.
5. **Updates** — bump `@kdunin/component-library` in the workspace `package.json`; there is no `shadcn add --diff` for this package.

## Quick reference (docs / discovery)

```bash
bunx shadcn@latest docs button dialog select
bunx shadcn@latest view @shadcn/button
bunx shadcn@latest search @shadcn -q "sidebar"
```

## Detailed References

- [rules/forms.md](./rules/forms.md) — FieldGroup, Field, InputGroup, ToggleGroup, FieldSet, validation states
- [rules/composition.md](./rules/composition.md) — Groups, overlays, Card, Tabs, Avatar, Alert, Empty, Toast, Separator, Skeleton, Badge, Button loading
- [rules/icons.md](./rules/icons.md) — data-icon, icon sizing, passing icons as objects
- [rules/styling.md](./rules/styling.md) — Semantic colors, variants, className, spacing, size, truncate, dark mode, cn(), z-index
- [rules/base-vs-radix.md](./rules/base-vs-radix.md) — `render` vs `asChild`, Select, ToggleGroup, Slider, Accordion
- [cli.md](./cli.md) — What the upstream CLI is for (this template: docs/browse only)
- [customization.md](./customization.md) — Theming, CSS variables, extending components
- [mcp.md](./mcp.md) — shadcn MCP tools and how they map to this repo
