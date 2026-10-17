import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, SessionUser } from '../common/security';
import { InventoryModule } from '../bookings/inventory.module';
import { bookingIdPipe } from '../common/validation';
import { PaymentsService } from './payments.service';
import { ReviewTransferDto, SubmitTransferDto } from './payment.dto';
@ApiBearerAuth()
@ApiTags('Thanh toán')
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
  @Post(':id/payment-claims') submit(
    @Param('id', bookingIdPipe()) id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: SubmitTransferDto,
  ) {
    return this.payments.submit(id, user.id, dto);
  }
}
@ApiBearerAuth()
@ApiTags('Đối chiếu khoản cọc trong đặt phòng')
@Roles('ADMIN')
@Controller('admin/bookings')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Post(':bookingId/payment-claims/:id/reconcile') review(
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: ReviewTransferDto,
  ) {
    return this.payments.review(id, user.id, dto, bookingId);
  }
}
@Module({
  imports: [InventoryModule],
  controllers: [CustomerPaymentsController, AdminPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
