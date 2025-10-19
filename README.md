# Escrow Marketplace

A multi-escrow marketplace with resilient background indexer for processing on-chain events. Built with Solidity, Next.js, PostgreSQL, Redis, and BullMQ.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [API Documentation](#api-documentation)
- [Technical Implementation](#🧩-technical-implementation)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

- **Multi-Escrow Support**: Deploy and manage multiple escrow contracts
- **On-Chain Event Ingestion**: Real-time WebSocket subscription to blockchain events
- **Resilient Processing**: Queue-based event processing with retry logic and exponential backoff
- **Admin Dashboard**: Health monitoring for queue depth and processing status
- **Status Filtering**: Filter escrows by Pending, Funded, Confirmed, Cancelled, TimedOut
- **Test Block Mining**: Developer tools for local testing
- **Dead Letter Queue**: Failed jobs are tracked and can be retried

## 🛠 Tech Stack

### Smart Contracts
- **Solidity**: ^0.8.24
- **Foundry**: Testing and deployment framework
- **OpenZeppelin Contracts**: v5.0.2

### Frontend
- **Next.js**: 14 (App Router)
- **TypeScript**: 5.4
- **wagmi**: 2.0 (Blockchain interactions)
- **viem**: 2.0 (Ethereum primitives)
- **zod**: Schema validation
- **Tailwind CSS**: Styling
- **TanStack Query**: Data fetching

### Backend Services
- **PostgreSQL**: 15 (Main database)
- **Redis**: 7 (Queue and caching)
- **BullMQ**: 5 (Queue management)
- **Prisma**: 5.x (ORM)

### Development Tools
- **Foundry**: Smart contract testing
- **Playwright**: E2E testing
- **ESLint**: 9 (Code linting)

## 🏗 Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Indexer        │    │   Database      │
│   (Next.js)     │◄──►│   Service        │◄──►│   (PostgreSQL)  │
│                 │    │   (Node.js)      │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────────────┐
                    │   Blockchain       │
                    │   (Foundry/Anvil)  │
                    └────────────────────┘
```

### Data Flow

1. **Buyer deploys escrow contract** → On-chain deployment event
2. **Frontend registers escrow** → Stores in database via API
3. **Indexer monitors events** → WebSocket subscription
4. **Events queued** → BullMQ with Redis
5. **Worker processes events** → Updates database with status changes

## 📋 Prerequisites

- **Node.js**: 18+ (with npm or yarn)
- **Foundry**: Latest version (`curl -L https://foundry.paradigm.xyz | bash`)
- **PostgreSQL**: 15+
- **Redis**: 7+
- **Docker** (optional, for local development)

## 🚀 Setup & Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd escrow-marketplace
```

### 2. Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc  # or ~/.zshrc
foundryup
```

### 3. Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Indexer
cd ../indexer
npm install
```

### 4. Database Setup

```bash
# Start PostgreSQL (local or Docker)
docker run --name postgres -e POSTGRES_PASSWORD=password -d -p 5432:5432 postgres:15

# Create database
createdb escrow_db

# Run migrations
cd frontend
npx prisma migrate dev
```

### 5. Redis Setup

```bash
# Start Redis (local or Docker)
docker run --name redis -d -p 6379:6379 redis:7
```

### 6. Environment Configuration

Create `.env` files in `frontend` and `indexer` directories:

```env
# frontend/.env
DATABASE_URL="postgresql://username:password@localhost:5432/escrow_db"

# indexer/.env
DATABASE_URL="postgresql://username:password@localhost:5432/escrow_db"
REDIS_URL="redis://localhost:6379"
RPC_URL="http://localhost:8545"
WS_URL="ws://localhost:8545"
```

### 7. Start Local Blockchain

```bash
# Terminal 1: Start Foundry's Anvil
anvil

# Terminal 2: Deploy contracts
cd escrow-marketplace
forge script script/Escrow.s.sol --rpc-url http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Terminal 3: Start indexer service
cd indexer
npm run dev

# Terminal 4: Start frontend
cd frontend
npm run dev  # Opens at http://localhost:3000
```

## 💡 Usage Guide

### Complete Escrow Workflow

Here's how to use the escrow marketplace system:

#### 1. Deploy an Escrow Contract

Buyers deploy their own escrow contracts:

```bash
# Via frontend interface (buyer wallet connected)
# Set parameters:
- Seller address: 0x742d35Cc6634C0532925a3b844552c4ea8c
- Token address: ERC20 contract (e.g., USDC: 0xA0b86a33E6441c7c5F8DD74E7a1b8FbaE3F5Fc)
- Amount: 1000000000 (1000 USDC with 6 decimals)
- Timeout: 24 hours from deployment
# Click "Create Escrow"
# Contract deployed → receives address like: 0xABC123...
```

#### 2. Register in Marketplace

Register the escrow in the database:

```bash
# Automatic via frontend, or manual API call:
POST /api/escrows/register
{
  "address": "0xABC123...",
  "seller": "0x742d35Cc6634C0532925a3b844552c4ea8c",
  "buyer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "token": "0xA0b86a33E6441c7c5F8DD74E7a1b8FbaE3F5Fc",
  "amount": "1000000000",
  "timeout": 1672531200
}
```

#### 3. Browse Marketplace

Visit http://localhost:3000 to see all registered escrows:

```
┌─────────────────────────────────────────────────────┐
│ Escrow Marketplace                                  │
├─────────────────────────────────────────────────────┤
│ Address: 0xABC123... │ Seller: 0x742d... │ Amount: │
│ Status: Pending      │ Buyer: 0xf39F...  │ 1000 USDC│
│ Created: 2025-10-19  │                     │ Pending │
├─────────────────────────────────────────────────────┤
│ [Filter: All ▼] [Mine Block] [Refresh]             │
└─────────────────────────────────────────────────────┘
```

#### 4. Fund the Escrow

Buyer transfers tokens to lock in escrow:

```bash
# Buyer connects wallet → clicks "Fund" → approves transaction
# On-chain: buyer → escrow.fund() → tokens locked in contract
# Indexer catches "Funded" event → updates database status to "Funded"
```

#### 5. Seller Confirms Delivery

After providing service/product:

```bash
# Seller connects wallet → clicks "Confirm" → signs transaction
# On-chain: seller → escrow.confirm() → emits "ConfirmedBySeller" event
# Indexer processes → database status: "Confirmed"
# Both parties can now withdraw funds
```

#### 6. Withdraw Funds

Claim settlement:

```bash
# Seller clicks "Withdraw" → receives 1000 USDC
# Transaction: escrow.withdraw() → seller receives full amount
# Escrow contract status: Completed
```

#### 7. Handle Special Cases

**Timeout Scenario:**
- After 24 hours if no confirmation
- Buyer can call `cancelByBuyer()` → status becomes "TimedOut"
- Buyer withdraws locked funds back

**Cancellation:**
- Seller can cancel before funding → status "Cancelled"
- Buyer can withdraw cancelled funds back

#### 8. Monitor System Health

Check admin dashboard for system status:

```bash
GET /admin/health
{
  "status": "healthy",
  "queueDepth": 5,        // Active jobs in queue
  "lastProcessedBlock": 12345678,
  "processedToday": 45    // Events processed today
}
```

### Queue System Features

- **Automatic Retry**: Failed jobs retry with exponential backoff
- **Dead Letter Queue**: Persistent failures tracked in database
- **Real-time Monitoring**: WebSocket blocks + polling for reliability
- **Scalable Workers**: Multiple workers process events in parallel

### Test Utilities

```bash
# Mine test blocks to simulate blockchain activity
POST /api/test/mine-block

# Forces indexer to scan for events
# Useful for testing timeout scenarios
```

### Scaling Multiple Escrows

The system handles concurrent escrows efficiently:

```
50+ active escrows → Indexer processes in parallel
Queue depth <50 → Events processed within seconds
Database tracks all states → Frontend shows real-time updates
Failed jobs retried → No missed events
```

## 🧩 Technical Implementation

### Smart Contracts - Foundry & Solidity

**Contract Deployment:**
```solidity
// src/Escrow.sol - Core escrow logic
contract Escrow is Ownable {
    enum Status { Pending, Funded, Confirmed, Cancelled, TimedOut }

    function fund() external onlyBuyer inStatus(Status.Pending) {
        token.safeTransferFrom(msg.sender, address(this), amount);
        status = Status.Funded;
        emit Funded(msg.sender, amount);
    }
}
```

**Testing:**
```solidity
// test/Escrow.t.sol - Foundry tests
contract EscrowTest is Test {
    function test_Fund() public {
        escrow.fund();
        assertEq(uint(Escrow.Status.Funded), uint(escrow.status()));
    }
}
```

### Frontend - Next.js & wagmi

**Wallet Connection:**
```typescript
// src/lib/wagmi.ts - Configuration
export const config = createConfig({
  chains: [mainnet, sepolia, hardhat],
  connectors: [injected(), metaMask(), walletConnect({ projectId })],
})

// src/app/layout.tsx - Provider setup
<WagmiProvider config={config}>
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
</WagmiProvider>
```

**Blockchain Interactions:**
```typescript
// In React components
const { writeContract } = useWriteContract()

function fundEscrow() {
  writeContract({
    address: escrowAddress,
    abi: escrowABI,
    functionName: 'fund',
    args: []
  })
}
```

### Database - Prisma & PostgreSQL

**Schema Definition:**
```prisma
// prisma/schema.prisma - Database models
model Escrow {
  id        String   @id @default(cuid())
  address   String   @unique
  status    String   // Pending, Funded, Confirmed...
}

model QueueJob {
  id          String   @id @default(cuid())
  status      String   // queued, processing, completed, failed
  retryCount  Int      @default(0)
  @@unique([blockNumber, logIndex])
}
```

**Database Operations:**
```typescript
// API routes (src/app/api/escrows/route.ts)
import { prisma } from '@/lib/prisma'

export async function GET() {
  const escrows = await prisma.escrow.findMany({
    where: { status: 'Funded' },
    orderBy: { createdAt: 'desc' }
  })
  return Response.json(escrows)
}
```

### Queue System - BullMQ & Redis

**Queue Configuration:**
```typescript
// indexer/src/index.ts - BullMQ setup
const queue = new Queue('escrow-events', { connection: redis })

// Add job to queue
await queue.add('process-event', {
  eventType: 'Funded',
  escrowAddress: '0xABC123...'
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 }
})
```

**Worker Implementation:**
```typescript
// Event processing worker
const worker = new Worker('escrow-events', async (job) => {
  const { eventType, escrowAddress } = job.data

  if (eventType === 'Funded') {
    await prisma.escrow.update({
      where: { address: escrowAddress },
      data: { status: 'Funded' }
    })
  }
})
```

### Indexer - Web3.js & Node.js

**WebSocket Subscription:**
```typescript
// indexer/src/index.ts - Block monitoring
const wsWeb3 = new Web3(new Web3.providers.WebsocketProvider(env.WS_URL))

wsWeb3.eth.subscribe('newBlockHeaders', async (error, blockHeader) => {
  const blockNumber = blockHeader.number
  await indexBlockRange(lastBlock + 1, blockNumber)
})
```

**Event Processing:**
```typescript
// Transaction receipt analysis
const receipt = await web3.eth.getTransactionReceipt(tx.hash)
for (const log of receipt.logs) {
  if (log.address === escrowAddress) {
    const eventSignature = log.topics[0]
    if (eventSignature === fundedEventSignature) {
      // Process Funded event
    }
  }
}
```

### API Routes - Next.js

**RESTful Endpoints:**
```typescript
// src/app/api/escrows/register/route.ts
export async function POST(request: Request) {
  const body = await request.json()
  const escrow = await prisma.escrow.create({
    data: {
      address: body.address,
      seller: body.seller,
      buyer: body.buyer,
      amount: body.amount,
      status: 'Pending'
    }
  })
  return Response.json({ success: true, escrow })
}
```

**Health Dashboard:**
```typescript
// src/app/admin/health/route.ts
export async function GET() {
  const queueDepth = await redis.llen('bull:escrow-events:waiting')
  const lastBlock = await prisma.indexingState.findUnique({
    where: { id: 'main' }
  })

  return Response.json({
    status: queueDepth > 100 ? 'warning' : 'healthy',
    queueDepth,
    lastProcessedBlock: lastBlock?.lastProcessedBlock
  })
}
```

### Environment & Configuration

**Type-Safe Environment:**
```typescript
// indexer/src/env.ts - Zod validation
export const env = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  RPC_URL: z.string().default('http://localhost:8545'),
  WS_URL: z.string().default('ws://localhost:8545')
}).parse(process.env)
```

## 📡 API Documentation

### Escrow Management

#### POST `/api/escrows/register`
Register an externally deployed escrow contract.

**Request Body:**
```json
{
  "address": "0x...",
  "seller": "0x...",
  "buyer": "0x...",
  "token": "0x...",
  "amount": "1000000000000000000",
  "timeout": 1672531200
}
```

#### GET `/api/escrows`
Get list of escrows with optional filtering.

**Query Parameters:**
- `status`: Filter by escrow status
- `limit`: Number of results (default: 10)
- `offset`: Pagination offset (default: 0)

#### GET `/api/escrows/:address`
Get details of a specific escrow.

### Admin Health

#### GET `/admin/health`
Returns system health status.

**Response:**
```json
{
  "status": "healthy",
  "queueDepth": 5,
  "lastProcessedBlock": 12345678,
  "processedToday": 45
}
```

### Test Utilities

#### POST `/api/test/mine-block`
Mine a test block on local network.

## 🧪 Development

### Running Tests

```bash
# Smart contract tests
forge test

