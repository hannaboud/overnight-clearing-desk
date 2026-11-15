# The Overnight Clearing Desk: SOFR & repo market classroom game

A multiplayer classroom simulation of the overnight repo market. Teams run bank treasuries on
their own phones or laptops. They post bids (borrow cash against Treasuries) and offers (lend
cash), trades clear live, and the instructor's screen prints SOFR as the volume-weighted median
of the day's trades.

**First time? Follow [SETUP.md](SETUP.md)**: create a free Firebase project, paste its config into
`overnight-config.js`, and turn on GitHub Pages.

## Files

| File | What it is |
|---|---|
| `overnight-clearing.html` | Instructor screen: banks, shocks, order book, trade tape, SOFR, P&L, cards, quiz, rules, export |
| `bank.html` | Student bank page (opened from a private link) |
| `overnight-engine.js` | Game rules: matching, repo accounting, SOFR, Fed SRF/IORB sweep, overnight accrual. No Firebase or page code, so it can be unit-tested |
| `overnight-ui.js` | Shared rendering (balance sheet, order book, tape) |
| `overnight-db.js` | Firebase wrapper: SDK version and error messages |
| `overnight-config.js` | **Your Firebase config goes here** |
| `database.rules.json` | Realtime Database rules to paste into the Firebase console |
| `overnight.css`, `style.css` | Styles |
| `tests/engine.test.mjs` | Unit tests for the engine: `node tests/engine.test.mjs` |

## How a trade moves the balance sheets

| | Borrower (bid filled) | Lender (offer filled) |
|---|---|---|
| Today | Cash ↑, Repo borrowings ↑, Treasuries marked as pledged | Cash ↓, Reverse repo ↑ |
| Overnight | Pays interest (equity ↓) | Earns interest (equity ↑) |
| Next morning | Repays cash, collateral released | Cash returned |

Every bank always satisfies Assets = Liabilities + Equity.

## Credits

Based on the Overnight Clearing Desk activity in
[JakeVestal/peachyhabanero](https://github.com/JakeVestal/peachyhabanero) (MIT License). This
version restores the full game that the original later replaced with a Firebase test build, adds
live order matching, and moves the game state into Firebase so the instructor screen and the
student pages show the same balance sheets.
