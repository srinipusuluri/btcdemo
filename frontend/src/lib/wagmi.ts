import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, hardhat } from 'wagmi/chains'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

export const config = createConfig({
  chains: [mainnet, sepolia, hardhat],
  connectors: [
    injected(),
    metaMask(),
    walletConnect({ projectId }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [hardhat.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
