# Agent Guide — Base Defense Tycoon Memory System

> **EVERY agent MUST read this file before starting ANY task.**
> This is the single source of truth for how to interact with project memory.

---

## 1. Quick Start (Do This First)

```
1. Read this file (AGENT_GUIDE.md)
2. Read .memory/PROJECT_STATE.md        → understand current phase & priorities
3. Read .memory/ARCHITECTURE.md         → understand file map & dependencies
4. Check .memory/locks/active.md        → see if anyone is working on your target files
5. Read relevant changelog file(s)      → understand recent changes to files you'll touch
6. Do your work
7. Update memory (see Section 5)
```

---

## 2. Folder Map

```
.memory/
├── AGENT_GUIDE.md            ← YOU ARE HERE (read-only reference)
├── PROJECT_STATE.md          ← Current phase, what's done, what's next
├── ARCHITECTURE.md           ← Living map: every file, its exports, dependencies
├── sessions/
│   ├── active/               ← Last 20 session logs (recent work history)
│   └── archive/              ← Older sessions (condensed, rarely needed)
├── changelog/
│   ├── entities.md           ← Function-level changes to src/entities/*
│   ├── systems.md            ← Function-level changes to src/systems/*
│   ├── config.md             ← Changes to src/config/*
│   ├── core.md               ← Changes to src/core/*
│   ├── ui.md                 ← Changes to src/ui/*
│   ├── state.md              ← Changes to src/state/*
│   └── utils.md              ← Changes to src/utils/*
├── errors/
│   └── (error logs per session)
└── locks/
    └── active.md             ← Soft lock warnings (who's touching what)
```

---

## 3. File Purposes & When to Read What

| You need to...                        | Read this                          |
|---------------------------------------|------------------------------------|
| Understand the project's current state | `PROJECT_STATE.md`                |
| Find what a file exports or imports    | `ARCHITECTURE.md`                 |
| See recent changes to a system/entity  | `changelog/<module>.md`           |
| Understand why something was built     | `sessions/active/` (recent logs)  |
| Debug a recurring error                | `errors/` directory               |
| Check if someone else is editing a file| `locks/active.md`                 |

---

## 4. Soft Lock Protocol

Before you start modifying files, register your intent. After you finish, release it.

### Registering (append to `locks/active.md`):

```markdown
## [AGENT_NAME] — [TIMESTAMP_ISO]
- Files: `src/systems/CombatSystem.js`, `src/entities/Turret.js`
- Task: Adding turret upgrade tiers
- Status: IN_PROGRESS
```

### Releasing (update your entry):

Change `Status: IN_PROGRESS` → `Status: DONE` and add a completion timestamp.

### Reading locks:

If you see a file you need is `IN_PROGRESS` by another agent from **less than 10 minutes ago**, treat it as a soft warning. Mention it in your session log. If the lock is older than **30 minutes**, assume the agent crashed — proceed but note the stale lock.

---

## 5. What to Update After EVERY Session (Success or Fail)

You must update memory after every session. Here is exactly what to update and how.

### 5a. Session Log (ALWAYS — success or fail)

Create a new file in `sessions/active/` named:

```
S[NNN]-[YYYYMMDD]-[HHMMSS]-[agent_name].md
```

Example: `S014-20250610-143022-claude_code.md`

Use the NNN sequence number by incrementing the highest existing session number.

**Template:**

```markdown
# Session S[NNN] — [AGENT_NAME]
- **Date**: [YYYY-MM-DD HH:MM:SS]
- **Duration**: ~[X] minutes
- **Task**: [One-line description of what was assigned]
- **Result**: SUCCESS | PARTIAL | FAILED

## Summary
[2-4 sentences: what you did, key decisions made, anything surprising]

## Changes Made
- `src/systems/CombatSystem.js`
  - Modified `updateTurretFiring()`: added damage falloff calculation based on distance
  - Added `calculateFalloff(distance, maxRange)`: returns 0-1 multiplier
- `src/config/gameConfig.js`
  - Added `turret.damageFalloff: { start: 0.5, end: 1.0, minMultiplier: 0.3 }`

## Files Touched
- [x] `src/systems/CombatSystem.js` — modified
- [x] `src/config/gameConfig.js` — modified
- [ ] `src/entities/Turret.js` — read only (no changes)

## Decisions & Reasoning
- [Why you chose approach X over Y. This is critical for future agents.]

## Known Issues / Warnings
- [Anything incomplete, fragile, or that needs follow-up]

## Next Steps (Suggested)
- [What logically comes next, for the human to assign]
```

