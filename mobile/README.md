# GPCN Stock — mobile app

An Expo (React Native) client for the stock system, talking to the Next.js
server **on the local network**. First version covers stock lookup and stock
entry; everything else stays on the website.

## How it talks to the server

- `POST /api/auth/login` returns a JWT; the app keeps it in `expo-secure-store`
  and sends it as `Authorization: Bearer …` on every request.
- `GET /api/auth/me` validates that token at launch.
- `GET /api/stock?search=&page=&pageSize=` — the ledger, searched and paged on
  the server.
- `GET /api/stock/options` — the dropdown data (items, groups, departments,
  registers, locations), the same loader the web form uses.
- `POST /api/stock` — a new entry. The server validates and recomputes the
  ledger, so the app only collects fields and shows what comes back.

`src/api.ts` mirrors the web app's `apiRequest` contract: it never throws and
always resolves to `{ success, message, status, data }`. It also times out
after 12s, because a LAN server that is asleep otherwise hangs the UI.

## Running it

The server and the phone must be on the **same Wi-Fi**.

1. Start the stock server on the PC (`npm run dev` in the project root). It
   listens on every interface already — note the PC's LAN address, e.g.
   `http://192.168.0.138:3001`.
2. Allow the port through Windows Firewall **once**, in an Administrator
   PowerShell:
   ```powershell
   New-NetFirewallRule -DisplayName "Stock app (LAN) 3001" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Private
   ```
3. Check it from the phone's browser: open that address. If the login page
   appears, the app will work too.
4. Start the app:
   ```bash
   cd mobile
   npm install      # first time only
   npx expo start
   ```
   Scan the QR code with **Expo Go** (Android or iOS).
5. On the login screen, set **Server** to the PC's address and sign in with the
   same username and password as the website. The address is saved.

### The server address changes

It is a DHCP address, so it moves. Either give the PC a static/reserved IP on
the router, or re-enter the address on the login screen when it changes — that
field is on the login screen for exactly this reason.

## Building an installable app

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview   # APK to sideload
```

iOS needs an Apple Developer account to install outside Expo Go.

Plain HTTP to a LAN address is allowed deliberately: `android.usesCleartextTraffic`
and iOS `NSAllowsLocalNetworking` in `app.json`. If the server ever moves to
HTTPS, both can go.

## Not in this version

- **Photos / attachments.** `/api/attachment` is tied to committees and events,
  not stock entries; adding bill photos means a stock attachment endpoint first.
- **Barcode scanning.** Nothing to scan yet — all 151 items have an empty
  `item_code`. Fill those in and a scanner becomes worth building.
- **Indents, reports, masters.** Website only, for now.
