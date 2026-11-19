import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const AUDIO_QUEUE = 'AUDIO_QUEUE';
export const AUDIO_QUEUE_NAME = 'audio';

export const newRedis = () => new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

@Global()
@Module({
  providers: [{
    provide: AUDIO_QUEUE,
    useFactory: () => new Queue(AUDIO_QUEUE_NAME, {
      connection: newRedis(),
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 10_000 }, removeOnComplete: 1000, removeOnFail: 5000 },
    }),
  }],
  exports: [AUDIO_QUEUE],
})
export class QueueModule implements OnApplicationShutdown {
  constructor(@Inject(AUDIO_QUEUE) private q: Queue) {}
  async onApplicationShutdown() { await this.q.close(); }
}
