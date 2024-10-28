/* Check the comments first */

import { EventEmitter } from "./emitter";
import {
  EVENT_SAVE_DELAY_MS,
  EventDelayedRepository,
  EventRepositoryError,
} from "./event-repository";
import { EventStatistics } from "./event-statistics";
import { ResultsTester } from "./results-tester";
import { triggerRandomly } from "./utils";

const MAX_EVENTS = 1000;

enum EventName {
  EventA = "A",
  EventB = "B",
}

const EVENT_NAMES = [EventName.EventA, EventName.EventB];

/*

  An initial configuration for this case

*/

function init() {
  const emitter = new EventEmitter<EventName>();

  triggerRandomly(() => emitter.emit(EventName.EventA), MAX_EVENTS);
  triggerRandomly(() => emitter.emit(EventName.EventB), MAX_EVENTS);

  const repository = new EventRepository();
  const handler = new EventHandler(emitter, repository);

  const resultsTester = new ResultsTester({
    eventNames: EVENT_NAMES,
    emitter,
    handler,
    repository,
  });
  resultsTester.showStats(20);
}

/* Please do not change the code above this line */
/* ----–––––––––––––––––––––––––––––––––––––---- */

/*

  The implementation of EventHandler and EventRepository is up to you.
  Main idea is to subscribe to EventEmitter, save it in local stats
  along with syncing with EventRepository.

*/

class EventHandler extends EventStatistics<EventName> {
  // Feel free to edit this class

  repository: EventRepository;

  constructor(emitter: EventEmitter<EventName>, repository: EventRepository) {
    super();
    this.repository = repository;

    emitter.subscribe(EventName.EventA, () => {
      this.setStats(EventName.EventA, this.getStats(EventName.EventA) + 1);
      this.repository.saveEventData(EventName.EventA, 1);
    });
    emitter.subscribe(EventName.EventB, () => {
      this.setStats(EventName.EventB, this.getStats(EventName.EventB) + 1);
      this.repository.saveEventData(EventName.EventB, 1);
    });
  }
}

export class EventRepository extends EventDelayedRepository<EventName> {
  // Feel free to edit this class
  private localCounter: Map<EventName, number> = new Map();
  private timerId: ReturnType<typeof setTimeout> | undefined;

  async saveEventData(
    eventName: EventName,
    count: number = 0,
    isRetry: boolean = false,
  ) {
    // check if retried, count already contain the local counter
    const localCount = isRetry
      ? count
      : (this.localCounter.get(eventName) || 0) + count;

    // if we have timer just increment local counter
    if (this.timerId) {
      this.localCounter.set(eventName, localCount);
      return;
    }

    try {
      this.localCounter.set(eventName, 0);
      await this.updateEventStatsBy(eventName, localCount);
    } catch (e) {
      const _error = e as EventRepositoryError;
      if (
        _error !== EventRepositoryError.REQUEST_FAIL &&
        _error !== EventRepositoryError.TOO_MANY
      ) {
        console.warn("save _error ", _error);
        return;
      }
      this.localCounter.set(
        eventName,
        (this.localCounter.get(eventName) || 0) + localCount,
      );

      // if timer already exist we just increment local counter
      if (this.timerId) {
        return;
      }

      if (_error === EventRepositoryError.REQUEST_FAIL) {
        this.saveEventData(eventName, this.localCounter.get(eventName), true);
      }
      if (_error === EventRepositoryError.TOO_MANY) {
        this.timerId = setTimeout(() => {
          this.saveEventData(eventName, this.localCounter.get(eventName), true);
          this.timerId = undefined;
        }, EVENT_SAVE_DELAY_MS);
      }
    }
  }
}

init();
