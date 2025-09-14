# GNDU Waste MVP (with API_BASE)

This project is split into:
- **Frontend (GitHub Pages)** → hosts `index.html` & `admin.html`
- **Backend (Render/Heroku)** → runs `GNDU_waste_MVP_server.js`

## Run locally
```bash
node GNDU_waste_MVP_server.js
```
Open:
- Student UI → http://localhost:3000
- Admin Panel → http://localhost:3000/admin.html
(Admin password = `admin123`)

## Deploy Backend (Render)
1. Push this repo to GitHub
2. On Render: Create new Web Service → connect repo
3. Build Command: `npm install`
4. Start Command: `node GNDU_waste_MVP_server.js`
5. Get your backend URL like: https://gndu-waste.onrender.com

## Deploy Frontend (GitHub Pages)
1. Keep `public/index.html` & `public/admin.html`
2. Enable GitHub Pages → serve from `main` branch `/public` folder
3. Your frontend URL: https://USERNAME.github.io/REPO/

## Connect
In `index.html` and `admin.html`, change:
```js
const API_BASE = "https://gndu-waste.onrender.com";
```
to your backend URL.
