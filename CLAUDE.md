# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

```bash
# Activate conda environment
conda activate driveshare

# Install/update dependencies
pip install -r requirements.txt

# Run the application
python main.py

# Access the app
# Open http://localhost:9999 in browser
```

## Architecture Overview

DriveShare is a single-file FastAPI application that allows users to browse and download their Google Drive files.

**Key Components:**

- **OAuth Flow** (lines 160-192): Users authenticate via Google. Session stores the OAuth token for subsequent API calls.
- **File Listing** (lines 194-470): Queries Google Drive API for files/folders. Displays in HTML table with sorting (folders first).
- **Download Operations**: 
  - Single file download (`/download/{file_id}`) streams file in 10MB chunks
  - Bulk download (`/download-bulk`) creates zip file in memory with selected files
- **File Info Modal** (`/api/file-info/{file_id}`): Returns JSON with file metadata (size, dates, owner)

**Helper Functions** (already extracted for code clarity):
- `format_file_size(bytes)` - Converts bytes to readable format
- `get_file_icon_and_type(mime_type)` - Returns emoji and file type label
- `creds_from_session(token_data)` - Converts session token to Google credentials, refreshes if expired
- `get_drive_service(creds)` - Builds Google Drive API client

## Authentication & Credentials

1. User must obtain `credentials.json` from Google Cloud Console:
   - Enable Google Drive API
   - Create OAuth 2.0 Web Application credentials
   - Authorize redirect URI: `http://localhost:9999/auth/callback`

2. Token flow:
   - `/auth/login` - Initiates OAuth flow, stores state in session
   - `/auth/callback` - Google redirects here with authorization code, exchanges for token, stores in session
   - Token stored in `request.session["token"]` as dict with `token`, `refresh_token`, `token_uri`, etc.
   - Token automatically refreshed if expired before API calls

## Google Drive API Details

- **Scope**: `drive.readonly` - Read-only access (no modifications)
- **API Version**: v3
- **Rate Limits**: 1000 queries/day per user
- **File Fields Queried**: `id, name, mimeType, size, modifiedTime, createdTime, webViewLink, owners`

## Code Style Notes

- All functions have docstring comments
- Sections marked with `# ============= SECTION NAME =============` for clarity
- Inline comments explain the "why" rather than "what"
- Size formatting, icon logic extracted to helpers to reduce duplication
- HTML/CSS/JS embedded in route responses (not ideal for large apps, acceptable here for single-file simplicity)

## Common Development Tasks

**Add a new API endpoint:**
1. Create `@app.get()` or `@app.post()` decorated function
2. Extract token and create service: `creds = creds_from_session(request.session.get("token"))`
3. Call Google Drive API via `service.files().xxx().execute()`
4. Return response (HTML, JSON, or redirect)

**Modify file listing UI:**
- Edit HTML template in `list_files()` function (lines 210-470)
- Style changes in `<style>` tag
- JavaScript for interactivity in `<script>` tag

**Test Google Drive connectivity:**
Run `python main.py`, login, and check `app.log` for API calls

## Deployment Notes

- `OAUTHLIB_INSECURE_TRANSPORT=1` allows HTTP for localhost only - **must be removed for production**
- `SessionMiddleware` secret key is hardcoded - **use environment variable in production**
- Credentials file path is hardcoded to `./credentials.json` - consider making configurable
