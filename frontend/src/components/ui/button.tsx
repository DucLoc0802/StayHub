import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const buttonVariants = cva(
  'motion-button inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'motion-button-primary bg-primary text-primary-foreground hover:bg-primary-hover',
        outline:
          'border border-border bg-white hover:bg-accent text-foreground',
        ghost: 'hover:bg-accent text-foreground',
        destructive: 'bg-destructive text-white hover:opacity-90',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-3',
        lg: 'h-13 px-7',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
