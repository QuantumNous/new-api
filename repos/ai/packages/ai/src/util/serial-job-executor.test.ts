import { DelayedPromise } from '@ai-sdk/provider-utils';
import { describe, expect, it } from 'vitest';
import { SerialJobExecutor } from './serial-job-executor';

describe('SerialJobExecutor', () => {
  it('should execute a single job successfully', async () => {
    const executor = new SerialJobExecutor();
    const result = new DelayedPromise<string>();

    const jobPromise = executor.run(async () => {
      result.resolve('done');
    });

    await jobPromise;
    expect(await result.promise).toBe('done');
  });

  it('should execute multiple jobs in serial order', async () => {
    const executor = new SerialJobExecutor();
    const executionOrder: number[] = [];
    const job1Promise = new DelayedPromise<void>();
    const job2Promise = new DelayedPromise<void>();
    const job3Promise = new DelayedPromise<void>();

    // Start all jobs
    const promise1 = executor.run(async () => {
      executionOrder.push(1);
      job1Promise.resolve();
    });

    const promise2 = executor.run(async () => {
      executionOrder.push(2);
      job2Promise.resolve();
    });

    const promise3 = executor.run(async () => {
      executionOrder.push(3);
      job3Promise.resolve();
    });

    // Wait for all jobs to complete
    await Promise.all([promise1, promise2, promise3]);

    // Verify execution order
    expect(executionOrder).toEqual([1, 2, 3]);
  });

  it('should handle job errors correctly', async () => {
    const executor = new SerialJobExecutor();
    const error = new Error('test error');

    const promise = executor.run(async () => {
      throw error;
    });

    await expect(promise).rejects.toThrow(error);
  });

  it('should execute jobs one at a time', async () => {
    const executor = new SerialJobExecutor();
    let concurrentJobs = 0;
    let maxConcurrentJobs = 0;
    const job1 = new DelayedPromise<void>();
    const job2 = new DelayedPromise<void>();

    // Start two jobs
    const promise1 = executor.run(async () => {
      concurrentJobs++;
      maxConcurrentJobs = Math.max(maxConcurrentJobs, concurrentJobs);
      await job1.promise;
      concurrentJobs--;
    });

    const promise2 = executor.run(async () => {
      concurrentJobs++;
      maxConcurrentJobs = Math.max(maxConcurrentJobs, concurrentJobs);
      await job2.promise;
      concurrentJobs--;
    });

    // Let both jobs proceed and complete
    job1.resolve();
    job2.resolve();

    await Promise.all([promise1, promise2]);

    expect(maxConcurrentJobs).toBe(1);
  });

  it('should handle mixed success and failure jobs', async () => {
    const executor = new SerialJobExecutor();
    const results: string[] = [];
    const error = new Error('test error');

    // Queue multiple jobs with mixed success/failure
    const promise1 = executor.run(async () => {
      results.push('job1');
    });

    const promise2 = executor.run(async () => {
      throw error;
    });

    const promise3 = executor.run(async () => {
      results.push('job3');
    });

    // First job should succeed
    await promise1;
    expect(results).toEqual(['job1']);

    // Second job should fail
    await expect(promise2).rejects.toThrow(error);

    // Third job should still execute and succeed
    await promise3;
    expect(results).toEqual(['job1', 'job3']);
  });

  it('should handle concurrent calls to run()', async () => {
    const executor = new SerialJobExecutor();
    const executionOrder: number[] = [];
    const startOrder: number[] = [];

    // Create delayed promises for controlling job execution
    const job1 = new DelayedPromise<void>();
    const job2 = new DelayedPromise<void>();
    const job3 = new DelayedPromise<void>();

    // Start all jobs concurrently
    const promises = [
      executor.run(async () => {
        startOrder.push(1);
        await job1.promise;
        executionOrder.push(1);
      }),
      executor.run(async () => {
        startOrder.push(2);
        await job2.promise;
        executionOrder.push(2);
      }),
      executor.run(async () => {
        startOrder.push(3);
        await job3.promise;
        executionOrder.push(3);
      }),
    ].map(p => p.catch(e => e));

    // Resolve jobs in reverse order to verify execution order is maintained
    job3.resolve();
    job2.resolve();
    job1.resolve();

    // Wait for all jobs to complete
    await Promise.all(promises);

    // Verify that jobs were queued in the order they were submitted
    expect(startOrder).toEqual([1, 2, 3]);
    // Verify that jobs were executed in the order they were queued
    expect(executionOrder).toEqual([1, 2, 3]);
  });
});
