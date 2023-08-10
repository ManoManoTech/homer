import { Deferred } from './Deferred';

export class StateUpdateDebouncer<State> extends Deferred<unknown> {
  private stateData: State;
  private timeout!: NodeJS.Timeout;

  constructor(
    initialState: State,
    callback: (state: State) => unknown,
    private delay = 3000
  ) {
    super();
    this.promise = this.promise.then(() => callback(this.stateData));
    this.stateData = initialState;
  }

  get state(): State {
    return this.stateData;
  }

  set state(state: State) {
    clearTimeout(this.timeout);
    this.stateData = state;
    this.timeout = setTimeout(this.resolve, this.delay);
  }
}
