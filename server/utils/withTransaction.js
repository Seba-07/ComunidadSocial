import mongoose from 'mongoose';

/**
 * Execute a callback within a MongoDB transaction.
 * Falls back to running without a transaction if the server doesn't support them
 * (e.g., standalone mongod without replica set).
 *
 * @param {Function} fn - async (session) => result
 * @returns {*} The return value of fn
 */
export async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Same as withTransaction but falls back to non-transactional execution
 * when transactions are not supported (standalone MongoDB).
 */
export async function withTransactionFallback(fn) {
  try {
    return await withTransaction(fn);
  } catch (error) {
    // Standalone MongoDB or mongod without replica set
    if (
      error.codeName === 'IllegalOperation' ||
      error.message?.includes('Transaction') ||
      error.message?.includes('replica set')
    ) {
      return fn(null);
    }
    throw error;
  }
}
