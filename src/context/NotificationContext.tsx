import { createContext, useContext, useState } from 'react';

interface NotificationContextType {
  isNewProposal: (fundAddress: string) => boolean;
  triggerPulse: (fundAddress: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [newProposals, setNewProposals] = useState<Record<string, boolean>>({});

  const isNewProposal = (fundAddress: string) => newProposals[fundAddress] || false;

  const triggerPulse = (fundAddress: string) => {
    setNewProposals((prev) => ({ ...prev, [fundAddress]: true }));
    setTimeout(() => {
      setNewProposals((prev) => {
        const { [fundAddress]: _, ...rest } = prev;
        return rest;
      });
    }, 5000);
  };

  return (
    <NotificationContext.Provider value={{ isNewProposal, triggerPulse }}>
      {children}
    </NotificationContext.Provider>
  );
};