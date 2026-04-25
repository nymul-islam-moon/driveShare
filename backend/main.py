from fastapi import FastAPI, Request, Body
from fastapi.responses import RedirectResponse, StreamingResponse, JSONResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io
import os
import logging
import zipfile
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler('app.log'), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
app = FastAPI(title="DriveShare API")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:9999"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session middleware
app.add_middleware(SessionMiddleware, secret_key=os.environ.get("SESSION_SECRET", "your-secret-key-change-in-production"))

CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
TOKEN_URI = os.environ.get("GOOGLE_TOKEN_URI", "https://oauth2.googleapis.com/token")
REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:9999/auth/callback")
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file"
]
CHUNK_SIZE = 10 * 1024 * 1024
API_KEY = os.environ.get("GOOGLE_API_KEY", "")

def get_drive_service(creds):
    return build("drive", "v3", credentials=creds)

def creds_from_session(token_data, request=None):
    if not token_data:
        
        return None

    refresh_token = token_data.get("refresh_token")
    access_token = token_data.get("token")

    if not refresh_token:

        return None

    # Check if access token has expired based on stored timestamp
    token_expires_at = token_data.get("token_expires_at")
    if token_expires_at and access_token:
        try:
            expiry_time = datetime.fromisoformat(token_expires_at.replace("Z", ""))
            minutes_left = (expiry_time - datetime.utcnow()).total_seconds() / 60
            if minutes_left < 10:
                logger.info(f"Access token expiring soon ({minutes_left:.0f} min left), forcing refresh...")
                access_token = None
        except Exception:
            pass

    # If no access token, use refresh token to get one
    if not access_token:
        logger.info("🔄 No access token found, using refresh_token to get a new one...")
        try:
            # Create credentials with minimal required fields
            creds = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
                client_id=token_data.get("client_id"),
                client_secret=token_data.get("client_secret"),
                scopes=token_data.get("scopes")
            )

            
            

            # Refresh the token
            creds.refresh(GoogleRequest())

            

            # Save new token to session
            if request:
                request.session["token"] = {
                    "token": creds.token,
                    "refresh_token": creds.refresh_token,
                    "token_uri": creds.token_uri,
                    "client_id": creds.client_id,
                    "client_secret": creds.client_secret,
                    "scopes": creds.scopes,
                    "token_expires_at": (datetime.utcnow() + timedelta(seconds=3600)).isoformat() + "Z",
                    "refresh_token_obtained_at": token_data.get("refresh_token_obtained_at"),
                }
                logger.info("✅ New access token saved to session!")

            return creds
        except Exception as e:
            
            return None

    # Token exists, create credentials and check if expired
    try:
        creds = Credentials(**token_data)

        if creds.expired and refresh_token:
            logger.info("🔄 Access token expired, refreshing with refresh_token...")
            creds.refresh(GoogleRequest())

            if request:
                request.session["token"] = {
                    "token": creds.token,
                    "refresh_token": creds.refresh_token,
                    "token_uri": creds.token_uri,
                    "client_id": creds.client_id,
                    "client_secret": creds.client_secret,
                    "scopes": creds.scopes,
                    "token_expires_at": (datetime.utcnow() + timedelta(seconds=3600)).isoformat() + "Z",
                    "refresh_token_obtained_at": token_data.get("refresh_token_obtained_at"),
                }
                logger.info("✅ Token refreshed and saved to session!")

        return creds
    except Exception as e:
        
        # Try to refresh using refresh token as fallback
        
        try:
            creds = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
                client_id=token_data.get("client_id"),
                client_secret=token_data.get("client_secret"),
                scopes=token_data.get("scopes")
            )
            creds.refresh(GoogleRequest())

            if request:
                request.session["token"] = {
                    "token": creds.token,
                    "refresh_token": creds.refresh_token,
                    "token_uri": creds.token_uri,
                    "client_id": creds.client_id,
                    "client_secret": creds.client_secret,
                    "scopes": creds.scopes,
                    "token_expires_at": (datetime.utcnow() + timedelta(seconds=3600)).isoformat() + "Z",
                    "refresh_token_obtained_at": token_data.get("refresh_token_obtained_at"),
                }
            logger.info("✅ Fallback refresh successful!")
            return creds
        except Exception as fallback_error:
            
            return None

