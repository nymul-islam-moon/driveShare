# DriveShare - Google Drive File Downloader

Simple web app to download files from Google Drive. **No installation needed on Google Drive side** - just authenticate and download!

**What makes this special:**
- ✅ Auto token refresh (never expires during use)
- ✅ Secure (tokens never exposed to frontend)
- ✅ Download as ZIP or individually
- ✅ Streaming (memory efficient for large files)

---

## 📋 Table of Contents

1. [5-Minute Quick Start](#-5-minute-quick-start)
2. [How It Works (Simple Explanation)](#-how-it-works-simple-explanation)
3. [Complete Setup Guide](#-complete-setup-guide)
4. [Code Walkthrough](#-code-walkthrough)
5. [Troubleshooting](#-troubleshooting)

---

## ⚡ 5-Minute Quick Start

### What You Need
- Python 3.8+ installed
- Node.js 16+ installed
- 5 minutes of time

### Step 1: Get Google Credentials (2 min)

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project → name it `DriveShare` → Create
3. Search for `Google Drive API` → Enable it
4. Go to **APIs & Services** → **Credentials** → Create Credentials → OAuth client ID
5. Choose **Web application**
6. Add redirect URI: `http://localhost:9999/auth/callback`
7. Create → Download JSON
8. Extract from JSON:
   - `client_id` (looks like: `123456789-abc.apps.googleusercontent.com`)
   - `client_secret` (looks like: `GOCSPX-xyz`)

9. Go to **Credentials** → Create Credentials → API Key → Copy

Now you have 3 things: **Client ID**, **Client Secret**, **API Key**

### Step 2: Setup Backend (2 min)

```bash
cd backend
pip install -r requirements.txt

# Create .env file
echo 'GOOGLE_CLIENT_ID=your-client-id' > .env
echo 'GOOGLE_CLIENT_SECRET=your-client-secret' >> .env
echo 'GOOGLE_API_KEY=your-api-key' >> .env
echo 'GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token' >> .env
echo 'GOOGLE_REDIRECT_URI=http://localhost:9999/auth/callback' >> .env
echo 'SESSION_SECRET=any-random-string' >> .env

python main.py
```

Backend running at `http://localhost:9999` ✅

### Step 3: Setup Frontend (1 min)

```bash
# NEW TERMINAL
cd frontend
npm install

# Create .env file
echo 'REACT_APP_API_URL=http://localhost:9999' > .env
echo 'REACT_APP_GOOGLE_API_KEY=your-api-key' >> .env

npm start
```

Opens `http://localhost:3000` ✅

### Step 4: Use It!

1. Click **🔐 Authenticate & Open Drive**
2. Sign in with your Google account
3. Click **Allow**
4. Click **🔍 Open Google Drive** → Select files
5. Choose download format → Done! 📥

---

## 🧠 How It Works (Simple Explanation)

### The Problem We're Solving

When you access Google Drive API:
- You need **2 tokens**:
  1. **Access Token** (short-lived, 1 hour) - used for API calls
  2. **Refresh Token** (long-lived, 6 months) - renews the access token

Without handling this, your app would say "Access token expired" after 1 hour, forcing user to re-login.

### The Solution (What DriveShare Does)

```
┌─────────────────────────────────────────────────────────┐
│ User logs in                                            │
│ ↓                                                       │
│ Backend gets: Access Token + Refresh Token              │
│ ↓                                                       │
│ Stores both in secure session (HTTP-only cookie)        │
│ ↓                                                       │
│ When accessing Google Drive API:                        │
│   - Check: Is access token about to expire? (< 10 min) │
│   - YES: Use refresh token to get NEW access token     │
│   - NO: Use current access token                        │
│ ↓                                                       │
│ User never sees "token expired" error ✅               │
└─────────────────────────────────────────────────────────┘
```

### Why Backend Handles OAuth (Not Frontend)

**❌ Frontend storing tokens = UNSAFE**
```javascript
// DANGEROUS! Anyone can inspect this in browser
localStorage.setItem('token', clientSecret);
```

**✅ Backend storing tokens = SAFE**
```python
# Backend only. Frontend can't see it.
request.session["token"] = {
    "access_token": "...",
    "client_secret": "..."
}
```

Frontend just says "Backend, give me files" → Backend handles tokens securely.

### Data Flow

```
User Browser (http://localhost:3000)
    ↓ (frontend React)
    ├─ Click "Authenticate" → Backend handles OAuth
    │
    ├─ Click "Open Google Drive" → Backend opens Picker
    │
    └─ Click "Download" → Backend:
       ├─ Auto-refresh token if expiring
       ├─ Download from Google Drive API
       └─ Stream to user
```

---

## 📖 Complete Setup Guide

### Prerequisites

Check you have required versions:

```bash
python --version    # Need: 3.8 or higher
node --version      # Need: 16 or higher
npm --version       # Comes with Node
```

If not installed:
- **Python**: [python.org](https://www.python.org/downloads/)
- **Node.js**: [nodejs.org](https://nodejs.org/)

### Google Cloud Console - Detailed Steps

#### Step 1: Create Project

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Look for dropdown at top left that says "Select a Project"
3. Click it → **NEW PROJECT**
4. Name: `DriveShare`
5. Click **CREATE** and wait 1-2 minutes

#### Step 2: Enable Google Drive API

1. In search bar (top), type `Google Drive API`
2. Click the result
3. Click **ENABLE** (blue button)
4. Wait for "API enabled" message

#### Step 3: Create OAuth App Verification

1. Left sidebar → **APIs & Services** → **OAuth consent screen**
2. Select **External** → **CREATE**
3. Fill form:
   - **App name**: DriveShare
   - **User support email**: nymul.moon@gigalogy.com
   - **Developer contact**: nymul.moon@gigalogy.com
4. Click **SAVE AND CONTINUE**
5. **Scopes page**: Click **ADD OR REMOVE SCOPES**
   - Search: `drive`
   - Check: **Google Drive API**
   - Click **UPDATE**
6. Click **SAVE AND CONTINUE** → **SAVE AND CONTINUE** → **BACK TO DASHBOARD**

#### Step 4: Create OAuth Credentials

1. Left sidebar → **Credentials**
2. **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Choose: **Web application**
4. Fill:
   - **Name**: DriveShare Web Client
   - **Authorized JavaScript origins**:
     ```
     http://localhost:9999
     http://localhost:3000
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost:9999/auth/callback
     ```
5. Click **CREATE**
6. Popup shows credentials:
   - **Client ID**: Copy this
   - **Client Secret**: Copy this
7. Click **DOWNLOAD** to save JSON file
8. Click **OK**

#### Step 5: Create API Key

1. Still in **Credentials**
2. **+ CREATE CREDENTIALS** → **API Key**
3. Copy the API Key
4. Click close

**You now have:**
- Client ID
- Client Secret  
- API Key

### Project Setup - Step by Step

#### Backend Setup

```bash
# 1. Navigate to backend folder
cd backend

# 2. Install Python packages
pip install -r requirements.txt

# 3. Create .env file with your Google credentials
cat > .env << 'EOF'
GOOGLE_CLIENT_ID=paste-your-client-id-here
GOOGLE_CLIENT_SECRET=paste-your-client-secret-here
GOOGLE_API_KEY=paste-your-api-key-here
GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token
GOOGLE_REDIRECT_URI=http://localhost:9999/auth/callback
SESSION_SECRET=my-super-secret-session-key
EOF
```

Replace:
- `paste-your-client-id-here` → Your Client ID from Google
- `paste-your-client-secret-here` → Your Client Secret from Google
- `paste-your-api-key-here` → Your API Key from Google
- `my-super-secret-session-key` → Any random string (for production, use strong random)

Run backend:

```bash
python main.py
```

You should see:
```
Uvicorn running on http://127.0.0.1:9999
```

✅ Backend running!

#### Frontend Setup

**Open a NEW terminal window** and run:

```bash
# 1. Navigate to frontend folder
cd frontend

# 2. Install npm packages
npm install

# 3. Create .env file
cat > .env << 'EOF'
REACT_APP_API_URL=http://localhost:9999
REACT_APP_GOOGLE_API_KEY=paste-your-api-key-here
EOF
```

Replace `paste-your-api-key-here` with your API Key.

Run frontend:

```bash
npm start
```

Browser opens to `http://localhost:3000` automatically ✅

### First Time Use

1. Visit `http://localhost:3000`
2. Click **🔐 Authenticate & Open Drive**
3. Sign in with your Google account
4. Accept permissions
5. Click **🔍 Open Google Drive**
6. Select files you want to download
7. Choose:
   - **As ZIP** - All files in one archive
   - **Individually** - Download one by one
8. Files download to your computer! 🎉

---

## 🔧 Code Walkthrough

### How Backend Works (main.py)

#### What Happens on Login

```
1. User clicks "Authenticate"
   ↓
2. Frontend calls: GET /auth/login
   ↓
3. Backend sends user to Google:
   "Hey Google, this person wants access to their Drive"
   ↓
4. Google shows login page
   ↓
5. User signs in and clicks "Allow"
   ↓
6. Google sends user back with a CODE
   ↓
7. Backend gets CODE at /auth/callback
   ↓
8. Backend trades CODE for:
   - Access Token (1 hour validity)
   - Refresh Token (6 months validity)
   ↓
9. Backend stores both in session (secure cookie)
   ↓
10. User is logged in! ✅
```

#### What Happens During Download

```
1. User selects files and clicks Download
   ↓
2. Frontend sends request to backend
   ↓
3. Backend calls: creds_from_session()
   ↓
4. This function checks:
   - Do we have a refresh token? NO → User must re-login
   - Is access token expiring soon (< 10 min)? YES → Refresh it now
   - ✅ We have a valid access token
   ↓
5. Backend downloads file from Google Drive API
   ↓
6. Backend streams file to user's browser
   ↓
7. User's browser downloads file ✅
```

#### Key Functions Explained

**`creds_from_session(token_data, request)`** (Line 55)

This is the most important function. It ensures you always have a valid access token.

```python
def creds_from_session(token_data, request=None):
    # Step 1: Do we have a refresh token?
    if not refresh_token:
        return None  # Nope, user must login again
    
    # Step 2: Is access token about to expire? (less than 10 min left)
    if token_expiring_soon(token_data):
        access_token = None  # Pretend we don't have it
    
    # Step 3: No access token? Use refresh token to get new one
    if not access_token:
        creds = Credentials(refresh_token=refresh_token, ...)
        creds.refresh(GoogleRequest())  # Call Google: "Give me new token"
        # Google returns new access token
        request.session["token"] = new_token  # Save in session
        return creds
    
    # Step 4: We have valid access token, use it
    return creds
```

**Why this matters**: This one function prevents "token expired" errors.

#### API Endpoints Overview

| What Happens | Endpoint | What Code Does |
|--------------|----------|---|
| User clicks Authenticate | `/auth/login` | Redirects to Google login |
| Google sends code back | `/auth/callback` | Exchanges code for tokens, stores in session |
| User clicks Logout | `/auth/logout` | Deletes tokens from session |
| Check if logged in | `/api/auth-status` | Returns true/false |
| Open file picker | `/api/picker` | Shows file selection dialog |
| Download one file | `/api/download-single` | Streams single file |
| Download multiple | `/api/download-bulk` | Creates ZIP, streams it |
| Get token info | `/api/token-info` | Shows token status/expiry |

### How Frontend Works (React)

#### Main Component States

```javascript
// Is user logged in?
const [isAuthenticated, setIsAuthenticated] = useState(false);

// Files user selected
const [selectedFiles, setSelectedFiles] = useState([]);

// Show loading spinner?
const [loading, setLoading] = useState(false);

// Show download options modal?
const [showModal, setShowModal] = useState(false);
```

#### Key Functions

**`checkAuthStatus()`** - Called when app loads
```javascript
// Ask backend: "Is this user logged in?"
fetch('/api/auth-status')
  .then(response => response.json())
  .then(data => setIsAuthenticated(data.authenticated))
```

**`handleAuthenticateAndOpen()`** - When user clicks "Authenticate"
```javascript
// Redirect to backend login endpoint
window.location.href = 'http://localhost:9999/auth/login'
```

**`handleOpenPicker()`** - When user clicks "Open Google Drive"
```javascript
// Ask backend to show file picker
window.location.href = 'http://localhost:9999/api/picker'
```

**`handleDownloadFiles(format)`** - When user clicks download
```javascript
fetch('http://localhost:9999/api/download-single', {
  method: 'POST',
  body: JSON.stringify({ file_ids: [...] })
})
// Browser receives file and starts download
```

**`handleLogout()`** - When user clicks logout
```javascript
fetch('http://localhost:9999/auth/logout')
  .then(() => {
    setIsAuthenticated(false)
    window.location.href = '/'  // Go to home page
  })
```

#### How Pages Work

**Home Page (App.js)**
- Shows "Authenticate" button if NOT logged in
- Shows "Open Google Drive" button if logged in
- Shows "View Token Info" link if logged in
- Shows "Logout" button if logged in

**Token Info Page (TokenInfo.js)**
- Shows if you're authenticated
- Shows access token status
- Shows refresh token status
- Shows how much time left before expiry (live countdown)

---

## 🐛 Troubleshooting

### Problem: "Not authenticated" error

**What it means**: Backend doesn't have your tokens

**How to fix**:
1. Click **🔐 Authenticate & Open Drive**
2. Sign in again
3. Make sure you click **Allow** in Google popup

---

### Problem: Picker won't open

**What it means**: Backend can't authenticate with Google

**How to check**:
1. Are both terminals running? (backend + frontend)
2. Is `backend/.env` filled correctly?
3. Try visiting `http://localhost:9999/docs` - if page shows, backend is running ✅

**How to fix**:
```bash
# Kill backend (Ctrl+C)
# Edit backend/.env - make sure all fields filled
python main.py  # Restart
```

---

### Problem: Can't download Google Docs

**What it means**: Google Docs files can't download in original format

**How to fix**:
- Download as PDF/Word from Google Docs directly
- Or select other file types (PDFs, images, etc.)

---

### Problem: "CORS error" in browser console

**What it means**: Frontend can't talk to backend

**How to fix**:
1. Make sure backend running on `http://localhost:9999`
2. Check `frontend/.env` has correct URL:
   ```
   REACT_APP_API_URL=http://localhost:9999
   ```
3. Restart frontend: `npm start`

---

### Problem: Download fails halfway

**What it means**: File too large or network issue

**How to fix**:
1. Check internet connection
2. Try downloading a smaller file first
3. Check `backend/app.log` for error messages

---

### Problem: "Invalid Client ID" error

**What it means**: Credentials are wrong

**How to fix**:
1. Go back to Google Cloud Console
2. Copy Client ID and Secret again - carefully!
3. Update `backend/.env`
4. Restart backend

---

## 📂 File Structure Explained

```
driveShare/
│
├── backend/                    # Python FastAPI server (port 9999)
│   ├── main.py                # Everything is in this one file!
│   ├── requirements.txt        # Python packages needed
│   ├── .env                   # Your Google credentials (NOT in git)
│   └── app.log                # Debug log file
│
├── frontend/                   # React web app (port 3000)
│   ├── public/
│   │   └── index.html         # HTML page
│   ├── src/
│   │   ├── App.js             # Main component (login, download, logout)
│   │   ├── App.css            # Styling
│   │   ├── components/
│   │   │   └── DownloadModal.js    # File selection popup
│   │   └── pages/
│   │       └── TokenInfo.js        # Show token status page
│   ├── .env                   # Frontend config (NOT in git)
│   └── package.json           # NPM packages needed
│
├── CLAUDE.md                   # Notes for Claude AI
├── README.md                   # This file
└── .gitignore                  # Files to ignore (don't commit)
```

---

## 🔒 Security Explained

### Why This Is Secure

✅ **Client secret never exposed**
- Only backend knows it
- Never sent to frontend

✅ **Tokens in HTTP-only cookies**
- JavaScript can't read them
- Hackers can't steal with XSS attacks

✅ **Tokens automatically refresh**
- Old token never used past expiry
- Refresh token stays safe

### What's NOT Production-Ready Yet

⚠️ **HTTP (not HTTPS)**
- Works on localhost
- Must add HTTPS for real users

⚠️ **Session secret is hardcoded**
- Works for development
- Must use environment variable in production

⚠️ **CORS allows localhost**
- Works for development
- Must restrict to specific domain in production

---

## 🚀 Deployment (When Ready)

When you want to deploy to real server:

1. **Get HTTPS certificate** (free from Let's Encrypt)
2. **Update Google Cloud Console**:
   - Add production domain to OAuth URIs
   - Update callback URL
3. **Update code**:
   ```python
   # Remove this line:
   os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
   
   # Use environment variables:
   SESSION_SECRET = os.environ.get("SESSION_SECRET")
   ```
4. **Deploy backend** to server (Heroku, AWS, etc.)
5. **Build frontend**: `npm run build`
6. **Deploy frontend** to server

---

## 📚 Useful Links

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Drive API Docs](https://developers.google.com/drive/api/guides/overview)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Docs](https://react.dev/)

---

## 👤 Author

**Email**: nymul.moon@gigalogy.com

---

**Version**: 2.0  
**Last Updated**: April 25, 2026

---

## Summary

**This project shows:**
- ✅ How to use Google OAuth securely
- ✅ How to handle token expiry automatically
- ✅ How to build a full-stack web app (backend + frontend)
- ✅ How to stream large file downloads
- ✅ How to use FastAPI and React together

Good luck! 🚀
