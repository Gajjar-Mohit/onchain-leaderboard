"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_APP_ID;
  const clientId = process.env.NEXT_PUBLIC_CLIENT_ID;

  if (!appId || !clientId) {
    console.error("APP_ID and CLIENT_ID must be set in environment variables.");
    return <div>Error: Missing APP_ID or CLIENT_ID</div>;
  }
  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
