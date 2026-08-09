import { useEffect, useState } from 'react';
import * as authApi from '../api/authApi';
import type { DemoAccount } from '../api/authApi';

/**
 * Guest logins served by GET /api/auth/demo-accounts, or an empty list when
 * they haven't been seeded (`npm run seed:demo`) or the API is unreachable.
 *
 * Its own module (rather than living beside DemoLoginPanel) because LoginPage
 * needs the count before it renders: with demo accounts it lays out two
 * columns, without them it falls back to the plain single-column login card.
 */
export function useDemoAccounts() {
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);

  useEffect(() => {
    let active = true;
    authApi
      .getDemoAccounts()
      .then((list) => {
        if (active) setAccounts(list);
      })
      // Demo logins are a convenience: if the endpoint is unreachable the
      // section simply stays hidden rather than shouting at the user.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return accounts;
}
