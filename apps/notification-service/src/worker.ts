import Redis from "ioredis";
import {
  EVENT_STREAMS,
  logger,
  type DomainEvent,
} from "@ayurveda/shared-utils";
import { handleEvent } from "./handlers/event.handler.js";

const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379");
const CONSUMER_GROUP = "notification-service";
const CONSUMER_NAME = `notification-${process.pid}`;

async function ensureConsumerGroups(): Promise<void> {
  for (const stream of Object.values(EVENT_STREAMS)) {
    try {
      await redis.xgroup("CREATE", stream, CONSUMER_GROUP, "0", "MKSTREAM");
    } catch {
      // Group already exists
    }
  }
}

type RedisStreamEntry = [string, string[]];

export async function startWorker(): Promise<void> {
  await ensureConsumerGroups();
  logger.info("Notification worker started");

  while (true) {
    try {
      const streams = (await redis.xreadgroup(
        "GROUP",
        CONSUMER_GROUP,
        CONSUMER_NAME,
        "COUNT",
        10,
        "BLOCK",
        2000,
        "STREAMS",
        EVENT_STREAMS.ORDER,
        EVENT_STREAMS.PAYMENT,
        ">",
        ">",
      )) as Array<[string, RedisStreamEntry[]]> | null;

      if (!streams) continue;

      for (const [stream, entries] of streams) {
        for (const [id, fields] of entries) {
          const obj: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            if (fields[i] !== undefined && fields[i + 1] !== undefined) {
              obj[fields[i] as string] = fields[i + 1] as string;
            }
          }

          try {
            await handleEvent(obj as unknown as DomainEvent);
            await redis.xack(stream, CONSUMER_GROUP, id);
          } catch (err) {
            logger.error("Failed to process event", err, {
              requestId: obj["requestId"] ?? "unknown",
            });
          }
        }
      }
    } catch (err) {
      logger.error("Worker loop error", err);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
