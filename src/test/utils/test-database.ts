// External dependencies
import neo4j, { Driver, Session, Transaction } from 'neo4j-driver'; // neo4j-driver@5.12.0
import Redis from 'ioredis'; // ioredis@5.3.2
import * as dotenv from 'dotenv'; // dotenv@16.3.1

// Internal imports
import { neo4jConfig } from '../../backend/member-service/src/config/neo4j';

// Load environment variables
dotenv.config();

// Global constants for test environment
const TEST_DATABASE_URL = process.env.TEST_NEO4J_URL || 'neo4j://localhost:7687/test';
const TEST_REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
const TEST_CONNECTION_POOL_SIZE = Number(process.env.TEST_POOL_SIZE || 50);
const TEST_CONNECTION_TIMEOUT = Number(process.env.TEST_TIMEOUT || 5000);

// Type definitions for configuration options
interface TestManagerOptions {
  neo4jUrl?: string;
  redisUrl?: string;
  poolSize?: number;
  timeout?: number;
  isolationLevel?: 'READ_COMMITTED' | 'SERIALIZABLE';
}

interface InitializeOptions {
  clearExisting?: boolean;
  createIndexes?: boolean;
  timeout?: number;
}

interface CleanupOptions {
  force?: boolean;
  timeout?: number;
}

/**
 * Manages test database connections and operations with comprehensive monitoring
 */
export class TestDatabaseManager {
  private neo4jDriver: Driver;
  private redisClient: Redis;
  private isInitialized: boolean = false;
  private readonly options: Required<TestManagerOptions>;

  constructor(options: TestManagerOptions = {}) {
    this.options = {
      neo4jUrl: options.neo4jUrl || TEST_DATABASE_URL,
      redisUrl: options.redisUrl || TEST_REDIS_URL,
      poolSize: options.poolSize || TEST_CONNECTION_POOL_SIZE,
      timeout: options.timeout || TEST_CONNECTION_TIMEOUT,
      isolationLevel: options.isolationLevel || 'READ_COMMITTED'
    };
  }

  /**
   * Initializes database connections with comprehensive setup
   */
  public async initialize(options: InitializeOptions = {}): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Test database manager is already initialized');
    }

    try {
      // Initialize Neo4j driver with test configuration
      this.neo4jDriver = neo4j.driver(
        this.options.neo4jUrl,
        neo4j.auth.basic(neo4jConfig.username, neo4jConfig.password),
        {
          maxConnectionPoolSize: this.options.poolSize,
          maxTransactionRetryTime: this.options.timeout,
          encrypted: neo4jConfig.encryption
        }
      );

      // Initialize Redis client with test configuration
      this.redisClient = new Redis(this.options.redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        connectTimeout: this.options.timeout,
        lazyConnect: false
      });

      // Verify connections
      await this.verifyConnections();

      // Clear existing data if requested
      if (options.clearExisting) {
        await this.cleanup({ force: true });
      }

      // Create indexes if requested
      if (options.createIndexes) {
        await this.createTestIndexes();
      }

      this.isInitialized = true;
    } catch (error) {
      await this.cleanup({ force: true });
      throw new Error(`Failed to initialize test databases: ${error.message}`);
    }
  }

  /**
   * Performs comprehensive cleanup with verification
   */
  public async cleanup(options: CleanupOptions = {}): Promise<void> {
    try {
      if (this.neo4jDriver) {
        const session = this.neo4jDriver.session({
          database: 'test',
          defaultAccessMode: neo4j.session.WRITE
        });

        try {
          // Clear all nodes and relationships
          await session.executeWrite(async (tx: Transaction) => {
            await tx.run('MATCH (n) DETACH DELETE n');
          });
        } finally {
          await session.close();
        }

        await this.neo4jDriver.close();
      }

      if (this.redisClient) {
        await this.redisClient.flushdb();
        await this.redisClient.quit();
      }

      this.isInitialized = false;
    } catch (error) {
      if (!options.force) {
        throw new Error(`Failed to cleanup test databases: ${error.message}`);
      }
    }
  }

  /**
   * Gets a Neo4j session for test operations
   */
  public getSession(database: string = 'test'): Session {
    if (!this.isInitialized) {
      throw new Error('Test database manager is not initialized');
    }
    return this.neo4jDriver.session({
      database,
      defaultAccessMode: neo4j.session.WRITE
    });
  }

  /**
   * Gets the Redis client for test operations
   */
  public getRedisClient(): Redis {
    if (!this.isInitialized) {
      throw new Error('Test database manager is not initialized');
    }
    return this.redisClient;
  }

  /**
   * Verifies database connections are healthy
   */
  private async verifyConnections(): Promise<void> {
    // Verify Neo4j connection
    const session = this.neo4jDriver.session({ database: 'test' });
    try {
      await session.run('RETURN 1');
    } finally {
      await session.close();
    }

    // Verify Redis connection
    await this.redisClient.ping();
  }

  /**
   * Creates necessary indexes for test environment
   */
  private async createTestIndexes(): Promise<void> {
    const session = this.getSession();
    try {
      await session.executeWrite(async (tx: Transaction) => {
        // Create indexes for common test queries
        await tx.run('CREATE INDEX member_email IF NOT EXISTS FOR (n:Member) ON (n.email)');
        await tx.run('CREATE INDEX event_date IF NOT EXISTS FOR (n:Event) ON (n.date)');
      });
    } finally {
      await session.close();
    }
  }
}

/**
 * Initializes both Neo4j and Redis test database connections
 */
export async function initializeTestDatabases(options: TestManagerOptions = {}): Promise<void> {
  const manager = new TestDatabaseManager(options);
  await manager.initialize({ clearExisting: true, createIndexes: true });
  return manager.cleanup();
}

/**
 * Performs comprehensive cleanup of test data
 */
export async function clearTestData(options: CleanupOptions = {}): Promise<void> {
  const manager = new TestDatabaseManager();
  await manager.initialize();
  await manager.cleanup(options);
}