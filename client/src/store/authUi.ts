import { create } from "zustand";

type PendingCart = { productPublicId: string; quantity: number } | null;

type AuthUiState = {
  loginOpen: boolean;
  pendingCart: PendingCart;
  openLogin: (pending?: PendingCart) => void;
  closeLogin: () => void;
};

export const useAuthUi = create<AuthUiState>((set) => ({
  loginOpen: false,
  pendingCart: null,
  openLogin: (pending) => set({ loginOpen: true, pendingCart: pending ?? null }),
  closeLogin: () => set({ loginOpen: false, pendingCart: null }),
}));
