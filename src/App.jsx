import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { LoginGate } from '@/components/LoginGate';
import { AppShell } from '@/components/AppShell';
import SalesDashboard from '@/pages/SalesDashboard';
import MarketingDashboard from '@/pages/MarketingDashboard';

export default function App() {
  const { authed, login } = useAuth();

  return (
    <TooltipProvider delayDuration={150}>
      {authed ? (
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/sales" element={<SalesDashboard />} />
              <Route path="/marketing" element={<MarketingDashboard />} />
              <Route path="*" element={<Navigate to="/sales" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      ) : (
        <LoginGate onLogin={login} />
      )}
    </TooltipProvider>
  );
}
