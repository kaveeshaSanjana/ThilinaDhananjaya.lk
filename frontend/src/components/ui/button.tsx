import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-[1px] active:[border-bottom-width:2px]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-[1.5px] border-primary [border-bottom-width:4px] [border-bottom-color:hsl(var(--primary-dark))] hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground border-[1.5px] border-destructive [border-bottom-width:4px] [border-bottom-color:hsl(var(--destructive-dark))] hover:brightness-110",
        outline:
          "border-[1.5px] border-border bg-card text-foreground [border-bottom-width:4px] hover:border-primary hover:[border-bottom-color:hsl(var(--primary-dark))] hover:text-primary",
        secondary:
          "bg-secondary text-secondary-foreground border-[1.5px] border-border [border-bottom-width:4px] hover:border-primary hover:[border-bottom-color:hsl(var(--primary-dark))] hover:text-primary",
        ghost: "rounded-xl hover:bg-primary/10 hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
        success:
          "bg-success text-success-foreground border-[1.5px] border-success [border-bottom-width:4px] [border-bottom-color:hsl(var(--success-dark))] hover:brightness-110",
        accent:
          "bg-accent text-accent-foreground border-[1.5px] border-accent [border-bottom-width:4px] [border-bottom-color:hsl(var(--accent-dark))] hover:brightness-105",
        danger:
          "bg-destructive text-destructive-foreground border-[1.5px] border-destructive [border-bottom-width:4px] [border-bottom-color:hsl(var(--destructive-dark))] hover:brightness-110",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3 [border-bottom-width:3px]",
        lg: "h-12 rounded-2xl px-8 text-base",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
