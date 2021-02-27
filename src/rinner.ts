import {
  Asyncable,
  async,
} from "https://deno.land/x/asyncable@1.0.0/asyncable.ts";

/**
 * (self: Rinner<Result>): Promise<Result> | Result
 */
export type EntryTask<Result> = (
  self: Rinner<Result>,
) => Asyncable<Result>;

type RunTask = () => Asyncable<boolean>;

export class Rinner<Result> {
  public result: Result | undefined;
  public error: unknown;
  private _tryTask: () => Promise<void>;
  private _entryTasks: Array<RunTask> = [];

  private constructor(task: EntryTask<Result>) {
    this._tryTask = async () => {
      try {
        this.result = await async(task(this));
      } catch (e) {
        this.error = e;
      }
    };
  }

  static try<Result>(task: EntryTask<Result>) {
    return new Rinner<Result>(task);
  }

  next<Result>(task: EntryTask<Result>) {
    return new Rinner<Result>(task);
  }

  skip(canSkip: () => boolean) {
    this._entryTasks.push(() => {
      return !canSkip();
    });
    return this;
  }

  countingRetry(
    count: number,
    delayMilliseconds: number,
    retryTask: () => Asyncable<void> = () => {},
  ) {
    this.retry({
      canRetry: () => {
        return count-- !== 0;
      },
      getDelayMilliseconds: () => {
        return delayMilliseconds;
      },
      retryTask: retryTask,
    });
    return this;
  }

  retry(params: {
    canRetry: () => boolean;
    getDelayMilliseconds: () => number;
    retryTask: (self: Rinner<Result>) => void | Promise<void>;
  }) {
    this._entryTasks.push(async () => {
      while (params.canRetry()) {
        if (this.error === undefined) {
          return true;
        }

        await async(params.retryTask(this));
        await this.sleep(params.getDelayMilliseconds());
        this.error = undefined;
        await this._tryTask();
      }
      return true;
    });

    return this;
  }

  catch(task: (self: Rinner<Result>) => Asyncable<void>) {
    this._entryTasks.push(async () => {
      if (this.error === undefined) {
        return true;
      }
      await async(task(this));
      return true;
    });

    return this;
  }

  completed(task: (self: Rinner<Result>) => Asyncable<void>) {
    this._entryTasks.push(async () => {
      if (this.error !== undefined) {
        return true;
      }

      await async(task(this));
      return true;
    });
  }

  async confirm(): Promise<Result | undefined> {
    await this._tryTask();

    for (const task of this._entryTasks) {
      if (!await async(task())) {
        break;
      }
    }

    return this.result;
  }

  async confirmResult(): Promise<Result> {
    await this._tryTask();

    for (const task of this._entryTasks) {
      if (!await async(task())) {
        break;
      }
    }

    if (this.result === undefined) {
      throw Error("undefined result");
    }

    return this.result;
  }

  protected async sleep(delayMilliseconds: number) {
    await new Promise((resolve) =>
      setTimeout(() => resolve(), delayMilliseconds)
    );
  }
}
