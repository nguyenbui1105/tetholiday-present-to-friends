# 🃏 Project: CHỦ SÒNG
### "Ván này tôi lo."

---

## 🎯 Objective

Build a single-page emotional web experience.

User flow:

1. Letter (intro from Chủ Sòng)
2. Name selection (choose from predefined list)
3. Scripted blackjack game (player always wins)
4. Reward screen (personal message + lucky money)
5. Form submission (bank, account number, message back)
6. End screen

This is not a gambling app.

This is symbolic.

The house loses.
The player always wins.

---

# 🧱 Architecture

- Single-page application
- Pure HTML + CSS + Vanilla JS
- No frameworks
- No routing libraries
- No build tools
- No backend except Formspree (via fetch)

All screens must be:

<section class="screen">

Only one screen has:

.screen.active

Use a single function:

showScreen(id)

to control flow.

---

# 🧠 Global State

```js
state = {
  playerKey: null,
  playerName: null,
  amount: null,
  script: null,
  claimed: false
}


👥 Name Selection
There will be a predefined list of 6 names inside data.js.
Example:
const PLAYERS = [
  { key: "an", name: "An", winType: "blackjack", message: "..." },
  { key: "binh", name: "Bình", winType: "comeback", message: "..." }
];

Rules:
Render names dynamically into buttons
On click:
Set state.playerKey
Set state.playerName
Check if claimed_ exists in localStorage
If claimed → skip to end screen
Else → go to game screen
Do NOT hardcode name buttons in HTML.

🃏 Blackjack Logic (Symbolic)
This is NOT real blackjack.
It is scripted.
Each player has:
winType
predefined card sequence
Dealer must always lose.
Allowed actions:
Hit
Stand
Outcome must always result in player win.
Do not calculate full blackjack logic.
Use predefined sequences only.

💰 Lucky Money Logic
Lucky money pool:
[68000, 99000, 128000, 188000, 159000, 88888]
Rules:
Generate only once per playerKey
Use key: amount_
Store in localStorage
If reload → reuse same amount
If amount exists → do not regenerate

🔐 Claim Protection
Use key:
claimed_
If claimed is true:
Skip reward generation
Skip form
Show end screen directly
User must not claim twice.

📩 Form Submission
Use Formspree with fetch().
Requirements:
No redirect
No page reload
After success → show end screen
Set claimed flag true in localStorage
Hidden fields must include:
playerName
luckyMoneyAmount
Form fields:
Bank
Account number
Message back to Chủ Sòng

🎨 Design Direction
Tone:
Dark background
Deep red accent
Gold highlight
Centered card layout
Smooth fade transitions
Minimal animation
No flashy casino style
Energy = calm confidence.
Chủ Sòng is playful but controlled.

🚫 Do NOT
Add React / Vue / frameworks
Add routing libraries
Add backend server
Over-engineer blackjack
Add unnecessary animations
Add authentication
Keep it minimal.
Keep it symbolic.

🧪 Development Strategy
Work in small patches.
For each feature:
Implement one feature only
Test in browser
Confirm flow works
Commit
Do not refactor everything at once.

🔁 Verification Checklist
Before considering complete:
Letter screen loads first
Name selection renders correctly
Selecting name moves to game
Blackjack always results in win
Lucky money random but fixed per player
Form submits without redirect
Claim cannot repeat
End screen displays correctly

🎭 Emotional Core
This project represents presence.
Chủ Sòng does not take money.
Chủ Sòng gives.
Everyone wins.
No one leaves empty-handed.
Playful.
Confident.
Intentional.
Not loud.
Not dramatic.
Just present.

