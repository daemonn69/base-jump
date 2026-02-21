"use client";
import { useState, useEffect } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { useMiniApp } from "./providers/MiniAppProvider";
import BaseJumpGame from "./components/BaseJumpGame";
import styles from "./page.module.css";

interface AuthResponse {
  success: boolean;
  user?: {
    fid: number;
    issuedAt?: number;
    expiresAt?: number;
  };
  message?: string;
}

export default function Home() {
  const { context, isReady } = useMiniApp();
  const [authData, setAuthData] = useState<AuthResponse | null>(null);

  useEffect(() => {
    const authenticate = async () => {
      try {
        const response = await sdk.quickAuth.fetch('/api/auth');
        const data = await response.json();
        setAuthData(data);
      } catch (err) {
        console.error(err);
      }
    };

    if (isReady) {
      authenticate();
    }
  }, [isReady]);

  return (
    <main className={styles.mainContainer}>
      <BaseJumpGame userFid={authData?.user?.fid || context?.user?.fid} />
    </main>
  );
}
