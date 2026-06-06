import { createContext, useContext, useState } from 'react'

const ImpersonateContext = createContext(null)

export function ImpersonateProvider({ children }) {
  const [impersonatedRole, setImpersonatedRole] = useState(null)
  return (
    <ImpersonateContext.Provider value={{ impersonatedRole, setImpersonatedRole }}>
      {children}
    </ImpersonateContext.Provider>
  )
}

export function useImpersonate() {
  return useContext(ImpersonateContext)
}
