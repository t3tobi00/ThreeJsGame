# Market Stall — Selling Loop

How the Stall, Billboard, and Coin Tray work together, and where each
one lives in the code.

```mermaid
flowchart LR
    Billboard["📋 Billboard<br/>$3 Zombie Candy<br/><br/><code>ui/PriceSignUI.js</code><br/><code>zones/market/presets.js</code>"]
    Stall["🏪 Stall<br/>selling table<br/><br/><code>zones/market/presets.js</code><br/><code>archetypes/market-stall.json</code>"]
    Tray["💰 Coin Tray<br/><br/><code>zones/market/presets.js</code><br/><code>archetypes/market-coin-tray.json</code>"]

    Player[🧍 Player]
    Customer[👤 Customer]

    Billboard -. advertises .-> Stall
    Player -- drops candy --> Stall
    Customer -- buys candy --> Stall
    Stall -- pays coins --> Tray
    Tray -- picked up --> Player
```

**File map (only the files you'll actually edit)**

| Element | Visual / 3D shape | Data / config |
|---|---|---|
| 🏪 **Stall** | `src/zones/market/presets.js` | `src/config/archetypes/market-stall.json` |
| 📋 **Billboard** | `src/zones/market/presets.js` | `src/ui/PriceSignUI.js` *(text + font)* |
| 💰 **Coin Tray** | `src/zones/market/presets.js` | `src/config/archetypes/market-coin-tray.json` |

**In plain words:**
1. The **Billboard** shows what the **Stall** is selling.
2. The **Player** drops candy on the Stall.
3. **Customers** walk by, buy candy, and drop coins in the **Coin Tray**.
4. The **Player** collects the coins from the Tray.
