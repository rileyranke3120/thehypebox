import Link from 'next/link';
import Image from 'next/image';
import styles from '@/styles/login.module.css';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <div className={styles.loginLayout}>

      {/* Brand panel */}
      <aside className={styles.loginBrand} aria-hidden="true">
        <div className={styles.loginBrandInner}>
          <div className={styles.loginBrandLogo}>
            <Image src="/logo.png" alt="TheHypeBox" height={56} width={280} style={{ display: 'block', height: '56px', width: 'auto', mixBlendMode: 'screen' }} />
          </div>
          <p className={styles.loginBrandTagline}>Real AI, Real People,<br />Real Results</p>
          <ul className={styles.loginBrandFeatures}>
            <li><span className={styles.loginBrandCheck}>✓</span> AI Receptionist</li>
            <li><span className={styles.loginBrandCheck}>✓</span> Website Chatbot</li>
            <li><span className={styles.loginBrandCheck}>✓</span> Lead Follow-Up Automation</li>
            <li><span className={styles.loginBrandCheck}>✓</span> Professional Website</li>
          </ul>
        </div>
      </aside>

      {/* Login form */}
      <main className={styles.loginMain} id="main-content">
        <div className={styles.loginBox}>

          <div className={styles.loginBoxHeader}>
            <span className="tag">Client Portal</span>
            <h1 className={styles.loginBoxTitle}>Welcome Back</h1>
            <p className={styles.loginBoxSub}>Log in to your Hype Box Command Center.</p>
          </div>

          <LoginForm />

          <p className={styles.loginBoxFooter}>
            Not a client yet?{' '}
            <Link href="/#services">See how it works →</Link>
          </p>

          <p className={styles.loginBoxFooter}>
            <Link href="/">← Back to site</Link>
          </p>

        </div>
      </main>

    </div>
  );
}
