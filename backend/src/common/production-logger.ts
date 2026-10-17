import { ConsoleLogger } from '@nestjs/common';

// Framework startup exceptions may include Prisma connection strings or user input.
export class ProductionLogger extends ConsoleLogger {
  override error(message?: unknown): void {
    if (
      message &&
      typeof message === 'object' &&
      'event' in message &&
      message.event === 'api_request_failed'
    ) {
      const fields: Record<string, string | number> = {
        event: 'api_request_failed',
      };
      for (const key of [
        'requestId',
        'status',
        'code',
        'method',
        'type',
        'prismaCode',
      ]) {
        const value = (message as Record<string, unknown>)[key];
        if (
          typeof value === 'number' ||
          (typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value))
        )
          fields[key] = value;
      }
      super.error(JSON.stringify(fields));
      return;
    }
    super.error(
      'Service error. Check runtime configuration, database availability and health checks.',
    );
  }
}
