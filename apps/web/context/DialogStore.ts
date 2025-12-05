'use client';

import { create } from 'zustand';

export interface DialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

interface DialogStore {
  dialog: DialogState;
  openDialog: (config: Omit<DialogState, 'isOpen'>) => void;
  closeDialog: () => void;
  setLoading: (loading: boolean) => void;
}

export const useDialogStore = create<DialogStore>((set) => ({
  dialog: {
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    isDangerous: false,
    isLoading: false,
  },
  openDialog: (config) =>
    set({
      dialog: {
        isOpen: true,
        title: config.title,
        message: config.message,
        confirmText: config.confirmText || 'Confirm',
        cancelText: config.cancelText || 'Cancel',
        isDangerous: config.isDangerous || false,
        onConfirm: config.onConfirm,
        onCancel: config.onCancel,
        isLoading: false,
      },
    }),
  closeDialog: () =>
    set((state) => ({
      dialog: { ...state.dialog, isOpen: false },
    })),
  setLoading: (loading) =>
    set((state) => ({
      dialog: { ...state.dialog, isLoading: loading },
    })),
}));
