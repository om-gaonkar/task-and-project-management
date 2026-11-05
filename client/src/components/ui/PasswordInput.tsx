import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { Input } from './Input';

interface PasswordInputProps extends Omit<ComponentProps<typeof Input>, 'type'> {
  /** Accessible names for the toggle, for other languages later. */
  showLabel?: string;
  hideLabel?: string;
}

export function PasswordInput({
  className,
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-control text-fg-muted hover:text-fg"
      >
        {visible ? (
          <EyeOff aria-hidden className="size-4" />
        ) : (
          <Eye aria-hidden className="size-4" />
        )}
      </button>
    </div>
  );
}
