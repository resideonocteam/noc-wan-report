# Resideo NOC WAN Insight Pro

Internal WAN health reporting tool for the Resideo NOC team.
Hosted on GitHub Pages · Data stored in Firebase Firestore · Auth via static credentials.

---

## 1. Firebase Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (e.g. `resideo-noc-wan`)
3. Add a **Web app** → copy the `firebaseConfig` object
4. Open `src/firebase.js` and replace all `REPLACE_WITH_YOUR_*` values with your config
5. Go to **Firestore Database** → Create database → Start in **production mode** → choose a region
6. Go to **Firestore → Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /noc/{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ These rules allow open access. Fine for an internal team MVP — tighten when moving to Azure.

---

## 2. Credentials

Edit `src/auth.js` to set usernames and passwords for your team.
Default password for all users is `Resideo2025!` — change it before sharing.

```js
export const USERS = [
  { username: "alic.antunez", password: "YourPassword!", name: "Alic Antunez", email: "Alic.Antunez@resideo.com" },
  // add more...
];
```

---

## 3. GitHub Pages Deployment

### First time

```bash
# 1. Create a new public GitHub repo named: resideo-noc-wan
# 2. Clone it locally and copy all these project files into it

npm install
npm run build
```

This generates a `dist/` folder. Upload `dist/index.html` to your repo root via GitHub UI
(rename to `index.html` if needed) — same workflow as Mis Finanzas.

**Or use the automated GitHub Actions workflow (recommended):**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Then go to **GitHub repo → Settings → Pages → Source: Deploy from branch → gh-pages**.

Every push to `main` will auto-build and deploy. 🎉

---

## 4. Update `vite.config.js`

Make sure the `base` matches your repo name exactly:

```js
base: "/resideo-noc-wan/",
```

---

## 5. Migrating to Azure (when ready)

- Replace `src/auth.js` static auth with **Firebase Auth + Google Sign-In** (same as Mis Finanzas),
  or use **Azure AD** with MSAL.
- Replace GitHub Pages hosting with **Azure Static Web Apps**.
- Add `staticwebapp.config.json` for SPA routing and Azure AD auth provider.
- Tighten Firestore security rules to require authenticated users.

---

## Project Structure

```
resideo-noc-wan/
├── index.html
├── vite.config.js
├── package.json
├── README.md
└── src/
    ├── main.jsx        # React entry point
    ├── App.jsx         # Main dashboard (all components)
    ├── Login.jsx       # Login screen
    ├── auth.js         # Static username/password store
    └── firebase.js     # Firestore config & helpers
```
