import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { buttonStyles, type ButtonVariant } from './button-styles';

interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children' | 'aria-label'> {
  /** Required: icon-only buttons need an accessible name. Also shown as the tooltip. */
  label: string;
  icon: LucideIcon;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}

export function IconButton({
  label,
  icon: Icon,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={buttonStyles({
        variant,
        className: cn(size === 'sm' ? 'size-8 px-0' : 'size-9 px-0', className),
      })}
      {...props}
    >
      <Icon aria-hidden className="size-[1.125rem]" />
    </button>
  );
}
