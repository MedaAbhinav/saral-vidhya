# 🔥 Firebase Deployment Guide — Ekam MVP Frontend

This guide will walk you through deploying the `mvp_frontend` (React + Vite) application to **Firebase Hosting**. Firebase Hosting provides fast, secure hosting for web apps and is entirely free for this scope.

---

## Prerequisites

1. **Node.js & npm** must be installed on your machine.
2. A **Firebase Project** must be created in the [Firebase Console](https://console.firebase.google.com/).

---

## Step 1 — Install Firebase Tools

Open your terminal (PowerShell or Command Prompt) and install the official Firebase CLI globally:

```powershell
npm install -g firebase-tools
```

---

## Step 2 — Login to Firebase

Authenticate the CLI with your Google account:

```powershell
firebase login
```
*Your browser will open. Select the Google account associated with your Firebase project and grant the required permissions.*

---

## Step 3 — Build the Application

Before deploying, you must create a production-ready build of your React frontend. Ensure you are inside the `mvp_frontend` folder:

```powershell
cd "C:\Users\nani1\Ekam Project 1\mvp_frontend"
npm run build
```

This command will:
- Copy the `generated_resources` to `public/`
- Generate standard manifests
- Compile the code using Vite and create a `dist/` directory containing all your deployable static files.

---

## Step 4 — Initialize Firebase Setup

While still inside the `mvp_frontend` directory, initialize your Firebase project configuration:

```powershell
firebase init hosting
```

You will be asked a series of questions. **Answer them exactly as follows:**

1. **Please select an option:** 
   *Select `Use an existing project` and hit Enter, then choose your Ekam project from the list.*
2. **What do you want to use as your public directory?**
   *Type `dist` and hit Enter.* (Vite outputs the build to the `dist` folder, not `public`).
3. **Configure as a single-page app (rewrite all urls to /index.html)?**
   *Type `y` (Yes) and hit Enter.* ( Crucial step! This fixes routing issues).
4. **Set up automatic builds and deploys with GitHub?**
   *Type `n` (No) and hit Enter.*
5. **File dist/index.html already exists. Overwrite?**
   *Type `n` (No) and hit Enter.* (Never overwrite your compiled `dist/index.html`).

---

## Step 5 — Deploy to the Web!

You are now ready to launch the frontend live to the internet. 

```powershell
firebase deploy --only hosting
```

Once the upload finishes, the terminal will display your **Hosting URL** (e.g., `https://your-project-id.web.app`).

---

## 🔁 Updating the App in the Future

Whenever you make code changes in the future and want to push the updates live, you only need to run two commands:

```powershell
npm run build
firebase deploy --only hosting
```

---

## Troubleshooting

1. **Pages show "404 Not Found" on refresh:**
   You likely answered "No" to the single-page app question during initialization. You can fix this by opening the `firebase.json` file in your `mvp_frontend` directory and modifying it to look like this:
   ```json
   {
     "hosting": {
       "public": "dist",
       "ignore": [
         "firebase.json",
         "**/.*",
         "**/node_modules/**"
       ],
       "rewrites": [
         {
           "source": "**",
           "destination": "/index.html"
         }
       ]
     }
   }
   ```
   Then redeploy.

2. **White/Blank Screen on load:**
   If the deployment shows a blank white page, ensure you definitely ran `npm run build` directly before running `firebase deploy`.
