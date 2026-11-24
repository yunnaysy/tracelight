export type Chain = {
  id: number
  name: string
  short: string
  symbol: string
  color: string
  rpc: string
  /** Blockscout v2 base URL (no trailing slash) for address history; null when no free indexer is available */
  bs: string | null
  explorer: string
  cg: string
}

export const CHAINS: Chain[] = [
  { id: 1, name: 'Ethereum', short: 'ETH', symbol: 'ETH', color: '#5B6BD8', rpc: 'https://ethereum-rpc.publicnode.com', bs: 'https://eth.blockscout.com', explorer: 'https://etherscan.io', cg: 'ethereum' },
  { id: 8453, name: 'Base', short: 'BASE', symbol: 'ETH', color: '#1F5BFF', rpc: 'https://base-rpc.publicnode.com', bs: 'https://base.blockscout.com', explorer: 'https://basescan.org', cg: 'ethereum' },
  { id: 42161, name: 'Arbitrum', short: 'ARB', symbol: 'ETH', color: '#2D8BD6', rpc: 'https://arbitrum-one-rpc.publicnode.com', bs: 'https://arbitrum.blockscout.com', explorer: 'https://arbiscan.io', cg: 'ethereum' },
  { id: 10, name: 'Optimism', short: 'OP', symbol: 'ETH', color: '#E5383B', rpc: 'https://optimism-rpc.publicnode.com', bs: 'https://explorer.optimism.io', explorer: 'https://optimistic.etherscan.io', cg: 'ethereum' },
  { id: 137, name: 'Polygon', short: 'POL', symbol: 'POL', color: '#7B4FD6', rpc: 'https://polygon-bor-rpc.publicnode.com', bs: 'https://polygon.blockscout.com', explorer: 'https://polygonscan.com', cg: 'polygon-ecosystem-token' },
  { id: 56, name: 'BNB Chain', short: 'BNB', symbol: 'BNB', color: '#D9A400', rpc: 'https://bsc-rpc.publicnode.com', bs: null, explorer: 'https://bscscan.com', cg: 'binancecoin' },
  { id: 130, name: 'Unichain', short: 'UNI', symbol: 'ETH', color: '#E0479E', rpc: 'https://unichain-rpc.publicnode.com', bs: 'https://unichain.blockscout.com', explorer: 'https://uniscan.xyz', cg: 'ethereum' },
  { id: 324, name: 'zkSync Era', short: 'ZK', symbol: 'ETH', color: '#4E529A', rpc: 'https://mainnet.era.zksync.io', bs: 'https://zksync.blockscout.com', explorer: 'https://explorer.zksync.io', cg: 'ethereum' },
  { id: 534352, name: 'Scroll', short: 'SCR', symbol: 'ETH', color: '#B9874F', rpc: 'https://scroll-rpc.publicnode.com', bs: 'https://scrollscan.com', explorer: 'https://scrollscan.com', cg: 'ethereum' },
  { id: 100, name: 'Gnosis', short: 'GNO', symbol: 'xDAI', color: '#1E8A6E', rpc: 'https://gnosis-rpc.publicnode.com', bs: null, explorer: 'https://gnosisscan.io', cg: 'xdai' },
  { id: 43114, name: 'Avalanche', short: 'AVAX', symbol: 'AVAX', color: '#D6453D', rpc: 'https://avalanche-c-chain-rpc.publicnode.com', bs: null, explorer: 'https://snowtrace.io', cg: 'avalanche-2' },
]

/** Chains with a free keyless history source: Blockscout, or Binplorer (freekey) for BNB Chain. */
export const hasHistory = (c: Chain) => !!c.bs || c.id === 56
/** The five networks the watchlist polls. */
export const WATCH_CHAIN_IDS = [1, 8453, 42161, 56, 137]

export const chainById = (id: number | string) => CHAINS.find((c) => c.id === Number(id))
