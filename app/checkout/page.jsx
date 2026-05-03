import { Suspense } from 'react';
import CheckoutContent from './CheckoutContent';

export const dynamic = 'force-dynamic';

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0a' }} />}>
      <CheckoutContent />
    </Suspense>
  );
}