# Frontend tests (when added)
cd frontend
npm run test

# E2E tests (when added)
npm run test:e2e
```

### Code Quality

```bash
# Lint smart contracts
forge fmt

# Lint TypeScript
cd frontend
npm run lint

# Lint indexer
cd indexer
npm run lint
```

### Database Migrations

```bash
cd frontend
npx prisma migrate dev --name <migration-name>
```

## 🧪 Testing

### Smart Contract Testing
```bash
# Run all tests
forge test

# With gas reporting
forge test --gas-report

# Debug specific test
forge test --match-test test_Fund
```

### Local Development Stack

Use Docker Compose for full local stack:

```bash
docker-compose up -d postgres redis
```

## 🚀 Deployment

### Production Prerequisites

1. **Database**: Set up PostgreSQL instance (AWS RDS, Google Cloud SQL, etc.)
2. **Redis**: Redis instance (AWS ElastiCache, etc.)
3. **Blockchain Node**: RPC endpoint (Infura, Alchemy, or self-hosted)

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Blockchain
RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
WS_URL=wss://mainnet.infura.io/ws/v3/YOUR_KEY

# Redis
REDIS_URL=redis://your-redis-instance:6379

# Wallet (for deployment)
PRIVATE_KEY=your_private_key_here
```

### Deployment Steps

1. **Deploy Smart Contracts**
```bash
forge script script/Escrow.s.sol --rpc-url $RPC_URL --broadcast --private-key $PRIVATE_KEY
```

2. **Configure Next.js**
```bash
cd frontend
npm run build
npm start
```

3. **Start Indexer Service**
```bash
cd indexer
npm run build
npm start
```

### Sepolia Testnet Configuration

For testing on Sepolia:

```env
RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
WS_URL=wss://sepolia.infura.io/ws/v3/YOUR_INFURA_KEY
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and patterns
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This is an educational project for demonstrating blockchain and distributed systems concepts. Not intended for production use without thorough security audits and testing.
