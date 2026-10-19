import { Controller, Get, Module, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, SessionUser } from '../common/security';
import { InventoryModule } from '../bookings/inventory.module';
import { bookingIdPipe } from '../common/validation';
import { PaymentsService } from './payments.service';

@ApiBearerAuth()
@ApiTags('Thanh toán mô phỏng')
@Roles('GUEST')
@Controller('bookings')
export class CustomerPaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Get(':id/payment') checkout(
    @Param('id', bookingIdPipe()) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.payments.checkout(id, user.id);
  }
  @Post(':id/pay') pay(
    @Param('id', bookingIdPipe()) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.payments.pay(id, user.id);
  }
}
@Module({
  imports: [InventoryModule],
  controllers: [CustomerPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
