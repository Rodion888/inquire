'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './FollowUpModal.module.css';

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (question: string) => void;
}

export function FollowUpModal({ isOpen, onClose, onSubmit }: FollowUpModalProps) {
  const [question, setQuestion] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuestion('');
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (question.trim()) {
      onSubmit(question.trim());
      onClose();
      setQuestion('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <textarea
          ref={inputRef}
          className={styles.input}
          placeholder="Type your follow-up question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
        />
        <div className={styles.buttons}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={!question.trim()}
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
