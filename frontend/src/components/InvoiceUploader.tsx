'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  File,
  Sparkles,
} from 'lucide-react';
import { uploadInvoiceFile } from '../lib/supabase';
import { api, InvoiceRecord } from '../lib/api';

interface FileUploadTask {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'extracting' | 'completed' | 'failed';
  error?: string;
  invoice?: InvoiceRecord;
}

interface InvoiceUploaderProps {
  onUploadSuccess: () => void;
}

export const InvoiceUploader: React.FC<InvoiceUploaderProps> = ({
  onUploadSuccess,
}) => {
  const [tasks, setTasks] = useState<FileUploadTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tasksRef = useRef<FileUploadTask[]>([]);
  const processingRef = useRef(false);
  const autoClearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  tasksRef.current = tasks;

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (autoClearTimeoutRef.current) {
        clearTimeout(autoClearTimeoutRef.current);
      }
    };
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);

    if (autoClearTimeoutRef.current) {
      clearTimeout(autoClearTimeoutRef.current);
      autoClearTimeoutRef.current = null;
    }

    try {
      // Continuously process until no pending items remain in the queue
      while (true) {
        const nextTask = tasksRef.current.find((t) => t.status === 'pending');
        if (!nextTask) {
          break;
        }

        // 1. Mark current file as uploading to Supabase
        setTasks((prev) => {
          const updated = prev.map((t) =>
            t.id === nextTask.id
              ? { ...t, status: 'uploading' as const, error: undefined }
              : t,
          );
          tasksRef.current = updated;
          return updated;
        });

        try {
          // Direct browser upload to Supabase Storage
          const uploadResult = await uploadInvoiceFile(nextTask.file);

          // 2. Mark extracting with Vision LLM
          setTasks((prev) => {
            const updated = prev.map((t) =>
              t.id === nextTask.id ? { ...t, status: 'extracting' as const } : t,
            );
            tasksRef.current = updated;
            return updated;
          });

          // Backend API call: triggers synchronous Vision LLM extraction
          const extractedInvoice = await api.createAndExtractInvoice({
            fileName: uploadResult.fileName,
            storagePath: uploadResult.storagePath,
            mimeType: uploadResult.mimeType,
            fileSize: uploadResult.fileSize,
          });

          // 3. Mark completed
          setTasks((prev) => {
            const updated = prev.map((t) =>
              t.id === nextTask.id
                ? {
                  ...t,
                  status: 'completed' as const,
                  invoice: extractedInvoice,
                }
                : t,
            );
            tasksRef.current = updated;
            return updated;
          });

          // Notify parent dashboard immediately as each file finishes
          onUploadSuccess();
        } catch (err: any) {
          console.error(`Failed processing ${nextTask.file.name}:`, err);
          setTasks((prev) => {
            const updated = prev.map((t) =>
              t.id === nextTask.id
                ? {
                  ...t,
                  status: 'failed' as const,
                  error: err.message || 'Processing failed',
                }
                : t,
            );
            tasksRef.current = updated;
            return updated;
          });
        }
      }
    } finally {
      processingRef.current = false;
      setIsProcessing(false);

      // Auto-clear batch queue after completion so section goes away
      if (autoClearTimeoutRef.current) {
        clearTimeout(autoClearTimeoutRef.current);
      }
      autoClearTimeoutRef.current = setTimeout(() => {
        setTasks((prev) => {
          const allCompleted =
            prev.length > 0 && prev.every((t) => t.status === 'completed');
          if (allCompleted) {
            tasksRef.current = [];
            return [];
          }
          const remaining = prev.filter((t) => t.status !== 'completed');
          tasksRef.current = remaining;
          return remaining;
        });
      }, 2500);
    }
  }, [onUploadSuccess]);

  const handleFiles = (files: FileList | File[]) => {
    if (autoClearTimeoutRef.current) {
      clearTimeout(autoClearTimeoutRef.current);
      autoClearTimeoutRef.current = null;
    }

    const fileArray = Array.from(files).filter(
      (f) =>
        f.type === 'application/pdf' ||
        f.type === 'image/jpeg' ||
        f.type === 'image/png' ||
        f.name.endsWith('.pdf') ||
        f.name.endsWith('.jpg') ||
        f.name.endsWith('.jpeg'),
    );

    if (fileArray.length === 0) return;

    const newTasks: FileUploadTask[] = fileArray.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
    }));

    setTasks((prev) => {
      const updated = [...prev, ...newTasks];
      tasksRef.current = updated;
      return updated;
    });

    // If queue is idle, kick off processing; if already running, the loop will seamlessly consume the new tasks
    setTimeout(() => {
      processQueue();
    }, 50);
  };

  const removeTask = (id: string) => {
    setTasks((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      tasksRef.current = remaining;
      return remaining;
    });
  };

  const clearCompleted = () => {
    setTasks((prev) => {
      const remaining = prev.filter((t) => t.status !== 'completed');
      tasksRef.current = remaining;
      return remaining;
    });
  };

  const retryFailed = () => {
    if (autoClearTimeoutRef.current) {
      clearTimeout(autoClearTimeoutRef.current);
      autoClearTimeoutRef.current = null;
    }
    setTasks((prev) => {
      const resetTasks = prev.map((t) =>
        t.status === 'failed'
          ? { ...t, status: 'pending' as const, error: undefined }
          : t,
      );
      tasksRef.current = resetTasks;
      return resetTasks;
    });
    setTimeout(() => {
      processQueue();
    }, 50);
  };

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const totalCount = tasks.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="card uploader-card">
      <div className="card-header">
        <div className="card-header-title">
          <UploadCloud className="text-primary" size={20} />
          <h2>Instant Ingestion & Sequential Extraction</h2>
        </div>
      </div>

      <div
        className={`dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <div className="dropzone-icon-box">
          <UploadCloud size={32} className="dropzone-icon" />
        </div>
        <div className="dropzone-text">
          <p className="dropzone-primary-text">
            <strong>Click to upload</strong> or drag & drop Japanese invoices
          </p>
          <p className="dropzone-sub-text">
            PDFs, Scanned images, Handwritten JPGs • Uploads to Supabase & extracts instantly one by one
          </p>
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="upload-queue">
          <div className="queue-header">
            <div className="queue-title-wrap">
              <h3>Batch Queue ({tasks.length} files)</h3>
              {isProcessing && (
                <span className="queue-progress-badge">
                  <Loader2 size={13} className="spin" />
                  Processing {completedCount + 1} of {totalCount}...
                </span>
              )}
            </div>
            <div className="queue-actions">
              {completedCount > 0 && !isProcessing && (
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={clearCompleted}
                >
                  Clear Finished
                </button>
              )}
              {tasks.some((t) => t.status === 'failed') && !isProcessing && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={retryFailed}
                >
                  <Sparkles size={14} />
                  Retry Failed
                </button>
              )}
              {!isProcessing && (
                <button
                  className="btn-icon-xs"
                  onClick={() => setTasks([])}
                  title="Dismiss Queue"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          )}

          <div className="queue-list">
            {tasks.map((task) => (
              <div key={task.id} className={`queue-item status-${task.status}`}>
                <div className="queue-item-info">
                  <File size={16} className="file-icon" />
                  <span className="file-name" title={task.file.name}>
                    {task.file.name}
                  </span>
                  <span className="file-size">
                    ({(task.file.size / 1024).toFixed(0)} KB)
                  </span>
                </div>

                <div className="queue-item-status">
                  {task.status === 'pending' && (
                    <span className="badge badge-neutral">Queued</span>
                  )}
                  {task.status === 'uploading' && (
                    <span className="badge badge-info">
                      <Loader2 size={12} className="spin" />
                      Uploading to Supabase...
                    </span>
                  )}
                  {task.status === 'extracting' && (
                    <span className="badge badge-warning">
                      <Sparkles size={12} className="pulse" />
                      Reading with Vision LLM...
                    </span>
                  )}
                  {task.status === 'completed' && (
                    <span className="badge badge-success">
                      <CheckCircle size={12} />
                      Extracted ✓
                    </span>
                  )}
                  {task.status === 'failed' && (
                    <span className="badge badge-danger" title={task.error}>
                      <AlertCircle size={12} />
                      Failed
                    </span>
                  )}

                  {!isProcessing && (
                    <button
                      className="btn-icon-xs"
                      onClick={() => removeTask(task.id)}
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
