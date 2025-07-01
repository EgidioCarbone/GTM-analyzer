import React, { createContext, useContext, useState } from "react";

export interface GTMContainer {
  tag?: any[];
  trigger?: any[];
  variable?: any[];
  containerId?: string;
  containerVersionId?: string;
  containerVersion?: { container?: { publicId?: string } };
}

interface Ctx {
  container: GTMContainer | null;
  setContainer: (c: GTMContainer | null) => void;
}

const ContainerContext = createContext<Ctx>({
  container: null,
  setContainer: () => {},
});

export function useContainer() {
  return useContext(ContainerContext);
}

export function ContainerProvider({ children }: { children: React.ReactNode }) {
  const [container, setContainer] = useState<GTMContainer | null>(null);
  return (
    <ContainerContext.Provider value={{ container, setContainer }}>
      {children}
    </ContainerContext.Provider>
  );
}