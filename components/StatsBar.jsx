import styles from '@/styles/marketing.module.css';

export default function StatsBar() {
  return (
    <div className={styles.stats}>
      <div className="container">
        <dl className={styles.statsGrid}>
          <div>
            <dd className={styles.statsValue}>24/7</dd>
            <dt className={styles.statsLabel}>AI Always On</dt>
          </div>
          <div>
            <dd className={styles.statsValue}>&lt; 60s</dd>
            <dt className={styles.statsLabel}>Lead Response Time</dt>
          </div>
          <div>
            <dd className={styles.statsValue}>100%</dd>
            <dt className={styles.statsLabel}>US-Based Support</dt>
          </div>
          <div>
            <dd className={styles.statsValue}>0</dd>
            <dt className={styles.statsLabel}>Missed Calls</dt>
          </div>
        </dl>
      </div>
    </div>
  );
}
