import { createContext, useContext, useState } from 'react'

const ImpersonateContext = createContext(null)

export function ImpersonateProvider({ children }) {
  // Persist across refreshes so the preview role survives a reload
  const [impersonatedRole, setImpersonatedRoleState] = useState(
    () => sessionStorage.getItem('fp-impersonate') || null
  )

  function setImpersonatedRole(role) {
    if (role) {
      sessionStorage.setItem('fp-impersonate', role)
    } else {
      sessionStorage.removeItem('fp-impersonate')
    }
    setImpersonatedRoleState(role)
  }

  return (
    <ImpersonateContext.Provider value={{ impersonatedRole, setImpersonatedRole }}>
      {children}
    </ImpersonateContext.Provider>
  )
}

export function useImpersonate() {
  return useContext(ImpersonateContext)
}