### 5b. Changelog Entry (if you MODIFIED code)

Append to the relevant `changelog/<module>.md` file.

**Template (append per file changed):**

```markdown
### [YYYY-MM-DD HH:MM] — [AGENT_NAME] — Session S[NNN]
**File**: `src/systems/CombatSystem.js`
| Action   | Target                              | Detail                                          |
|----------|-------------------------------------|--------------------------------------------------|
| MODIFIED | `updateTurretFiring()`              | Added damage falloff calc using new helper        |
| ADDED    | `calculateFalloff(distance, range)` | Returns 0-1 float, used by turret + player combat |
| REMOVED  | `legacyDamageCalc()`                | Replaced by calculateFalloff                      |

**Why**: Turrets felt too strong at max range. Falloff makes positioning matter.
```

Valid actions: `ADDED`, `MODIFIED`, `REMOVED`, `RENAMED`, `MOVED`

### 5c. Architecture Update (if you ADDED or REMOVED files/exports)

Update `ARCHITECTURE.md` to reflect:
- New files and their exports
- New dependencies between modules
- Removed files or deprecated exports

### 5d. Project State Update (if phase progress changed)

Update `PROJECT_STATE.md` only if:
- A feature moved from "In Progress" to "Done"
- A new blocker or priority was discovered
- The current phase changed

### 5e. Error Log (if task FAILED or PARTIAL)

Create a file in `errors/` named: `ERR-[YYYYMMDD]-[HHMMSS]-[agent_name].md`

**Template:**

```markdown
# Error Report — [AGENT_NAME] — Session S[NNN]
- **Date**: [YYYY-MM-DD HH:MM:SS]
- **Task**: [What was being attempted]
- **Severity**: BLOCKING | DEGRADED | COSMETIC

## Error
[Error message or description of what went wrong]

## What Was Attempted
- [Step-by-step of changes you tried to make]
- `src/systems/EnemySystem.js`: tried to add `spawnTank()` but collision with existing pool

## Reasoning
[Why you made the choices you did, what you expected to happen]

## Files Modified Before Failure
- `src/systems/EnemySystem.js` — partially modified (reverted? or left dirty?)
- State: REVERTED | LEFT_DIRTY | COMMITTED_PARTIAL

## Suggested Fix
[Your best guess at what needs to happen to resolve this]
```

---

## 6. Archiving Protocol (Memory Growth Management)

To keep memory fast to load, the system uses a **hybrid rolling + summarized archive**.

### Session Archiving
- The `sessions/active/` folder should hold **at most 20 session logs**.
- When a 21st session is created, **move the 5 oldest sessions** to `sessions/archive/`.
- Before moving, append a **one-line summary** of each archived session to `sessions/archive/INDEX.md`:

```markdown
- S001 | 2025-06-01 | claude_code | Added EnemySystem spawner | SUCCESS
- S002 | 2025-06-01 | cursor | Fixed joystick drift bug | SUCCESS
- S003 | 2025-06-02 | glm_cli | Attempted wall collision — pool conflict | FAILED
```

This way, any agent can scan the archive index for relevant past sessions and only read the full file if needed.

### Changelog Compaction
- When any `changelog/<module>.md` file exceeds **150 lines**, the agent who notices should:
  1. Summarize entries older than 15 days into a `## Compacted History` block at the top.
  2. Remove the original verbose entries for those dates.
  3. Keep the last 15 days of entries in full detail.

**Compacted summary format:**

```markdown
## Compacted History (before 2025-06-01)
- `EnemySystem.js`: Added spawner logic, steering AI, aggro ranges. Refactored pool integration twice.
- `CombatSystem.js`: Built auto-fire, multi-owner turret support, projectile pooling.
```

---

## 7. Conventions

- **Timestamps**: Always ISO 8601 — `YYYY-MM-DD HH:MM:SS`
- **Agent Names**: Use consistent identifiers: `claude_code`, `cursor`, `copilot`, `glm_cli`, `claude_chat`, or your own. Stick to one name per agent across all sessions.
- **File Paths**: Always relative to project root (e.g., `src/systems/CombatSystem.js`, not absolute paths).
- **Tone**: Be terse and factual. No filler. Every sentence should carry information.
- **Golden Rule**: If you change it, log it. If you break it, report it. If you decide something, explain why.
