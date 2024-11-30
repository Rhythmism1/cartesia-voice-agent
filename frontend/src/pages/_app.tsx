import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useState } from "react";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login"); // Redirect to login if no token
    } else {
      setIsAuthenticated(true); // User is authenticated
    }
  }, [router]);

  if (!isAuthenticated) {
    return <div>Loading...</div>; // Avoid rendering SPA before auth check
  }

  return <>{children}</>;
}
export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      {/* Add route protection */}
      {["/login", "/register"].includes(Component.name) ? (
        <Component {...pageProps} />
      ) : (
        <ProtectedRoute>
          <Component {...pageProps} />
        </ProtectedRoute>
      )}
    </AuthProvider>
  );
}
