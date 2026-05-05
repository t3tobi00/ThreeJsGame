# Phase 6 — Polish (LOCKED 2026-04-30)

**Status:** All 6 rounds locked. 24 decisions in §2. **V1 DESIGN IS COMPLETE** — Phases 1–6 all fully designed. Implementation can now proceed.

**Scope:** UI/HUD, sound, particles/VFX, screen shake, hitstop, juice. Final V1 design phase.

**Carried forward (visual + feel direction):**
- Aesthetic: stick-man / minimal (HT-inspired). Mechanics over fidelity. (`newGameDesign/CLAUDE.md`)
- Cute hyper-casual touches OK — squash-stretch, bouncy animations. (`newGameDesign/CLAUDE.md`)
- 3D-parented UI > HTML overlays for in-world alignment. (memory: `feedback_visual_polish`)
- Combat Feel Baseline: cheap juice layers on every hit; hitstop + screen shake reserved for finishers / big moments. (memory: `feedback_combat_feel`)

---

## §0. Master-Doc Conflicts & Additions (Phase 6 pass)

*(none yet)*

---

## §1. Open Questions

**ALL 6 ROUNDS LOCKED (2026-04-30).** No open questions remain. See §2 for the 24 locked decisions, §3 for the polish stack summary.

---

## §2. Locked Decisions

**Round 1 (foundational):**
- **L1.1** [Q1] UI rendering split = **3D-parented for in-world + HTML overlay for global HUD**. In-world (3D-parented): HP bars, hunger meters, construction progress, build-queue indicator at Flag, selection highlights, drag-path preview. Global HUD (HTML overlay): resource counters, level objective, build menu, tech access, pause, settings.
- **L1.2** [Q2] Sound philosophy = **chunky-arcade**: punchy short SFX library + light melodic BGM + satisfying combat impact sounds. Specific track count and per-action SFX list locked in Round 3.
- **L1.3** [Q3] Particle/VFX style = **cartoon-poof**: small puffs, exclamation marks, popcorn squash on entity death/spawn, dust on harvest. Specific per-event library locked in Round 4.
- **L1.4** [Q4] Juice baseline = **cheap layers everywhere + expensive juice on finishers**. Squash/stretch + color flash on every hit; hitstop + screen shake reserved for King kills, raid wipes, building destruction, level start/end. Specific timing matrix locked in Round 5.

**Round 2 (HUD layout & interaction):**
- **L2.1** [Q5] Global HUD layout = **top bar (resources + objective)** + **bottom bar (build toolbar)** + **corner buttons (settings, tech, pause)**. Top resources for at-a-glance reading; bottom toolbar for thumb reach on mobile.
- **L2.2** [Q6] In-world bar visibility = **smart**: HP shown only when damaged, hunger only when starving, build queue always shown at Flag, construction progress always shown on active build sites.
- **L2.3** [Q7] Build menu = **permanent bottom toolbar** with build icons. Tap an icon to select the tool, then tap or drag to place. Visible roster shows all unlocked options at a glance.
- **L2.4** [Q8] Camera + input target = **mobile-first hybrid**. Mobile: pinch-zoom + two-finger pan + drag-to-waypoint (per Phase 4 input lock). Desktop fallback: wheel = zoom, right-drag = pan, left-drag = waypoint. Reuse the project's existing pinch/pan implementation from recent commits.

