import styles from '@/styles/marketing.module.css';

export default function AgentCard({ icon, title, description, features }) {
  return (
    <article className={styles.agentCard}>
      <div className={styles.agentCardIcon} aria-hidden="true">
        {icon}
      </div>
      <h3 className={styles.agentCardTitle}>{title}</h3>
      <p className={styles.agentCardDesc}>{description}</p>
      <ul className={styles.agentCardFeatures}>
        {features.map((feature, i) => (
          <li key={i}>{feature}</li>
        ))}
      </ul>
    </article>
  );
}
