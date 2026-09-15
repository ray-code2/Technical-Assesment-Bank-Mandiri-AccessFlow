import pg, { type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { config } from "../config.js";

const { Pool } = pg;

export interface QueryExecutor {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>;
}

export interface Database extends QueryExecutor {
  transaction<T>(work: (client: QueryExecutor) => Promise<T>): Promise<T>;
}

export const rawPool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export const database: Database = {
  query: (text, values) => rawPool.query(text, values),
  async transaction<T>(work: (client: QueryExecutor) => Promise<T>) {
    const client: PoolClient = await rawPool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

