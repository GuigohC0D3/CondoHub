import { reactive } from 'vue';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((ok: boolean) => void) | null;
}

export const confirmState = reactive<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Confirmar',
  cancelLabel: 'Cancelar',
  destructive: false,
  resolve: null,
});

/** Abre um diálogo de confirmação e resolve com true/false. */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Object.assign(confirmState, {
      open: true,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      destructive: false,
      ...opts,
      resolve,
    });
  });
}

export function settleConfirm(ok: boolean) {
  confirmState.open = false;
  confirmState.resolve?.(ok);
  confirmState.resolve = null;
}