**Round 3 (sound library):**
- **L3.1** [Q9 + user mod 2026-04-29] SFX library = **expanded tight (~35 sounds)** with **per-soldier-class combat sounds**. Breakdown:
  - **Workers (5 distinct harvest sounds, one per class — naturally different verbs):** Wood Worker chop, Stone Worker pick, Farmer pluck, Essence Collector pickup chime, Builder hammer. Plus shared step + deposit-at-silo.
  - **Soldiers (per pentagon class, per combat action):** 5 attack sounds (Scout slash, Slinger sling-whoosh, Sharpshooter bow-twang, Bruiser heavy-thud, Biker charge-rev) + 5 hit-impact sounds (one per class' weapon striking flesh). Plus shared soldier death, footstep.
  - **Zombies:** wander groan, attack growl, death moan, wall-hammer thud.
  - **Buildings:** build-complete chime, destroyed crash, ghost-place click.
  - **UI:** tap, error, achievement, build-place confirm.
  - **Alerts (3-tier per L3.4):** critical chime, warning horn, info ping.
  - **King:** loss-state voice/groan.
- **L3.2** [Q10] BGM = **single ambient looping track (~60s)** + **raid intensifier overlay** that fades in during raids and big moments.
- **L3.3** [Q11] Spatial audio = **hybrid**. UI sounds 2D (fixed volume); world sounds 3D positional (attenuate by distance from camera focus).
- **L3.4** [Q12] Alert priority = **3-tier**: critical (King HP < 30% / King death imminent) = piercing chime; warning (raid incoming / base wall breach) = mid-priority horn; info (build complete / low resource / harvest done) = quiet ping.

**Round 4 (particle / VFX library):**
- **L4.1** [Q13] VFX granularity = **per-class where it adds clarity** + shared generics. Per-class: 5 soldier projectile trails (Slinger stone arc, Sharpshooter bolt streak, Sharpshooter quill puff, Biker dust trail, Bruiser knockback ring), 5 worker harvest particles (wood chips, stone shards, apple bounce, essence sparkle, hammer dust). Shared: puff, dust, glow, fade.
- **L4.2** [Q14] Combat hit particle color = **severity-coded** (correlates with L1.4 juice tier). White puff = light/standard hit; yellow puff = mid (counter bonus, big damage); red puff = finisher (fires alongside hitstop + screen shake).
- **L4.3** [Q15] Resource-carry feedback = **floating 3D icon parented over the worker's head** showing what they're carrying (wood log / stone chunk / apple / essence orb). Reuses existing carry-stack pattern from the project.
- **L4.4** [Q16] State emote indicators = **selective**: exclamation mark over zombie-aggroed entities, sweat-drop over fleeing workers, heart particle over units healing in Apple Silo aura, "..." over starving units, outline glow on selected units.

**Round 5 (juice timing matrix):**
- **L5.1** [Q17] Cheap-layer timing (per-hit juice, fires on every combat hit / harvest / deposit) = **squash 120ms / color flash 100ms / hit puff 300ms**. ~7-frame squash at 60 FPS — fast enough not to interrupt combat at L3.
- **L5.2** [Q18] Finisher juice values:
  - **Tier 2** (unit death, wall hammer-break, raid party arriving at base) = **shake 3px / 150ms, no hitstop**. Shake-only keeps flow during constant L3 raids.
  - **Tier 3** (King kill, rival King kill = level win, level start, level end, raid wipe, building destruction) = **hitstop 100ms + shake 6px / 250ms** + red hit puff per L4.2.
- **L5.3** [Q19] Event-tier mapping = 3-tier framework. T1 cheap-only on every soldier hit / harvest swing / deposit / footstep; T2 shake-only finisher on unit death / wall break / raid arrival; T3 full finisher on King kill / rival King kill / level start-end / raid wipe / building destruction.
- **L5.4** [Q20] Easing curves = **standard set per motion type**: UI = easeOutBack (snappy with overshoot); camera follow = easeOutQuad (smooth); squash/stretch = easeOutElastic (bouncy); drag-to-waypoint path = linear (raw direction).

**Round 6 (end-state polish):**
- **L6.1** [Q21] Level start = **fade-in + 1.5s objective readout overlay** (e.g., "Level 1 · kill 2 rival Kings · 2 zombie spawns") → control hands to player. No cinematic flythrough.
- **L6.2** [Q22] Level win (all rival Kings dead per `PHASE_5_AI.md` L2.4) = **"Victory!" overlay with stats** (rival Kings killed / zombies killed / time / peak resources) + continue button.
- **L6.3** [Q23] Level loss (player King dies) = **T3 hitstop fires per L5.2** → **slow fade** → **"Defeated" screen** with retry / menu options. The hitstop already gives the death weight; fade is the natural follow-through.
- **L6.4** [Q24] Ambient scene polish = **subtle, cosmetic-only**:
  - **Sky color drift** — dawn-tinted at level start, daytime mid-level (visual only, no gameplay effect; respects the V2 day/night deferral).
  - **Idle entity micro-animations** — workers stretch when idle, soldiers look around when not in combat, King occasional weight shift.
  - **Occasional dust motes** in the 3D world for atmospheric depth.

---

## §3. Summary

24 locked decisions across 6 rounds. **Polish stack at a glance:**

- **UI** (L1.1, L2.1–L2.4): 3D-parented in-world bars (smart visibility) + HTML overlay HUD (top resources + objective; bottom build toolbar; corner settings/tech/pause). Mobile-first hybrid input — pinch-zoom + two-finger pan + drag-to-waypoint, with desktop fallback.
- **Sound** (L1.2, L3.1–L3.4): ~35 SFX library with **per-soldier-class combat sounds** (5 attacks + 5 hit-impacts), per-worker harvest sounds, shared zombie/UI/building/alert sets. Single ambient BGM (~60s loop) + raid intensifier overlay. Hybrid 2D/3D spatial mix. 3-tier alert priority (critical / warning / info).
- **VFX** (L1.3, L4.1–L4.4): Cartoon-poof style. Per-class projectile trails + per-worker harvest particles; shared generics for puff/dust/glow. Severity-coded combat hit colors (white = light, yellow = mid, red = finisher). Floating 3D resource icon over carrying workers. Selective state emotes (aggro `!`, flee sweat-drop, heal heart, hunger `...`, selection outline).
- **Juice** (L1.4, L5.1–L5.4): Cheap layers per hit (squash 120ms / flash 100ms / puff 300ms). 3-tier finisher juice — T1 cheap-only, T2 shake 3px/150ms, T3 hitstop 100ms + shake 6px/250ms. Easing per motion type (UI easeOutBack / camera easeOutQuad / squash easeOutElastic / waypoint linear).
- **Ceremonies** (L6.1–L6.4): Brief level-start objective readout. Stats-screen win. Hitstop → fade loss. Cosmetic ambient (sky drift, idle anims, dust motes).

**V1 design is complete.** Implementation can now proceed across Phases 1–6 using the per-phase blueprint files.
