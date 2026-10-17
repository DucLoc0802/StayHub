'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;
export function DialogContent({
  className,
  children,
  motion = 'dialog',
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  motion?: 'dialog' | 'sheet';
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="motion-backdrop fixed inset-0 z-50 bg-black/35 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          'motion-dialog fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-white p-6 shadow-xl',
          motion === 'sheet' && 'motion-sheet',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-md hover:bg-accent"
          aria-label="Đóng"
        >
          <X size={20} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
