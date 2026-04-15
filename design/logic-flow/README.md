# Logic-Flow Documentation — Template

Every document in this directory describes **one mechanism or feature**
using a fixed, predictable structure so that:

- A non-technical reader understands the feature in 60 seconds.
- An AI agent (Claude Code, etc.) can jump straight from a request
  (*"tweak the billboard text"*) to the exact file to edit, with no
  ambiguity.
- Future features get documented the same way — no one reinvents the
  layout.

The canonical example to copy is **[`universal-stacking.md`](universal-stacking.md)**.
When in doubt, open that file and mirror its structure one-for-one.

---

## Required structure

Every file in this directory must contain **these sections, in this order**:

### 1. Title + 1-line summary
A `# Feature Name` heading followed by one sentence explaining what it
is and why it exists.

### 2. The rule (if the feature enforces a pattern)
A `> blockquote` with the single most important instruction for a
future implementer. Example:

> Never set `mesh.scale` or pick a stack offset in your own system.
> Call `inventory.addToSlot(resourceType, mesh)` — one place to tune
> every stack in the game.

Skip this section only for pure *descriptive* diagrams (like the
market-stall selling loop) that don't prescribe a coding rule.

### 3. Flow diagram (Mermaid)
A `flowchart LR` (or `TD` for vertical) diagram where every node
includes its key file paths inline. Use `<br/>` + `<code>` tags
inside node labels. Example:

```
Inventory["🎯 InventoryStack.addToSlot<br/>applies scale + offset<br/><br/><code>ecs/components/Component_InventoryStack.js</code>"]
```

Keep the diagram **small** — 3 to 6 nodes is ideal. If you need more,
you're probably documenting two features; split the file.

### 4. File map table
A two-column Markdown table: **what the file does** → **file path**.
Only list files a reader would actually open to make a change. Never
list supporting infrastructure (scene loader, main.js boot, etc.)
unless the feature specifically lives there.

### 5. How to use / reuse
A short code snippet showing the single supported way to call into
the feature. One snippet, no alternatives. If there's a tuning path
(e.g., edit a JSON), add one line pointing to it.

### 6. What NOT to do (for rule-enforcing docs)
A bulleted list of the four or five tempting shortcuts a future agent
might try. Start each with ❌ and name the wrong pattern concretely.
This section is the actual *guardrail* — it tells Claude Code what to
refuse to do even if the user asks.

---

## Skeleton (copy-paste for a new feature)

```markdown
# <Feature Name>

<One sentence: what and why.>

## The rule

> <The single most important instruction — the choke point call, the
> file to edit, the pattern to follow.>

## Flow

\`\`\`mermaid
flowchart LR
    A["🎛 Node A<br/>short role<br/><br/><code>path/to/fileA.js</code>"]
    B["🎯 Node B<br/>short role<br/><br/><code>path/to/fileB.js</code>"]
    C["🌀 Node C<br/>short role<br/><br/><code>path/to/fileC.js</code>"]

    A --> B
    B --> C
\`\`\`

## File map (only the files you'll actually edit)

| Element | File |
|---|---|
| 🎛 **Purpose A** | `path/to/fileA.js` |
| 🎯 **Purpose B** | `path/to/fileB.js` |
| 🌀 **Purpose C** | `path/to/fileC.js` |

## How to use it

\`\`\`js
// the ONE supported way to call into this feature
feature.doTheThing(args);
\`\`\`

Tuning: edit `<path/to/config>` — every instance updates.

## What NOT to do

- ❌ <Tempting shortcut #1 — name it concretely.>
- ❌ <Tempting shortcut #2.>
- ❌ <Tempting shortcut #3.>
- ❌ Write a parallel utility "just for this feature".
```

---

## Conventions

- **File paths**: always relative to repo root (start with `src/`,
  `config/`, etc.). Use backticks. Don't prefix with `./`.
- **Inline file paths in diagram nodes**: put them on their own line
  inside the node label, wrapped in `<code>…</code>`, separated from
  the role by `<br/><br/>`. This is what makes the diagram machine-
  readable for Claude Code — do not skip.
- **Emojis**: one per node is fine for wayfinding (🎛 config, 🎯
  entry point, 🌀 runtime, 📋 UI, 💰 resource, 🏪 structure). Keep
  them consistent with the market-stall and universal-stacking files.
- **Keep it under 80 lines**. If you need more, the feature is too
  big for a single logic-flow doc — break it up.
- **File name**: `<kebab-case-feature-name>.md`, e.g.
  `market-stall.md`, `universal-stacking.md`, `grid-system.md`.

---

## Existing examples

- [`universal-stacking.md`](universal-stacking.md) — rule-enforcing
  template (the one to copy for any new cross-cutting system).
- [`market-stall.md`](market-stall.md) — descriptive template (for
  features that document a gameplay loop rather than enforce a rule).
- [`gearworks-machine.md`](gearworks-machine.md), [`grid-system.md`](grid-system.md)
  — older format, kept for reference; new docs should follow the
  universal-stacking style above.

---

**AI agent note**: When asked to document a new mechanism under
`design/logic-flow/`, copy the skeleton above verbatim and fill in
the blanks. Do not invent a new structure. Do not omit the `What NOT
to do` section for any feature that defines a pattern or rule. The
goal is consistency across every doc so a reader scans them all the
same way.
