import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Deal } from '../types';
import { dealsApi } from '../api';

interface DealsContextType {
  deals: Deal[];
  loading: boolean;
  addDeal: (deal: Omit<Deal, 'id' | 'createdAt'>) => Promise<Deal>;
  updateDeal: (id: string, updates: Partial<Deal>) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;
  getDeal: (id: string) => Deal | undefined;
  refreshDeals: () => Promise<void>;
}

const DealsContext = createContext<DealsContextType | null>(null);

export function DealsProvider({ children }: { children: React.ReactNode }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshDeals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dealsApi.getAll();
      setDeals(data);
    } catch (err) {
      console.error('Failed to load deals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshDeals();
  }, [refreshDeals]);

  const addDeal = useCallback(async (deal: Omit<Deal, 'id' | 'createdAt'>): Promise<Deal> => {
    const newDeal = await dealsApi.create(deal);
    await refreshDeals();
    return newDeal as Deal;
  }, [refreshDeals]);

  const updateDeal = useCallback(async (id: string, updates: Partial<Deal>): Promise<void> => {
    await dealsApi.update(id, updates);
    await refreshDeals();
  }, [refreshDeals]);

  const deleteDeal = useCallback(async (id: string): Promise<void> => {
    await dealsApi.delete(id);
    await refreshDeals();
  }, [refreshDeals]);

  const getDeal = useCallback((id: string) => deals.find(d => d.id === id), [deals]);

  return (
    <DealsContext.Provider value={{ deals, loading, addDeal, updateDeal, deleteDeal, getDeal, refreshDeals }}>
      {children}
    </DealsContext.Provider>
  );
}

export function useDeals() {
  const ctx = useContext(DealsContext);
  if (!ctx) throw new Error('useDeals must be used inside DealsProvider');
  return ctx;
}
