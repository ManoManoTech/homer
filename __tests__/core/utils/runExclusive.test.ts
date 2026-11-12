import { runExclusive } from '@/core/utils/runExclusive';

describe('runExclusive', () => {
  it('runs tasks of the same key one after another', async () => {
    const events: string[] = [];
    const task = (name: string) => async () => {
      events.push(`${name} start`);
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
      events.push(`${name} end`);
    };

    await Promise.all([
      runExclusive('a', task('1')),
      runExclusive('a', task('2')),
    ]);

    expect(events).toEqual(['1 start', '1 end', '2 start', '2 end']);
  });

  it('runs tasks of different keys together', async () => {
    const events: string[] = [];
    const task = (name: string) => async () => {
      events.push(`${name} start`);
      await Promise.resolve();
      events.push(`${name} end`);
    };

    await Promise.all([
      runExclusive('a', task('1')),
      runExclusive('b', task('2')),
    ]);

    expect(events).toEqual(['1 start', '2 start', '1 end', '2 end']);
  });

  it('runs the next task when the previous one failed', async () => {
    const failing = runExclusive('a', () => Promise.reject(new Error('boom')));
    const next = runExclusive('a', () => Promise.resolve('next'));

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toEqual('next');
  });
});
