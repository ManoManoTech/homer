export class Deferred<T> {
  promise: Promise<T>;
  /**
   * Rejects the promise.
   */
  reject!: (reason?: any) => void;
  /**
   * Resolves the promise.
   */
  resolve!: (value: T | PromiseLike<T>) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
