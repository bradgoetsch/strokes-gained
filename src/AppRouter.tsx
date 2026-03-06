import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { AppLayout } from "./components/AppLayout";

import Dashboard from "./pages/Dashboard";
import NewRound from "./pages/NewRound";
import EditRound from "./pages/EditRound";
import RoundDetail from "./pages/RoundDetail";
import History from "./pages/History";
import Stats from "./pages/Stats";
import Profile from "./pages/Profile";
import { NIP19Page } from "./pages/NIP19Page";
import NotFound from "./pages/NotFound";

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route
          path="/"
          element={
            <AppLayout>
              <Dashboard />
            </AppLayout>
          }
        />
        <Route
          path="/round/new"
          element={
            <AppLayout>
              <NewRound />
            </AppLayout>
          }
        />
        <Route
          path="/round/:roundId"
          element={
            <AppLayout>
              <RoundDetail />
            </AppLayout>
          }
        />
        <Route
          path="/round/:roundId/edit"
          element={
            <AppLayout>
              <EditRound />
            </AppLayout>
          }
        />
        <Route
          path="/history"
          element={
            <AppLayout>
              <History />
            </AppLayout>
          }
        />
        <Route
          path="/stats"
          element={
            <AppLayout>
              <Stats />
            </AppLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <AppLayout>
              <Profile />
            </AppLayout>
          }
        />
        {/* NIP-19 route for npub1, note1, naddr1, nevent1, nprofile1 */}
        <Route path="/:nip19" element={<NIP19Page />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
