import { create } from 'zustand';

type AppUiState = {
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;
  toggleGlobalSearch: () => void;
};

export const useAppUiStore = create<AppUiState>((set) => ({
  globalSearchOpen: false,
  setGlobalSearchOpen: (globalSearchOpen) => set({ globalSearchOpen }),
  toggleGlobalSearch: () => set((s) => ({ globalSearchOpen: !s.globalSearchOpen })),
}));
