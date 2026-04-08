import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import api from "../lib/api";
import { useAuth } from "./AuthContext";

export interface Institute {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  themeColor?: string;
  address?: string;
  phone?: string;
  description?: string;
  isOwner: boolean;
  _count?: { users: number; classes: number };
}

interface InstituteContextType {
  institutes: Institute[];
  selected: Institute | null;
  loading: boolean;
  select: (id: string) => void;
  refresh: () => Promise<void>;
  hasInstitute: boolean;
}

const InstituteContext = createContext<InstituteContextType>({
  institutes: [],
  selected: null,
  loading: false,
  select: () => {},
  refresh: async () => {},
  hasInstitute: false,
});

export function InstituteProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [selected, setSelected] = useState<Institute | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Institute[]>("/institutes/my");
      setInstitutes(data);

      const stored = localStorage.getItem("selectedInstituteId");
      const match = stored ? data.find((i) => i.id === stored) ?? null : null;
      setSelected(match);
      if (match) {
        localStorage.setItem("selectedInstituteId", match.id);
      } else {
        localStorage.removeItem("selectedInstituteId");
      }
    } catch {
      setInstitutes([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token || user?.role !== "ADMIN") {
      setInstitutes([]);
      setSelected(null);
      setLoading(false);
      return;
    }

    load();
  }, [load, token, user?.id, user?.role]);

  const select = (id: string) => {
    const inst = institutes.find((i) => i.id === id);
    if (inst) {
      setSelected(inst);
      localStorage.setItem("selectedInstituteId", id);
    }
  };

  return (
    <InstituteContext.Provider
      value={{ institutes, selected, loading, select, refresh: load, hasInstitute: institutes.length > 0 }}
    >
      {children}
    </InstituteContext.Provider>
  );
}

export function useInstitute() {
  return useContext(InstituteContext);
}