@app.get("/")
def root(request: Request):
    return JSONResponse({"message": "DriveShare API", "version": "2.0", "docs": "/docs"})

@app.get("/auth/login")
def login(request: Request):
    redirect_url = request.query_params.get("redirect", "/")
    request.session["redirect_after_auth"] = redirect_url

    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={CLIENT_ID}&"
        f"redirect_uri={REDIRECT_URI}&"
        f"response_type=code&"
        f"scope={'+'.join(SCOPES)}&"
        f"access_type=offline&"
        f"prompt=consent"
    )
    logger.info("Initiating Google OAuth login")
    return RedirectResponse(url=auth_url)

@app.get("/auth/callback")
def callback(request: Request):
    code = request.query_params.get("code")
    if not code:
        return HTMLResponse("<h1>Error: No authorization code received</h1>", status_code=400)

    token_data = {
        "code": code,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    response = requests.post(TOKEN_URI, data=token_data)
    if response.status_code != 200:
        return HTMLResponse(f"<h1>Error: {response.text}</h1>", status_code=400)

    token_response = response.json()
    request.session["token"] = {
        "token": token_response.get("access_token"),
        "refresh_token": token_response.get("refresh_token"),
        "token_uri": TOKEN_URI,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scopes": SCOPES,
        "token_expires_at": (datetime.utcnow() + timedelta(seconds=3600)).isoformat() + "Z",
        "refresh_token_obtained_at": datetime.utcnow().isoformat() + "Z",
    }
    redirect_url = request.session.pop("redirect_after_auth", "/")
    return RedirectResponse(url=redirect_url)


@app.post("/api/download-single")
def download_single(request: Request, payload: dict = Body(...)):
    """Download a single file in original format"""
    try:
        token_data = request.session.get("token")
        if not token_data:
            
            return {"error": "Not authenticated"}

        creds = creds_from_session(token_data, request)
        if not creds:
            
            return {"error": "Failed to authenticate - could not refresh token"}

        service = get_drive_service(creds)
        file_ids = payload.get("file_ids", [])

        if not file_ids:
            return {"error": "No files selected"}

        file_id = file_ids[0]

        logger.info(f"📥 Attempting to download file: {file_id}")
        file_info = service.files().get(fileId=file_id, fields='name, mimeType').execute()
        mime_type = file_info.get('mimeType', '')

        if mime_type.startswith('application/vnd.google-apps.'):
            logger.warning(f"Cannot download Google Docs file: {file_id}")
            return {"error": "Google Docs files cannot be downloaded in original format"}

        file_name = file_info.get('name', 'file')
        request_obj = service.files().get_media(fileId=file_id)
        file_bytes = io.BytesIO()
        downloader = MediaIoBaseDownload(file_bytes, request_obj, chunksize=CHUNK_SIZE)

        done = False
        while not done:
            _, done = downloader.next_chunk()

        file_bytes.seek(0)
        logger.info(f"✅ Downloaded single file: {file_name}")

        return StreamingResponse(
            iter([file_bytes.getvalue()]),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={file_name}"}
        )
    except Exception as e:
        
        return {"error": f"Download failed: {str(e)}"}


@app.post("/api/download-bulk")
def download_bulk(request: Request, payload: dict = Body(...)):
    """Download files as ZIP archive"""
    try:
        token_data = request.session.get("token")
        if not token_data:
            
            return {"error": "Not authenticated"}

        logger.info(f"Token data present: access_token={bool(token_data.get('token'))}, refresh_token={bool(token_data.get('refresh_token'))}")

        creds = creds_from_session(token_data, request)
        if not creds:
            
            return {"error": "Failed to authenticate"}

        service = get_drive_service(creds)

        file_id_list = payload.get("file_ids", [])
        if not file_id_list:
            return {"error": "No files selected"}

        zip_buffer = io.BytesIO()
        files_added = 0
        files_skipped = 0

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for file_id in file_id_list:
                try:
                    file_info = service.files().get(fileId=file_id, fields='name, mimeType').execute()
                    mime_type = file_info.get('mimeType', '')

                    if mime_type.startswith('application/vnd.google-apps.'):
                        logger.warning(f"Skipping Google Docs file: {file_info.get('name')}")
                        files_skipped += 1
                        continue

                    file_name = file_info.get('name', 'file')
                    request_obj = service.files().get_media(fileId=file_id)
                    file_bytes = io.BytesIO()
                    downloader = MediaIoBaseDownload(file_bytes, request_obj, chunksize=CHUNK_SIZE)

                    done = False
                    while not done:
                        _, done = downloader.next_chunk()

                    file_bytes.seek(0)
                    zip_file.writestr(file_name, file_bytes.getvalue())
                    files_added += 1
                except Exception as e:
                    logger.warning(f"Failed to download {file_id}: {str(e)}")
                    files_skipped += 1
                    continue

        zip_buffer.seek(0)
        logger.info(f"📦 Created ZIP: {files_added} files added, {files_skipped} skipped")

        return StreamingResponse(
            iter([zip_buffer.getvalue()]),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=DriveShare_files.zip"}
        )
    except Exception as e:
        logger.error(f"Bulk download error: {str(e)}")
        return {"error": str(e)}


@app.get("/api/get-access-token")
def get_access_token(request: Request):
    """Get current valid access token, refreshing if needed"""
    try:
        

        token_data = request.session.get("token")
        

        if not token_data:
            
            return {"error": "Not authenticated"}

        
        
        

        # This will refresh token if needed
        
        creds = creds_from_session(token_data, request)

        

        if not creds:
            
            return {"error": "Failed to get access token"}

        if not creds.token:
            
            return {"error": "Failed to get access token"}

        logger.info(f"✅ [BACKEND] Returning valid access token: {creds.token[:20]}...")
        return {"access_token": creds.token}
    except Exception as e:
        
        import traceback
        
        return {"error": str(e)}


@app.get("/auth/logout")
def logout(request: Request):
    request.session.clear()
    logger.info("User logged out")
    return JSONResponse({"success": True, "message": "Logged out successfully"})


@app.get("/api/token-info")
def token_info(request: Request):
    """Get token status and info"""
    token_data = request.session.get("token")

    if not token_data:
        return {
            "authenticated": False,
            "access_token": None,
            "refresh_token": None
        }

    access_token = token_data.get("token")
    refresh_token = token_data.get("refresh_token")
    token_expires_at = token_data.get("token_expires_at")
    refresh_token_obtained_at = token_data.get("refresh_token_obtained_at")

    return {
        "authenticated": True,
        "access_token": access_token[:50] + "..." if access_token else None,
        "refresh_token": refresh_token[:50] + "..." if refresh_token else None,
        "has_access_token": bool(access_token),
        "has_refresh_token": bool(refresh_token),
        "access_token_full": access_token,
        "refresh_token_full": refresh_token,
        "token_expires_at": token_expires_at,
        "refresh_token_obtained_at": refresh_token_obtained_at
    }


@app.post("/api/delete-access-token")
def delete_access_token(request: Request):
    """Delete access token (keep refresh token for testing)"""
    token_data = request.session.get("token")

    if not token_data:
        return {"error": "No session data found"}

    refresh_token = token_data.get("refresh_token")
    if not refresh_token:
        return {"error": "No refresh token found"}

    token_data["token"] = None
    token_data["token_expires_at"] = None
    request.session["token"] = token_data

    return {"status": "success", "message": "Access token deleted"}


@app.post("/api/delete-refresh-token")
def delete_refresh_token(request: Request):
    """Delete all tokens — user must re-login"""
    request.session["token"] = {}
    return {"status": "success", "message": "All tokens deleted. Please login again."}


@app.post("/api/delete-refresh-token-only")
def delete_refresh_token_only(request: Request):
    """Delete only refresh token (testing) — access token will fail when expired"""
    token_data = request.session.get("token")
    if not token_data:
        return {"error": "No session data found"}

    token_data["refresh_token"] = None
    request.session["token"] = token_data
    return {"status": "success", "message": "Refresh token deleted. Access token will fail when it expires."}


@app.get("/api/auth-status")
def auth_status(request: Request):
    """Check if user is authenticated"""
    
    token_data = request.session.get("token")
    is_authenticated = bool(token_data and token_data.get("refresh_token"))
    return {"authenticated": is_authenticated}


@app.post("/api/save-picker-result")
def save_picker_result(request: Request, payload: dict = Body(...)):
    """Save picker result to session"""
    try:
        files = payload.get("files", [])
        
        request.session["picker_files"] = files
        
        return {"status": "success"}
    except Exception as e:
        
        return {"error": str(e)}


@app.get("/api/get-picker-result")
def get_picker_result(request: Request):
    """Get picker result from session"""
    try:
        files = request.session.get("picker_files", [])

        # Clear the session after retrieving
        request.session["picker_files"] = []
        return {"files": files}
    except Exception as e:

        return {"error": str(e)}


@app.post("/api/clear-picker-result")
def clear_picker_result(request: Request):
    """Clear picker result from session"""
    request.session["picker_files"] = []
    return {"status": "success"}


@app.get("/api/picker")
def picker(request: Request):
    """Serve Google Picker UI"""
    try:
        token_data = request.session.get("token")
        if not token_data or not token_data.get("refresh_token"):
            request.session["redirect_after_auth"] = request.url._url
            return RedirectResponse(url="/auth/login")

        creds = creds_from_session(token_data, request)
        if not creds or not creds.token:
            request.session["redirect_after_auth"] = request.url._url
            return RedirectResponse(url="/auth/login")

        access_token = creds.token
        

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Google Drive Picker</title>
            <script src="https://apis.google.com/js/api.js"></script>
        </head>
        <body>
            <div id="result"></div>
            <script>
                function initPicker() {{
                    gapi.load('picker', function() {{
                        const picker = new google.picker.PickerBuilder()
                            .addView(google.picker.ViewId.DOCS)
                            .setOAuthToken('{access_token}')
                            .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
                            .setCallback(pickerCallback)
                            .build();
                        picker.setVisible(true);
                    }});
                }}

                function pickerCallback(data) {{
                    if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {{
                        const docs = data[google.picker.Response.DOCUMENTS];
                        if (docs && docs.length > 0) {{
                            const files = docs.map(d => ({{
                                id: d.id,
                                name: d.name,
                                mimeType: d.mimeType
                            }}));

                            // Save files to session via backend API
                            fetch('/api/save-picker-result', {{
                                method: 'POST',
                                headers: {{'Content-Type': 'application/json'}},
                                credentials: 'include',
                                body: JSON.stringify({{files: files}})
                            }}).then(() => {{
                                // Redirect back to frontend
                                window.location.href = 'http://localhost:3000';
                            }}).catch(err => {{
                                console.error('Error saving files:', err);
                                alert('Error: ' + err.message);
                            }});
                        }}
                    }}
                }}

                initPicker();
            </script>
        </body>
        </html>
        """

        
        return HTMLResponse(html)

    except Exception as e:
        
        return HTMLResponse(f"<h1>Error: {str(e)}</h1>", status_code=500)


if __name__ == "__main__":
    import uvicorn

    print("\n" + "="*70)
    print("🚀 DriveShare Server Starting...")
    print("="*70)
    print("\n📱 ACCESS URL:\n")
    print("   http://localhost:9999")
    print("\n💡 Open this in your browser to access your Google Drive files!")
    print("="*70 + "\n")

    uvicorn.run(app, host="0.0.0.0", port=9999)
