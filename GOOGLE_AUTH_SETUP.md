# Talvyn – Google Sign-In & Google OAuth Setup Guide

This guide walks you through setting up **"Continue with Google"** authentication for Talvyn in under 5 minutes.

---

## 1. Which OAuth Client Type Do You Need?

> **Application Type:** **Web application**
>
> Talvyn uses **Google Identity Services (GIS)** for web browsers. You **must** choose **"Web application"** when creating credentials in Google Cloud Console.

---

## 2. Step-by-Step Google Cloud Console Setup

### Step 1: Open Google Cloud Console
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with your Google account.

### Step 2: Create or Select a Project
1. In the top navigation bar, click the project dropdown.
2. Click **"New Project"**.
3. Name your project (e.g. `Talvyn`) and click **"Create"**.
4. Select the newly created project.

### Step 3: Configure the OAuth Consent Screen
1. In the left sidebar, navigate to **APIs & Services > OAuth consent screen**.
2. Select **External** as the user type, then click **Create**.
3. Fill in the required fields:
   - **App name:** `Talvyn`
   - **User support email:** (your Google email address)
   - **Developer contact information:** (your Google email address)
4. Click **Save and Continue**.
5. **Scopes:** Click **"Add or Remove Scopes"**, select:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
6. Click **Save and Continue**.
7. **Test Users:**
   - If your app status is **Testing** (default), click **"Add Users"** and enter the Google email address(es) you will use for logging in.
8. Click **Save and Continue** until complete.

### Step 4: Create OAuth Client ID
1. In the left sidebar, click **Credentials**.
2. At the top, click **+ Create Credentials** and select **OAuth client ID**.
3. In the **Application type** dropdown, select **Web application**.
4. Set the **Name** (e.g. `Talvyn Web Client`).

### Step 5: Configure Authorized JavaScript Origins
Under **Authorized JavaScript origins**, click **+ Add URI** and add:
- `http://localhost:5173`
- `http://localhost:3001` (optional backend origin)

> **Important on Authorized Redirect URIs:**
> **Do NOT add redirect URIs for local development.**
> Talvyn uses Google Identity Services (GIS) popup/credential token flow. The ID token is returned directly to the browser client callback without a full-page server redirect. Leaving redirect URIs empty is normal and expected for this flow.

### Step 6: Copy Your Client ID
1. Click **Create**.
2. A modal will display your **Client ID** (format: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`).
3. Copy the Client ID.

---

## 3. Update Your Talvyn `.env` File

Open `.env` in the root of the project and set both variables to your Client ID:

```env
# Frontend Google OAuth (Vite public)
VITE_GOOGLE_CLIENT_ID="YOUR_COPIED_CLIENT_ID.apps.googleusercontent.com"

# Backend Google Token Verification (Must match frontend)
GOOGLE_CLIENT_ID="YOUR_COPIED_CLIENT_ID.apps.googleusercontent.com"
```

> **Why are there two variables?**
> - `VITE_GOOGLE_CLIENT_ID` is exposed to the browser by Vite so Google Identity Services can load the prompt.
> - `GOOGLE_CLIENT_ID` is used on the Express backend to cryptographically verify token signatures and ensure the token audience matches your application.
> - Both variables use the **same Client ID**.

---

## 4. Restart the Development Servers

> **CRITICAL:** Vite and Node.js only load `.env` files when the process **starts**. Changes to `.env` will not take effect until you restart the server.

1. Stop any currently running dev server by pressing:
   ```bash
   Ctrl + C
   ```
2. Restart the application:
   ```bash
   npm run dev
   ```
   *(or `npm run dev:web` and `npm run dev:server` if running in separate terminals)*

3. Open `http://localhost:5173/login` in your browser.
4. Click **"Continue with Google"** to test live sign-in!

---

## 5. Production Configuration

When deploying to production:
1. In Google Cloud Console under your OAuth Client ID, add your production domain to **Authorized JavaScript origins**:
   - `https://app.talvyn.com` (your production URL)
2. In production environment variables, update:
   - `VITE_GOOGLE_CLIENT_ID=...`
   - `GOOGLE_CLIENT_ID=...`
   - `CLIENT_URL=https://app.talvyn.com`
   - `GOOGLE_ALLOWED_ORIGIN=https://app.talvyn.com`
3. Publish your OAuth consent screen in Google Cloud Console when ready for general public users.
