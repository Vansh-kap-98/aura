import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";

const DEMO_STORAGE_KEY = "mesh_demo_mode";

const DEMO_USER: Pick<User, "id" | "email"> = {
  id: "demo-user-id",
  email: "demo@syncro.app",
};

type AuthContextType = {
  session: Session | null;
  user: User | Pick<User, "id" | "email"> | null;
  loading: boolean;
  isDemoMode: boolean;
  demoLogin: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    // Restore demo mode across refreshes
    const storedDemo = localStorage.getItem(DEMO_STORAGE_KEY) === "true";
    if (storedDemo) {
      setIsDemoMode(true);
      setLoading(false);
      return;
    }

    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const demoLogin = () => {
    localStorage.setItem(DEMO_STORAGE_KEY, "true");
    setIsDemoMode(true);
  };

  const signOut = async () => {
    if (isDemoMode) {
      localStorage.removeItem(DEMO_STORAGE_KEY);
      setIsDemoMode(false);
      return;
    }
    if (supabaseConfigured) {
      await supabase.auth.signOut();
    }
    setSession(null);
  };

  const user = isDemoMode
    ? (DEMO_USER as User)
    : (session?.user ?? null);

  return (
    <AuthContext.Provider
      value={{ session, user, loading, isDemoMode, demoLogin, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>.");
  return ctx;
};
