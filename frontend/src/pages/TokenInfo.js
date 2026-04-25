import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:9999';

export default function TokenInfo() {
  const [tokenData, setTokenData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    fetchTokenInfo();
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev && prev > 0) return prev - 1;
        return null;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTokenInfo = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/token-info`, {
        withCredentials: true,
      });
      setTokenData(response.data);

      // Calculate time remaining
      if (response.data.token_expires_at) {
        const expiryTime = new Date(response.data.token_expires_at);
        const now = new Date();
        const secondsRemaining = Math.floor((expiryTime - now) / 1000);
        setTimeRemaining(Math.max(0, secondsRemaining));
      }

      setLoading(false);
    } catch (err) {
      setError('Failed to fetch token info');
      setLoading(false);
    }
  };

  const deleteAccessToken = async () => {
    if (!window.confirm('Delete access token? Refresh token will be kept for auto-refresh.')) return;

    try {
      await axios.post(`${API_BASE_URL}/api/delete-access-token`, {}, {
        withCredentials: true,
      });
      alert('✅ Access token deleted! Will auto-refresh on next API call.');
      fetchTokenInfo();
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  };

  const deleteAllTokens = async () => {
    if (!window.confirm('Delete ALL tokens? You will need to login again.')) return;

    try {
      await axios.post(`${API_BASE_URL}/api/delete-refresh-token`, {}, {
        withCredentials: true,
      });
      alert('✅ All tokens deleted! Redirecting to home...');
      window.location.hash = '';
      window.location.pathname = '/';
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  };

  const deleteRefreshTokenOnly = async () => {
    if (!window.confirm('Delete ONLY refresh token? (Testing) Access token will fail when it expires.')) return;

    try {
      await axios.post(`${API_BASE_URL}/api/delete-refresh-token-only`, {}, {
        withCredentials: true,
      });
      alert('✅ Refresh token deleted! Access token remains but cannot be refreshed.');
      fetchTokenInfo();
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || seconds < 0) return '0m 0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getTimeStatus = (seconds) => {
    if (!seconds) return { color: '#dc3545', status: 'EXPIRED' };
    if (seconds < 600) return { color: '#ffc107', status: 'EXPIRING SOON' };
    return { color: '#28a745', status: 'VALID' };
  };

  const getProgressPercentage = () => {
    if (!timeRemaining) return 0;
    // Token is valid for 3600 seconds (1 hour)
    return Math.max(0, Math.min(100, (timeRemaining / 3600) * 100));
  };

  const getRefreshTokenAgeInDays = () => {
    if (!tokenData?.refresh_token_obtained_at) return null;
    const obtainedTime = new Date(tokenData.refresh_token_obtained_at);
    const now = new Date();
    const diffMs = now - obtainedTime;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  const getRefreshTokenStatus = () => {
    const age = getRefreshTokenAgeInDays();
    if (!age) return null;
    if (age > 180) return { color: '#dc3545', status: 'EXPIRED' };
    if (age > 150) return { color: '#ffc107', status: 'EXPIRING SOON (~30 days left)' };
    return { color: '#28a745', status: 'VALID' };
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingSpinner}>
          <div style={styles.spinner}></div>
          <p>Loading token information...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.headerH1}>🔐 Token Information Dashboard</h1>
        <a href="#home" style={styles.backLink} onClick={() => window.location.hash = ''}>← Back to App</a>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {tokenData && (
        <div style={styles.mainContent}>
          {/* Status Card */}
          <div style={styles.statusCard}>
            <h2>Authentication Status</h2>
            <div style={styles.statusGrid}>
              <div style={styles.statusItem}>
                <span style={styles.statusLabel}>Overall Status:</span>
                <span style={{
                  ...styles.statusBadge,
                  backgroundColor: tokenData.authenticated ? '#28a745' : '#dc3545'
                }}>
                  {tokenData.authenticated ? '✅ AUTHENTICATED' : '❌ NOT AUTHENTICATED'}
                </span>
              </div>
            </div>
          </div>

          {/* Access Token Card */}
          <div style={styles.tokenCard}>
            <div style={styles.tokenHeader}>
              <h2>🔑 Access Token</h2>
              <span style={{
                ...styles.badge,
                backgroundColor: getTimeStatus(timeRemaining).color
              }}>
                {getTimeStatus(timeRemaining).status}
              </span>
            </div>

            {tokenData.has_access_token ? (
              <>
                {/* Time Remaining */}
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>⏱️ Time Remaining</h3>
                  <div style={styles.timeDisplay}>
                    <div style={styles.timeValue}>
                      {formatTime(timeRemaining)}
                    </div>
                    <div style={styles.secondsDisplay}>
                      {timeRemaining !== null ? timeRemaining : 0} seconds
                    </div>
                    <div style={styles.progressBar}>
                      <div
                        style={{
                          ...styles.progressFill,
                          width: `${getProgressPercentage()}%`,
                          backgroundColor: getTimeStatus(timeRemaining).color
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Token Details */}
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>📋 Token Details</h3>
                  <div style={styles.detailsGrid}>
                    <div style={styles.detailItem}>
                      <span style={styles.label}>Retrieved:</span>
                      <span style={styles.value}>
                        {tokenData.token_expires_at
                          ? new Date(
                              new Date(tokenData.token_expires_at).getTime() - 3600000
                            ).toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>
                    <div style={styles.detailItem}>
                      <span style={styles.label}>Expires:</span>
                      <span style={styles.value}>
                        {tokenData.token_expires_at
                          ? new Date(tokenData.token_expires_at).toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Token Preview */}
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>👁️ Token Preview</h3>
                  <div style={styles.tokenPreview}>
                    {tokenData.access_token}
                  </div>
                  <details style={styles.expandable}>
                    <summary style={styles.summary}>📋 Show Full Token</summary>
                    <textarea
                      style={styles.textarea}
                      value={tokenData.access_token_full}
                      readOnly
                    />
                  </details>
                </div>
              </>
            ) : (
              <div style={styles.emptyState}>
                <p>❌ No access token available</p>
              </div>
            )}
          </div>

          {/* Refresh Token Card */}
          <div style={styles.tokenCard}>
            <div style={styles.tokenHeader}>
              <h2>🔄 Refresh Token</h2>
              <span style={{
                ...styles.badge,
                backgroundColor: getRefreshTokenStatus()?.color || '#dc3545'
              }}>
                {getRefreshTokenStatus()?.status || (tokenData.has_refresh_token ? '✅ PRESENT' : '❌ MISSING')}
              </span>
            </div>

            {tokenData.has_refresh_token ? (
              <>
                <div style={styles.infoBox}>
                  <p>🔄 This token is used to automatically refresh your access token when it expires. Google refresh tokens expire if unused for 6 months.</p>
                </div>

                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>📅 Token Lifecycle</h3>
                  <div style={styles.detailsGrid}>
                    <div style={styles.detailItem}>
                      <span style={styles.label}>Obtained:</span>
                      <span style={styles.value}>
                        {tokenData.refresh_token_obtained_at
                          ? new Date(tokenData.refresh_token_obtained_at).toLocaleString()
                          : 'N/A'}
                      </span>
                    </div>
                    <div style={styles.detailItem}>
                      <span style={styles.label}>Age:</span>
                      <span style={styles.value}>
                        {getRefreshTokenAgeInDays() !== null ? `${getRefreshTokenAgeInDays()} days` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>👁️ Token Preview</h3>
                  <div style={styles.tokenPreview}>
                    {tokenData.refresh_token}
                  </div>
                  <details style={styles.expandable}>
                    <summary style={styles.summary}>📋 Show Full Token</summary>
                    <textarea
                      style={styles.textarea}
                      value={tokenData.refresh_token_full}
                      readOnly
                    />
                  </details>
                </div>
              </>
            ) : (
              <div style={styles.emptyState}>
                <p>❌ No refresh token available - you'll need to login again</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={styles.actionsContainer}>
            <button style={styles.btnPrimary} onClick={fetchTokenInfo}>
              🔄 Refresh Info
            </button>
            {tokenData.has_refresh_token && (
              <button style={styles.btnDanger} onClick={deleteAccessToken}>
                🗑️ Delete Access Token (Testing)
              </button>
            )}
            {tokenData.has_refresh_token && (
              <button style={styles.btnDanger} onClick={deleteAllTokens}>
                🗑️ Delete All Tokens (Force Re-login)
              </button>
            )}
            {tokenData.has_refresh_token && (
              <button style={{...styles.btnDanger, opacity: 0.6}} onClick={deleteRefreshTokenOnly}>
                🧪 Delete Refresh Only (Test)
              </button>
            )}
          </div>

          {/* Info Box */}
          <div style={styles.infoBox}>
            <h3>ℹ️ How It Works</h3>
            <ul style={styles.infoList}>
              <li>Access tokens expire after <strong>1 hour</strong></li>
              <li>Before expiring, the system <strong>automatically refreshes</strong> using the refresh token</li>
              <li>You won't see 403 errors unless refresh token is missing</li>
              <li>Use "Delete Access Token" button to test auto-refresh behavior</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '40px 20px',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
  },
  header: {
    maxWidth: '900px',
    margin: '0 auto 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white',
  },
  headerH1: {
    fontSize: '32px',
    fontWeight: '700',
    letterSpacing: '1px',
  },
  backLink: {
    color: 'white',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '600',
    padding: '10px 20px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: '6px',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    border: '2px solid rgba(255,255,255,0.4)',
    display: 'flex',
    alignItems: 'center',
  },
  mainContent: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  loadingSpinner: {
    textAlign: 'center',
    color: 'white',
    paddingTop: '100px',
  },
  spinner: {
    width: '50px',
    height: '50px',
    margin: '0 auto 20px',
    border: '4px solid rgba(255,255,255,0.3)',
    borderTop: '4px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '25px',
    marginBottom: '25px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  },
  statusGrid: {
    display: 'grid',
    gap: '15px',
  },
  statusItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  statusLabel: {
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    padding: '6px 12px',
    color: 'white',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
  },
  tokenCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '25px',
    marginBottom: '25px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    borderLeft: '5px solid #667eea',
  },
  tokenHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '2px solid #f0f0f0',
  },
  badge: {
    padding: '6px 12px',
    color: 'white',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#667eea',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  timeDisplay: {
    padding: '30px',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
    textAlign: 'center',
    border: '2px solid #667eea',
  },
  timeValue: {
    fontSize: '48px',
    fontWeight: '900',
    color: '#667eea',
    marginBottom: '20px',
    fontFamily: 'monospace',
    letterSpacing: '2px',
    animation: 'pulse 1s ease-in-out infinite',
  },
  secondsDisplay: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#764ba2',
    marginBottom: '20px',
    fontFamily: 'monospace',
    letterSpacing: '1px',
  },
  progressBar: {
    width: '100%',
    height: '12px',
    backgroundColor: '#e9ecef',
    borderRadius: '6px',
    overflow: 'hidden',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
  },
  progressFill: {
    height: '100%',
    transition: 'width 0.5s ease',
    boxShadow: '0 0 10px rgba(102, 126, 234, 0.5)',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '15px',
  },
  detailItem: {
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '5px',
  },
  value: {
    display: 'block',
    fontSize: '13px',
    color: '#333',
    fontFamily: 'monospace',
  },
  tokenPreview: {
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    fontSize: '12px',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    color: '#666',
    border: '1px solid #e9ecef',
  },
  expandable: {
    marginTop: '10px',
  },
  summary: {
    cursor: 'pointer',
    color: '#667eea',
    fontWeight: '600',
    marginBottom: '10px',
    fontSize: '13px',
  },
  textarea: {
    width: '100%',
    height: '120px',
    padding: '10px',
    fontFamily: 'monospace',
    fontSize: '11px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    resize: 'none',
    color: '#333',
    backgroundColor: '#f8f9fa',
  },
  emptyState: {
    textAlign: 'center',
    padding: '30px',
    color: '#999',
    fontSize: '14px',
  },
  infoBox: {
    backgroundColor: '#e7f3ff',
    borderLeft: '4px solid #667eea',
    padding: '15px',
    borderRadius: '4px',
    marginBottom: '25px',
  },
  infoList: {
    margin: '10px 0 0 0',
    paddingLeft: '20px',
    fontSize: '13px',
    color: '#333',
  },
  actionsContainer: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '25px',
  },
  btnPrimary: {
    padding: '12px 24px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
  },
  btnDanger: {
    padding: '12px 24px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(220, 53, 69, 0.4)',
  },
  error: {
    maxWidth: '900px',
    margin: '0 auto 20px',
    padding: '15px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '6px',
    border: '1px solid #f5c6cb',
  },
};

// Add animation to stylesheet
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.02); }
  }
  a:hover {
    text-decoration: none;
  }
`;
document.head.appendChild(styleSheet);
