'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { login } from '@/app/actions/auth';
import styles from '@/styles/login.module.css';

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form className={styles.loginForm} action={action} noValidate>

      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          className={styles.formInput}
          placeholder="you@yourbusiness.com"
          autoComplete="email"
          required
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel} htmlFor="password">
          Password
          <Link href="/forgot-password" className={styles.formLabelLink}>Forgot password?</Link>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className={styles.formInput}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>

      {state?.error && (
        <p className={styles.formError}>{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`btn btn-primary ${styles.loginBtn}`}
      >
        {pending ? 'Logging in…' : 'Log In'}
      </button>

    </form>
  );
}
