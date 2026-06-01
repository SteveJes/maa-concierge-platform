"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRoot() {
  const router = useRouter();
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("dubub_admin_token") : null;
    router.replace(token ? "/admin/portal" : "/admin/login");
  }, [router]);
  return null;
}
