import { useSyncExternalStore } from 'react'
import { AGENT_EVENT, getAgentName } from './auth'

const subscribe = (cb) => {
  window.addEventListener(AGENT_EVENT, cb)
  return () => window.removeEventListener(AGENT_EVENT, cb)
}

export default function useAgentName() {
  return useSyncExternalStore(subscribe, getAgentName, getAgentName)
}
