import { ConsoleLogger } from '@nestjs/common';

// Framework startup exceptions may include Prisma connection strings or user input.
export class ProductionLogger extends ConsoleLogger {
  override error(): void {
    super.error('Service error. Check runtime configuration, database availability and health checks.');
  }
}
