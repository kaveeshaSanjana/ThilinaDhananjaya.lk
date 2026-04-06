import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '.prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: { db: { url: process.env.DATABASE_URL } },
      log: process.env.NODE_ENV === 'development'
        ? [{ emit: 'event', level: 'query' }]
        : ['error'],
    });

    if (process.env.NODE_ENV === 'development') {
      (this as any).$on('query', (e: any) => {
        if (e.duration > 200) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
