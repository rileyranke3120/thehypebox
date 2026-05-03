'use client';

export default function TrialButton({ plan, className, style, children }) {
  return (
    <a
      href={`/checkout?plan=${plan || 'velocity'}`}
      className={className || 'btn btn-primary'}
      style={style}
    >
      {children || 'Start Free Trial'}
    </a>
  );
}
