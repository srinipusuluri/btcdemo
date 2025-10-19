import { PrismaClient } from '@prisma/client'
import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import Web3 from 'web3'
import { env } from './env'

const prisma = new PrismaClient()

// Redis connection
const redis = new Redis(env.REDIS_URL)

const queue = new Queue('escrow-events', { connection: redis })

async function main() {
  console.log('Starting Escrow Indexer...')

  // Get latest processed block
  const indexingState = await prisma.indexingState.findUnique({
    where: { id: 'main' }
  })

  let fromBlock = indexingState?.lastProcessedBlock || 0

  const web3 = new Web3(env.RPC_URL)

  // WebSocket connection for listening to new blocks and events
  const wsWeb3 = new Web3(new Web3.providers.WebsocketProvider(env.WS_URL))

  console.log('Listening for escrow events from block', fromBlock)

  // Listen to new blocks
  wsWeb3.eth.subscribe('newBlockHeaders', async (error, blockHeader) => {
    if (error) {
      console.error('Subscription error:', error)
      return
    }

    try {
      // Check for escrow events in recent blocks
      const toBlock = blockHeader.number
      await indexBlockRange(fromBlock, toBlock)
      fromBlock = toBlock + 1

      // Update indexing state
      await prisma.indexingState.upsert({
        where: { id: 'main' },
        update: { lastProcessedBlock: toBlock },
        create: { id: 'main', lastProcessedBlock: toBlock }
      })
    } catch (err) {
      console.error('Error processing block:', err)
    }
  })

  // Also periodically check for missed events
  setInterval(async () => {
    try {
      const latestBlock = await web3.eth.getBlockNumber()
      if (latestBlock > fromBlock) {
        await indexBlockRange(fromBlock, latestBlock)
        fromBlock = Number(latestBlock) + 1
      }
    } catch (err) {
      console.error('Error in periodic check:', err)
    }
  }, 30000) // Check every 30 seconds

  // Start worker to process enqueued jobs
  const worker = new Worker('escrow-events', async (job) => {
    const { eventType, escrowAddress, blockNumber, logIndex, rawData } = job.data

    try {
      console.log(`Processing ${eventType} for ${escrowAddress} at block ${blockNumber}`)

      if (eventType === 'EscrowCreated') {
        const escrow = JSON.parse(rawData)

        await prisma.escrow.upsert({
          where: { address: escrowAddress },
          update: {
            seller: escrow.seller,
            buyer: escrow.buyer,
            token: escrow.token,
            amount: escrow.amount.toString(),
            timeout: escrow.timeout,
            status: 'Pending',
          },
          create: {
            address: escrowAddress,
            seller: escrow.seller,
            buyer: escrow.buyer,
            token: escrow.token,
            amount: escrow.amount.toString(),
            timeout: escrow.timeout,
            status: 'Pending',
          },
        })
      } else if (eventType === 'Funded') {
        await prisma.escrow.update({
          where: { address: escrowAddress },
          data: { status: 'Funded' },
        })
      } else if (eventType === 'ConfirmedBySeller') {
        await prisma.escrow.update({
          where: { address: escrowAddress },
          data: { status: 'Confirmed' },
        })
      } else if (eventType === 'CancelledBySeller') {
        await prisma.escrow.update({
          where: { address: escrowAddress },
          data: { status: 'Cancelled' },
        })
      } else if (eventType === 'TimedOut') {
        await prisma.escrow.update({
          where: { address: escrowAddress },
          data: { status: 'TimedOut' },
        })
      }

      // Update job status
      await prisma.queueJob.update({
        where: {
          blockNumber_logIndex: {
            blockNumber,
            logIndex,
          },
        },
        data: { status: 'completed' },
      })
    } catch (err) {
      console.error(`Failed to process job:`, err)
      await prisma.queueJob.update({
        where: {
          blockNumber_logIndex: {
            blockNumber,
            logIndex,
          },
        },
        data: { status: 'failed' },
      })
      throw err
    }
  }, { connection: redis })

  worker.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed:`, err)
    // Implement retry logic here
  })

  console.log('Indexer running...')
}

async function indexBlockRange(from: number, to: number) {
  const web3 = new Web3(env.RPC_URL)

  for (let blockNum = from; blockNum <= to; blockNum++) {
    try {
      const block = await web3.eth.getBlock(blockNum, true)
      if (!block || !block.transactions) continue

      for (const tx of block.transactions) {
        if (!tx.to) continue // Contract creation

        // Check if transaction is to a known escrow
        const escrow = await prisma.escrow.findUnique({
          where: { address: tx.to },
        })

        if (!escrow) continue

        // Get transaction receipt for logs
        const receipt = await web3.eth.getTransactionReceipt(tx.hash)
        if (!receipt.logs) continue

        // Process events from escrow contracts
        // Note: This is a simplified version. In practice, you'd decode the logs properly
        for (let i = 0; i < receipt.logs.length; i++) {
          const log = receipt.logs[i]
          if (log.address === tx.to) {
            // Assume first event is funding, etc. - in reality, decode topics
            let eventType = 'Unknown'
            if (log.topics.length > 0) {
              const signature = log.topics[0]
              if (signature === web3.utils.keccak256('Funded(address,uint256)')) {
                eventType = 'Funded'
              } else if (signature === web3.utils.keccak256('ConfirmedBySeller()')) {
                eventType = 'ConfirmedBySeller'
              } // Add more event signatures
            }

            await queue.add('process-event', {
              eventType,
              escrowAddress: tx.to,
              blockNumber: blockNum,
              logIndex: i,
              rawData: JSON.stringify(log.data),
            }, {
              removeOnComplete: 100,
              removeOnFail: 50,
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 5000,
              },
            })

            // Store in queue jobs table
            await prisma.queueJob.create({
              data: {
                eventType,
                escrowAddress: tx.to,
                blockNumber: blockNum,
                logIndex: i,
                rawData: JSON.stringify(log.data),
                status: 'queued',
              },
            })
          }
        }
      }
    } catch (err) {
      console.error(`Error processing block ${blockNum}:`, err)
    }
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...')
  await redis.quit()
  await prisma.$disconnect()
  process.exit(0)
})

main().catch(console.error)
