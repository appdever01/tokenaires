"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { useCopy } from "@/hooks/use-copy";
import { JOIN_TOAST, SITE } from "@/lib/constants";

export function useJoin() {
  const router = useRouter();
  const { copied, copy } = useCopy({ silent: true });

  const join = useCallback(async () => {
    const ok = await copy(SITE.installCommand);
    const onGuide = window.location.pathname === "/how-it-works";
    const action = onGuide ? undefined : { label: "How it works", onClick: () => router.push("/how-it-works") };
    if (ok) {
      toast.success(JOIN_TOAST.copiedTitle, { id: JOIN_TOAST.id, description: JOIN_TOAST.copiedDescription, action });
    } else {
      toast.info(JOIN_TOAST.manualTitle, { id: JOIN_TOAST.id, description: JOIN_TOAST.manualDescription, action });
    }
  }, [copy, router]);

  return { copied, join };
}
