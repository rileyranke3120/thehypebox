'use client';

import { SessionProvider } from 'next-auth/react';
import { ModalProvider } from '@/context/ModalContext';
import TrialModal from '@/components/TrialModal';

export function Providers({ children }) {
  return (
    <SessionProvider>
      <ModalProvider>
        {children}
        <TrialModal />
      </ModalProvider>
    </SessionProvider>
  );
}
