# MotoGP live widgets

A tiny server that fetches MotoGP standings and the next race weekend, plus a phone-friendly page and an iPhone widget script.

**Important:** it uses the unofficial API behind motogp.com. It was written without being able to test against the live API, so field names may need small fixes. Check `https://YOUR-SERVER/api/data` first. If you see an error there, send it to me and I'll adjust `server.js`.

## 1. Run it
Requires Node 18+. `npm start`, then open http://localhost:3000. Data refreshes at most every 5 minutes. Change the favourite with the `FAV_RIDER` environment variable (default `Marquez`).

## 2. Put it online (needed for your phone)
Any free Node host works (for example Render or Railway). Create a new web service from this folder, start command `npm start`. You get an https address like `https://motogp-live.onrender.com`. Free tiers can sleep, so the first load may take about a minute.

## 3. Home screen
**iPhone, app icon:** open your address in Safari, Share, Add to Home Screen.
**iPhone, real widget:** install Scriptable (free), create a new script, paste `scriptable-widget.js`, set `SERVER`. On the home screen long-press, tap +, add Scriptable, choose Medium, tap the widget, set Script to yours. iOS refreshes widgets on its own schedule (roughly every 15+ minutes).
**Android, app icon:** open your address in Chrome, menu, Add to Home screen / Install app.
**Android, real widget:** Chrome can't make widgets. Install KWGT (free), add a KWGT widget, and add Text items using formulas like `$wg("https://YOUR-SERVER/api/fav", json, "points")$`. Other fields: `name`, `pos`, `wins`, `podiums`, `poles`, `raceName`, `raceTime`. Add `?rider=Bezzecchi` to the address to pick another rider. Untested.


`/api/fav` also returns `s0name`, `s0iso`, `s1name`, `s1iso` ... for each session of the next round (in time order), for a schedule widget.
