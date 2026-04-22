import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const resolveMainAppUrl = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const fromQuery = searchParams.get("mainAppUrl")?.trim();
  if (fromQuery && /^https?:\/\//i.test(fromQuery)) {
    return fromQuery.replace(/\/$/, "");
  }

  try {
    const fromReferrer = new URL(document.referrer).origin;
    if (fromReferrer && /^https?:\/\//i.test(fromReferrer)) {
      return fromReferrer.replace(/\/$/, "");
    }
  } catch {
    // Ignore invalid or empty referrer.
  }

  if (window.location.port === "8081") {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }

  return window.location.origin.replace(/\/$/, "");
};

const NotFound = () => {
  const location = useLocation();
  const mainAppUrl = resolveMainAppUrl();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href={`${mainAppUrl}/`} target="_top" rel="noreferrer" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
