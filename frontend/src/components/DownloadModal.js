import React from 'react';
import './DownloadModal.css';

function DownloadModal({ show, selectedFiles, onClose, onDownload, onDownloadIndividually }) {
  const fileCount = selectedFiles.length;

  if (!show) return null;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        {fileCount === 1 ? (
          <>
            <div className="modal-title">
              📥 Download: <strong>{selectedFiles[0].name}</strong>
            </div>
            <div className="modal-subtitle">Choose your preferred download method</div>
            <div className="download-options">
              <div className="download-option" onClick={() => onDownload('original')}>
                <div className="download-option-icon">📥</div>
                <div className="download-option-title">Download Original Format</div>
                <div className="download-option-desc">Get file in original quality and format</div>
              </div>
              <div className="download-option" onClick={() => onDownload('zip')}>
                <div className="download-option-icon">📦</div>
                <div className="download-option-title">Download as ZIP</div>
                <div className="download-option-desc">Wrap file in ZIP archive</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="modal-title">
              📦 Downloading <strong>{fileCount} files</strong>
            </div>
            <div className="modal-subtitle">Choose how to download your files</div>
            <div className="download-options">
              <div className="download-option" onClick={() => onDownload('zip')}>
                <div className="download-option-icon">📦</div>
                <div className="download-option-title">Download as ZIP (Recommended)</div>
                <div className="download-option-desc">All files in one archive - fastest option</div>
              </div>
              <div className="download-option" onClick={onDownloadIndividually}>
                <div className="download-option-icon">📂</div>
                <div className="download-option-title">Download Individually</div>
                <div className="download-option-desc">Each file downloads one by one</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DownloadModal;
