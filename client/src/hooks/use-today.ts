import { useEffect, useState } from 'react';
import { msUntilNextMidnight } from '@/lib/date';

/** Today's date, refreshed just after local midnight so a tab left open never shows yesterday. */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setTimeout(() => setToday(new Date()), msUntilNextMidnight(today) + 1000);
    return () => window.clearTimeout(timer);
  }, [today]);

  return today;
}
