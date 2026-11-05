import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  className?: string;
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = [words[0], words.length > 1 ? words[words.length - 1] : undefined]
    .map((word) => (word ? Array.from(word)[0] : ''))
    .join('');
  return (letters || '?').toUpperCase();
}

/** Decorative: the person's name is always available next to it or on the control around it. */
export function Avatar({ name, imageUrl, className }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;

  return (
    <span
      aria-hidden
      className={cn(
        'grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-fg',
        className,
      )}
    >
      {showImage ? (
        <img
          src={imageUrl ?? undefined}
          alt=""
          // The picture is hosted by Google. Not sending a referrer keeps our URLs out of their logs.
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(imageUrl ?? null)}
          className="size-full object-cover"
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
