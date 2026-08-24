import React, { useState, useRef } from 'react';
import { api } from '../api/client';

interface UploadResumePageProps {
  jobId: string;
  onClose?: () => void;
}

const UploadResumePage: React.FC<UploadResumePageProps> = ({ jobId, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf' || droppedFile.name.endsWith('.docx')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Please upload a PDF or DOCX file.');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError(null);
    setStatus('Uploading...');

    try {
      await api.uploadResume(jobId, file, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
        setProgress(percentCompleted);
      });

      setStatus('✅ Uploaded! AI is processing in background...');
      setProgress(100);
      // Close after short delay so user sees the success message
      setTimeout(() => {
        if (onClose) onClose();
      }, 1200);

    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error uploading file. Please try again.');
      setUploading(false);
      setStatus(null);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">Upload Resume</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div 
        className={`mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md ${
          file ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
        }`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="space-y-1 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          
          {file ? (
            <div className="text-sm text-gray-600">
              Selected: <span className="font-semibold text-primary-600">{file.name}</span>
            </div>
          ) : (
            <div className="flex text-sm text-gray-600 justify-center">
              <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500">
                <span>Upload a file</span>
                <input id="file-upload" name="file-upload" type="file" accept=".pdf,.docx" className="sr-only" onChange={handleFileChange} ref={fileInputRef} />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
          )}
          <p className="text-xs text-gray-500">PDF or DOCX up to 10MB</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      {uploading && (
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700">{status}</span>
            <span className="text-gray-900 font-medium">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-primary-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end space-x-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || uploading}
          className="bg-primary-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </div>
  );
};

export default UploadResumePage;
