import styles from '@/styles/marketing.module.css';

export default function StatsBar() {
  return (
    <div className={styles.stats}>
      <div className="container">
        <dl className={styles.statsGrid}>
          <div>
            <dt className={styles.statsLabel}>Always On</dt>
            <dd className={styles.statsValue}>24/7</dd>
          </div>
          <div>
            <dt className={styles.statsLabel}>Setup Time</dt>
            <dd className={styles.statsValue}>15 Min</dd>
          </div>
          <div>
            <dt className={styles.statsLabel}>US-Based Support</dt>
            <dd className={styles.statsValue}>100%</dd>
          </div>
          <div>
            <dt className={styles.statsLabel}>Missed Calls</dt>
            <dd className={styles.statsValue}>0</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
