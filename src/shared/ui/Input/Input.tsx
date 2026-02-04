'use client';

import { type InputHTMLAttributes, forwardRef } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className, ...props }, ref) => {
    const classNames = [styles.input, error && styles.error, className]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={styles.wrapper}>
        <input ref={ref} className={classNames} {...props} />
        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
