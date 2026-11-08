import { logger } from '@/core/services/logger';
import { waitForMergeRequestCommits } from '@/review/commands/share/utils/waitForMergeRequestCommits';

const mockFetch = jest.fn();
const provider = { fetchPullRequestCommitIds: mockFetch };

describe('review > waitForMergeRequestCommits', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns immediately when a pushed commit is found on the first fetch', async () => {
    const commitIds = ['abc', 'def'];
    mockFetch.mockResolvedValue(commitIds);

    const result = await waitForMergeRequestCommits(
      provider,
      1,
      42,
      new Set(['abc']),
    );

    expect(result).toBe(commitIds);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries until a pushed commit appears in the MR', async () => {
    const matchingCommitIds = ['abc'];
    mockFetch
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue(matchingCommitIds);

    const promise = waitForMergeRequestCommits(
      provider,
      1,
      42,
      new Set(['abc']),
    );
    await jest.advanceTimersByTimeAsync(2000);

    expect(await promise).toBe(matchingCommitIds);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('retries after an API error', async () => {
    const matchingCommitIds = ['abc'];
    mockFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(matchingCommitIds);

    const promise = waitForMergeRequestCommits(
      provider,
      1,
      42,
      new Set(['abc']),
    );
    await jest.advanceTimersByTimeAsync(1000);

    expect(await promise).toBe(matchingCommitIds);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch commits for MR !42'),
    );
  });

  it('returns last known commits after timeout and logs a warning', async () => {
    mockFetch.mockResolvedValue([]);

    const promise = waitForMergeRequestCommits(
      provider,
      1,
      42,
      new Set(['abc']),
    );
    await jest.advanceTimersByTimeAsync(6000);

    expect(await promise).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      'Pushed commits not found in MR !42 of project 1 after 5000ms',
    );
  });
});
