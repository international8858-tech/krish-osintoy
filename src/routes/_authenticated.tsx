import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "in" | "out">("loading");

  useEffect(() => {
    // Set up listener FIRST per Supabase guidance
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setState(s ? "in" : "out");
    });
    supabase.auth.getSession().then(({ data }) => {
      setState(data.session ? "in" : "out");
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (state === "out") navigate({ to: "/login" });
  }, [state, navigate]);

  if (state !== "in") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  return <Outlet />;
}
