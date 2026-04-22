import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { SyncroLogo } from "@/components/SyncroLogo";

type Mode = "login" | "signup";

const getUserFriendlyError = (message: string, mode: Mode): string => {
  if (message.includes("Invalid login credentials"))
    return "Those credentials don't match. Check your email and password.";
  if (message.includes("Email not confirmed"))
    return "Please verify your email before signing in.";
  if (message.includes("User already registered"))
    return "An account with this email already exists. Try signing in.";
  if (message.includes("Password should be at least"))
    return "Password must be at least 6 characters.";
  if (message.includes("Unable to validate email address"))
    return "Please enter a valid email address.";
  if (message.includes("For security purposes"))
    return "Too many attempts. Please wait a moment and try again.";
  return message;
};

interface AuthPageProps {
  defaultMode?: Mode;
}

export default function AuthPage({ defaultMode = "login" }: AuthPageProps) {
  const { session, loading, isDemoMode, demoLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sync mode with route
  useEffect(() => {
    setMode(location.pathname === "/signup" ? "signup" : "login");
  }, [location.pathname]);

  // Redirect if already authenticated (real session or demo mode)
  useEffect(() => {
    if (!loading && (session || isDemoMode)) {
      navigate("/dashboard", { replace: true });
    }
  }, [session, isDemoMode, loading, navigate]);

  const handleDemoLogin = () => {
    demoLogin();
    toast.success("Demo mode activated! 🎉", {
      description: "Exploring Syncro with a sample workspace.",
    });
    navigate("/dashboard", { replace: true });
  };

  const clearForm = () => {
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "signup" && password !== confirmPassword) {
      toast.error("Passwords don't match.", {
        description: "Make sure both fields are identical.",
      });
      return;
    }

    if (password.length < 6) {
      toast.error("Password too short.", {
        description: "Use at least 6 characters.",
      });
      return;
    }

    setSubmitting(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welcome back!", {
          description: "You're signed in to Syncro.",
        });
        navigate("/dashboard", { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Account created!", {
          description:
            "Check your inbox to verify your email, then sign in.",
        });
        clearForm();
        setMode("login");
        navigate("/login", { replace: true });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      toast.error(getUserFriendlyError(message, mode));
      clearForm();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  const switchMode = mode === "login" ? "signup" : "login";
  const switchLabel =
    mode === "login" ? "Create an account" : "Sign in instead";
  const switchPrompt =
    mode === "login" ? "New to Syncro?" : "Already have an account?";

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center p-4">
      {/* Decorative ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative w-full max-w-md"
      >
        {/* Brand header */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05, rotate: -5 }}
            transition={{ type: "spring", stiffness: 400 }}
            className="shadow-glow h-14 w-14 overflow-hidden rounded-2xl bg-white/70 p-0.5"
          >
            <SyncroLogo className="h-full w-full" />
          </motion.div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Syncro</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Your team's shared operating space
            </p>
          </div>
        </div>

        {/* Glass card */}
        <div className="glass-strong shadow-float overflow-hidden rounded-3xl p-8">
          {/* Mode toggle */}
          <div className="glass mb-8 flex gap-1 rounded-2xl p-1">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  navigate(m === "login" ? "/login" : "/signup", {
                    replace: true,
                  });
                  clearForm();
                }}
                className={cn(
                  "relative flex-1 rounded-xl py-2.5 text-sm font-medium transition-all duration-200",
                  mode === m
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {mode === m && (
                  <motion.span
                    layoutId="activeTab"
                    className="bg-gradient-primary shadow-glow absolute inset-0 rounded-xl"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative">
                  {m === "login" ? "Sign In" : "Sign Up"}
                </span>
              </button>
            ))}
          </div>

          {/* Heading */}
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="mb-6"
            >
              <h2 className="text-xl font-semibold">
                {mode === "login" ? "Welcome back 👋" : "Join your team 🚀"}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {mode === "login"
                  ? "Sign in to pick up where you left off."
                  : "Create an account to get started."}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email */}
            <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all focus-within:ring-2 focus-within:ring-primary/40">
              <Mail
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={2}
              />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="placeholder:text-muted-foreground/60 w-full bg-transparent text-sm outline-none"
              />
            </div>

            {/* Password */}
            <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all focus-within:ring-2 focus-within:ring-primary/40">
              <Lock
                className="h-4 w-4 shrink-0 text-muted-foreground"
                strokeWidth={2}
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="placeholder:text-muted-foreground/60 w-full bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={2} />
                )}
              </button>
            </div>

            {/* Confirm password — signup only */}
            <AnimatePresence>
              {mode === "signup" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all focus-within:ring-2 focus-within:ring-primary/40">
                    <User
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      strokeWidth={2}
                    />
                    <input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      required={mode === "signup"}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="placeholder:text-muted-foreground/60 w-full bg-transparent text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                    >
                      {showConfirm ? (
                        <EyeOff className="h-4 w-4" strokeWidth={2} />
                      ) : (
                        <Eye className="h-4 w-4" strokeWidth={2} />
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              whileHover={{ scale: submitting ? 1 : 1.015 }}
              whileTap={{ scale: submitting ? 1 : 0.97 }}
              type="submit"
              disabled={submitting}
              className="bg-gradient-primary text-primary-foreground shadow-glow mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold transition-opacity disabled:opacity-70"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              <span>
                {submitting
                  ? mode === "login"
                    ? "Signing in…"
                    : "Creating account…"
                  : mode === "login"
                    ? "Sign in to Syncro"
                    : "Create my account"}
              </span>
              {!submitting && (
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="relative my-5 flex items-center gap-3">
            <div className="border-border h-px flex-1 border-t" />
            <span className="text-muted-foreground text-xs font-medium">or</span>
            <div className="border-border h-px flex-1 border-t" />
          </div>

          {/* Demo login */}
          <motion.button
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={handleDemoLogin}
            className="glass hover:bg-muted/60 border-border flex w-full items-center justify-center gap-2.5 rounded-2xl border py-3.5 text-sm font-medium transition-all"
          >
            <span className="bg-gradient-accent shadow-glow grid h-5 w-5 place-items-center rounded-md">
              <Zap className="h-3 w-3 text-white" strokeWidth={2.5} fill="white" />
            </span>
            <span>Continue as Demo</span>
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">
              No account needed
            </span>
          </motion.button>

          {/* Switch mode link */}
          <p className="text-muted-foreground mt-5 text-center text-sm">
            {switchPrompt}{" "}
            <Link
              to={`/${switchMode}`}
              onClick={() => {
                setMode(switchMode);
                clearForm();
              }}
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              {switchLabel}
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-muted-foreground mt-6 text-center text-xs">
          By continuing, you agree to Syncro's{" "}
          <span className="underline-offset-2 hover:underline cursor-pointer">
            Terms of Service
          </span>{" "}
          and{" "}
          <span className="underline-offset-2 hover:underline cursor-pointer">
            Privacy Policy
          </span>
          .
        </p>
      </motion.div>
    </div>
  );
}
