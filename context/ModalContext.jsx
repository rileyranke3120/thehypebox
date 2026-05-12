'use client';

import { createContext, useContext, useState } from 'react';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState('velocity'); // default to most popular

  function openModal(selectedPlan) {
    setPlan(selectedPlan || 'velocity');
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  return (
    <ModalContext.Provider value={{ open, plan, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}
