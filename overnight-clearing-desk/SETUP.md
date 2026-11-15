# Setup: your own Firebase + GitHub Pages

About 15 minutes, all free. You need a Google account and a GitHub account.

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> → **Create a project**.
   Name it anything (e.g. `overnight-clearing-desk`). Google Analytics is not needed; turn it off.
2. In the left menu: **Build → Realtime Database → Create database**.
   - Location: United States (us-central1) is fine.
   - Security rules: choose **Start in locked mode**. You'll replace the rules in the next step.
3. Open the **Rules** tab of the Realtime Database, delete everything there, paste the contents of
   [`database.rules.json`](database.rules.json), and click **Publish**.

   These rules let pages read and write only inside `sessions/<6-character code>/`.
   This is the step that was missing on the original site, so every write was rejected
   with `PERMISSION_DENIED`.

## 2. Connect the pages to your project

1. Click the gear icon → **Project settings → General**, scroll to **Your apps**, and click the
   **Web** icon (`</>`). Register an app with any nickname. You don't need Firebase Hosting.
2. Firebase shows a `firebaseConfig = { ... }` object. Copy it into
   [`overnight-config.js`](overnight-config.js), replacing the placeholder values.
   **Check that `databaseURL` is there.** It only appears if the Realtime Database already exists
   (step 1.2). If you created the database in Europe or Asia, the URL ends in `firebasedatabase.app`;
   that's fine.

`overnight-config.js` is the only file you have to edit. (The web API key is not a secret; the
database rules are what protect the data.)

## 3. Put it online (GitHub Pages)

1. On GitHub, create a **new public repository**, e.g. `overnight-clearing-desk`.
2. Upload every file in this folder (drag and drop on the repo page → **Commit changes**).
3. **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)` → Save.**
4. After a minute the site is live at `https://<your-username>.github.io/overnight-clearing-desk/`
   (it opens the instructor screen).

> Using a fork of `JakeVestal/peachyhabanero` instead? Copy these files into its `site/` folder,
> replacing `overnight-clearing.html` and `bank.html`. Delete the fork's `CNAME` file first,
> because it claims `peachyhabanero.com`, which belongs to the original. A standalone repo is simpler.

To try it on your own computer first: in this folder run `python3 -m http.server 8000` and open
<http://localhost:8000/overnight-clearing.html>. The pages use JavaScript modules, so opening the
file directly (`file://`) won't work.

## 4. Running a class

1. Open the instructor screen and project it. A session is created automatically; its code shows in
   the status bar and in the address bar (`?session=ABC123`).
2. Type a bank name → **+ Add Bank** for each team. Click **Student links** and send each team
   *only its own* link (LMS, chat, email). Don't project the links: anyone with a link can trade
   for that bank.
3. **Morning shock**: apply a Market Card, **Randomize liquidity shocks**, or shock single banks.
   Per-bank and random shocks are only shown to the bank they hit.
4. **Trading**: teams post bids (borrow cash, pledging Treasuries) and offers (lend cash) on their
   phones or laptops. Pending orders appear right away on the projected balance sheets and in the
   order book. Crossing orders trade instantly at the resting order's rate, and both banks' balance
   sheets update live.
5. **Close market & print SOFR**: unfilled orders expire, SOFR prints as the volume-weighted median
   of private trades, leftover shortfalls go to the Fed SRF, and surpluses earn IORB.
6. **Advance to next day**: interest accrues to equity, all overnight repos unwind, and the next
   morning starts.
7. When you're done: **Export** tab for CSV/JSON, then **End session / new game**, which closes every
   student page.

Reloading the instructor screen reconnects to the same game. To continue on another computer, open
`overnight-clearing.html?session=ABC123` there. The instructor screen also does the order matching,
so keep one instructor tab open while students trade. If it closes, students see "instructor
offline", can still post orders, and the orders match as soon as the screen is back.

## Troubleshooting

| What you see | Fix |
|---|---|
| Red banner: `PERMISSION_DENIED` | The rules weren't published. Redo step 1.3. |
| "Firebase is not configured yet" | `overnight-config.js` still has the placeholders. Redo step 2. |
| Stuck on "Connecting to Firebase…" | `databaseURL` is wrong or missing in `overnight-config.js`, or the school network blocks `firebaseio.com` / `gstatic.com`. |
| Student page says "Bank not found" | The bank was removed or the link was cut off. Resend the link from **Student links**. |
| Student page says the session ended | You clicked **End session**. Students need new links for the new game. |

## Limits worth knowing

- There are no logins. Anyone with a session code can read that session, so a student who opens
  the browser developer tools could, in principle, place orders for another bank. That's fine for
  a classroom; don't put personal information in bank names.
- Old sessions stay in the database. To clear them, delete the `sessions` node in
  Firebase console → Realtime Database → Data. The free plan's limits are far above
  what a class uses.
