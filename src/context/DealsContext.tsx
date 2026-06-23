import React, { createContext, useContext, useState, useCallback } from 'react';
import { Deal } from '../types';
import { mockDeals } from '../data/mockData';

const DEALS_KEY = 'rfpulse_deals';

function loadDeals(): Deal[] {
  try {
    const raw = localStorage.getItem(DEALS_KEY);
    if (raw) return JSON.parse(raw) as Deal[];
  } catch { /* ignore */ }
  return mockDeals;
}

function saveDeals(deals: Deal[]) {
  localStorage.setItem(DEALS_KEY, JSON.stringify(deals));
}

function nextDealId(deals: Deal[]): string {
  const max = deals.reduce((acc, d) => {
    const n = parseInt(d.id.replace('D-', ''), 10);
    return isNaN(n) ? acc : Math.max(acc, n);
  }, 0);
  return `D-${String(max + 1).padStart(3, '0')}`;
}

interface DealsContextType {
  deals: Deal[];
  addDeal: (deal: Omit<Deal, 'id' | 'createdAt'>) => Promise<Deal>;
  updateDeal: (id: string, updates: Partial<Deal>) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;
  getDeal: (id: string) => Deal | undefined;
}

const DealsContext = createContext<DealsContextType | null>(null);

export function DealsProvider({ children }: { children: React.ReactNode }) {
  const [deals, setDeals] = useState<Deal[]>(loadDeals);

  const addDeal = useCallback(async (deal: Omit<Deal, 'id' | 'createdAt'>): Promise<Deal> => {
    await new Promise(r => setTimeout(r, 800));
    let newDeal!: Deal;
    setDeals(prev => {
      newDeal = {
        ...deal,
        id: nextDealId(prev),
        createdAt: new Date().toISOString().split('T')[0],
      };
      const next = [newDeal, ...prev];
      saveDeals(next);
      return next;
    });
    return newDeal;
  }, []);

  const updateDeal = useCallback(async (id: string, updates: Partial<Deal>): Promise<void> => {
    await new Promise(r => setTimeout(r, 800));
    setDeals(prev => { const next = prev.map(d => d.id === id ? { ...d, ...updates } : d); saveDeals(next); return next; });
  }, []);

  const deleteDeal = useCallback(async (id: string): Promise<void> => {
    await new Promise(r => setTimeout(r, 600));
    setDeals(prev => { const next = prev.filter(d => d.id !== id); saveDeals(next); return next; });
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
