import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import DownloadModal from './components/DownloadModal';
import TokenInfo from './pages/TokenInfo';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:9999';
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || '';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState('home');

  useEffect(() => {
    checkAuthStatus();
    checkPickerResult();
    handleRouting();
    window.addEventListener('hashchange', handleRouting);
    return () => window.removeEventListener('hashchange', handleRouting);
  }, []);

  const handleRouting = () => {
    const hash = window.location.hash.slice(1) || 'home';
    setCurrentPage(hash);
  };

  const checkPickerResult = () => {
    fetch(`${API_BASE_URL}/api/get-picker-result`, {
      credentials: 'include',
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.files && data.files.length > 0) {
          setSelectedFiles(data.files);
          setShowModal(true);
        }
      })
      .catch((error) => {
      });
  };

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth-status`, {
        withCredentials: true,
      });
      setIsAuthenticated(response.data.authenticated);
    } catch (err) {
      setIsAuthenticated(false);
    }
  };

  const handleAuthenticateAndOpen = () => {
    const loginUrl = `${API_BASE_URL}/auth/login?redirect=${window.location.origin}`;
    setLoading(true);
    window.location.href = loginUrl;
  };

  const handleOpenPicker = () => {
    setLoading(true);
    window.location.href = `${API_BASE_URL}/api/picker`;
  };

  const handlePickerCallback = (data) => {
    if (data[window.google.picker.Response.ACTION] === window.google.picker.Action.PICKED) {
      const docs = data[window.google.picker.Response.DOCUMENTS];
      if (docs && docs.length > 0) {
        const files = docs.map((d) => ({
          id: d.id,
          name: d.name,
          mimeType: d.mimeType,
        }));
        setSelectedFiles(files);
        setShowModal(true);
      }
    }
  };

  const handleDownloadFiles = (format) => {
    setShowModal(false);
    setLoading(true);
    setError('');

    const endpoint =
      format === 'original' && selectedFiles.length === 1
        ? '/api/download-single'
        : '/api/download-bulk';

    fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        file_ids: selectedFiles.map((f) => f.id),
        format: format,
      }),
    })
      .then((response) => response.blob())
      .then((blob) => {
        setLoading(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download =
          selectedFiles.length === 1 && format === 'original'
            ? selectedFiles[0].name
            : 'DriveShare_files.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        setSelectedFiles([]);

        // Clear picker result from session after successful download
        fetch(`${API_BASE_URL}/api/clear-picker-result`, {
          method: 'POST',
          credentials: 'include',
        });
      })
      .catch((error) => {
        setLoading(false);
        setError(`Error downloading files: ${error.message}`);
      });
  };

  const handleDownloadIndividually = () => {
    setShowModal(false);
    setLoading(true);
    setError('');

    let downloadedCount = 0;

    const downloadNext = () => {
      if (downloadedCount >= selectedFiles.length) {
        setLoading(false);
        alert(`✅ Downloaded all ${selectedFiles.length} files!`);
        setSelectedFiles([]);

        // Clear picker result from session after successful downloads
        fetch(`${API_BASE_URL}/api/clear-picker-result`, {
          method: 'POST',
          credentials: 'include',
        });
        return;
      }

      const file = selectedFiles[downloadedCount];

      fetch(`${API_BASE_URL}/api/download-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ file_ids: [file.id], format: 'original' }),
      })
        .then((response) => response.blob())
        .then((blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
          downloadedCount++;
          setTimeout(downloadNext, 500);
        })
        .catch((error) => {
          alert(`Error downloading ${file.name}: ${error.message}`);
          downloadedCount++;
          setTimeout(downloadNext, 500);
        });
    };

    downloadNext();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedFiles([]);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      fetch(`${API_BASE_URL}/auth/logout`, {
        credentials: 'include',
      })
        .then(() => {
          setIsAuthenticated(false);
          setSelectedFiles([]);
          window.location.hash = '';
          window.location.pathname = '/';
        })
        .catch((error) => {
          console.error('Logout failed:', error);
        });
    }
  };

  if (currentPage === 'token-info') {
    return (
      <div className="app">
        <TokenInfo />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="container">
        <h1>📁 DriveShare</h1>
        <button
          className="btn"
          onClick={isAuthenticated ? handleOpenPicker : handleAuthenticateAndOpen}
          disabled={loading}
        >
          {isAuthenticated ? '🔍 Open Google Drive' : '🔐 Authenticate & Open Drive'}
        </button>
        {loading && (
          <div className="loading">
            <span className="spinner"></span> Loading...
          </div>
        )}
        {error && <div className="error-message">{error}</div>}

        {isAuthenticated && (
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <a href="#token-info" style={{ fontSize: '14px', color: '#666', marginRight: '20px' }}>
              🔐 View Token Info
            </a>
            <button
              style={{
                fontSize: '14px',
                padding: '6px 12px',
                backgroundColor: '#ff6b6b',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              onClick={handleLogout}
            >
              🚪 Logout
            </button>
          </div>
        )}
      </div>

      <DownloadModal
        show={showModal}
        selectedFiles={selectedFiles}
        onClose={handleCloseModal}
        onDownload={handleDownloadFiles}
        onDownloadIndividually={handleDownloadIndividually}
      />
    </div>
  );
}

export default App;
