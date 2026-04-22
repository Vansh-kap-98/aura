import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { SyncroLogo } from "@/components/SyncroLogo";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading, isDemoMode } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass shadow-float flex items-center gap-4 rounded-3xl px-8 py-5"
        >
          <div className="shadow-glow h-10 w-10 overflow-hidden rounded-2xl bg-white/70 p-0.5">
            <SyncroLogo className="h-full w-full" />
          </div>
          <div>
            <p className="text-sm font-semibold">Syncro</p>
            <p className="text-muted-foreground text-xs">Loading your workspace…</p>
          </div>
          <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </motion.div>
      </div>
    );
  }

  if (!session && !isDemoMode) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
