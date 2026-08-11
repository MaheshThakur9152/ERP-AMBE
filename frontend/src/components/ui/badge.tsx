import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'green' | 'yellow' | 'red' | 'slate' | 'blue';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'slate', children, ...props }) => {
  const variantClass = `badge-${variant}`;
  return (
    <span className={cn(variantClass, className)} {...props}>
      {children}
    </span>
  );
};
