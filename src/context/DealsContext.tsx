import React, { createContext, useContext, useState, useCallback } from 'react';
import { Deal, DealStatus, DealDomain } from '../types';
import { mockDeals } from '../data/mockData';

interface DealsContextType {
  deals: Deal[];
  addDeal: (deal: Omit<Deal, 'id' | 'createdAt' | 'documents'>) => Promise<Deal>;
  updateDeal: (id: string, updates: Partial<Deal>) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;
  getDeal: (id: string) => Deal | undefined;
}

const DealsContext = createContext<DealsContextType | null>(null);

export function DealsProvider({ children }: { children: React.ReactNode }) {
  const [deals, setDeals] = useState<Deal[]>(mockDeals);

  const addDeal = useCallback(async (deal: Omit<Deal, 'id' | 'createdAt' | 'documents'>): Promise<Deal> => {
    await new Promise(r => setTimeout(r, 800));
    const newDeal: Deal = {
      ...deal,
      id: `D-${String(deals.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString().split('T')[0],
      documents: [],
    };
    setDeals(prev => [newDeal, ...prev]);
    return newDeal;
  }, [deals.length]);

  const updateDeal = useCallback(async (id: string, updates: Partial<Deal>): Promise<void> => {
    await new Promise(r => setTimeout(r, 800));
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  const deleteDeal = useCallback(async (id: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 600));
    setDeals(prev => prev.filter(d => d.id !== id));
  }, []);

  const getDeal = useCallback((id: string) => deals.find(d => d.id === id), [deals]);

  return (
    <DealsContext.Provider value={{ deals, addDeal, updateDeal, deleteDeal, getDeal }}>
      {children}
    </DealsContext.Provider>
  );
}

export function useDeals() {
  const ctx = useContext(DealsContext);
  if (!ctx) throw new Error('useDeals must be used inside DealsProvider');
  return ctx;
}
