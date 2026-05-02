'use client';

import { useRouter } from 'next/navigation';

export default function TrialButton({ plan, className, style, children }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/checkout?plan=${plan || 'velocity'}`)}
      className={className || 'btn btn-primary'}
      style={style}
    >
      {children || 'Start Free Trial'}
    </button>
  );
}
