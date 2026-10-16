import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ExpirationController } from './expiration.controller';
@Module({
  controllers: [ExpirationController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
