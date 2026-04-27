import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const location = useLocation();
  const [bootLoading, setBootLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    const finishBoot = () => setBootLoading(false);

    if (document.readyState === "complete") {
      const timer = window.setTimeout(finishBoot, 350);
      return () => window.clearTimeout(timer);
    }

    window.addEventListener("load", finishBoot, { once: true });
    const safetyTimer = window.setTimeout(finishBoot, 2500);

    return () => {
      window.removeEventListener("load", finishBoot);
      window.clearTimeout(safetyTimer);
    };
  }, []);

  useEffect(() => {
    if (bootLoading) return;
    setRouteLoading(true);
    const timer = window.setTimeout(() => setRouteLoading(false), 350);
    return () => window.clearTimeout(timer);
  }, [location.pathname, bootLoading]);

  const showLoading = bootLoading || routeLoading;

  return (
    <>
      <AnimatePresence>
        {showLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-background"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="flex items-end gap-2">
                {[0, 1, 2].map((index) => (
                  <motion.span
                    key={index}
                    animate={{ height: [14, 28, 14], opacity: [0.45, 1, 0.45] }}
                    transition={{ duration: 1, repeat: Infinity, delay: index * 0.14, ease: "easeInOut" }}
                    className="bg-foreground/80 block w-2 rounded-full"
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                <Loader2 className="h-4 w-4 animate-spin text-foreground/70" />
                <span>Loading Syncro</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Routes location={location} key={location.pathname}>
        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Auth routes */}
        <Route path="/login" element={<AuthPage defaultMode="login" />} />
        <Route path="/signup" element={<AuthPage defaultMode="signup" />} />

        {/* Protected dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-right" richColors closeButton />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
