// A promise-based replacement for window.confirm, shown by the ConfirmDialog in the layout.
export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  // Marks an action that cannot be undone, such as a deletion.
  danger?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

export const confirmation = $state<{ request?: ConfirmRequest }>({});

export const confirmAction = (options: ConfirmOptions) =>
  new Promise<boolean>((resolve) => {
    // A newer question replaces one that is still open.
    confirmation.request?.resolve(false);
    confirmation.request = { ...options, resolve };
  });
