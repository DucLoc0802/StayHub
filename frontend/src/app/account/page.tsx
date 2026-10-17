import { RequireAuth } from '@/components/require-auth';
import { AccountScreen } from '@/components/account-screen';
export default function Page() {
  return (
    <RequireAuth role="GUEST">
      <AccountScreen />
    </RequireAuth>
  );
}
