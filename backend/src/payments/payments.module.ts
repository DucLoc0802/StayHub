import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, SessionUser } from '../common/security';
import { InventoryModule } from '../bookings/inventory.module';
import { PaymentsService } from './payments.service';
import {
  PaymentQueryDto,
  ReviewTransferDto,
  SubmitTransferDto,
} from './payment.dto';
@ApiBearerAuth()
@ApiTags('Thanh toán')
@Roles('GUEST')
@Controller('bookings')
export class CustomerPaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Get(':id/payment') checkout(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
  ) {
    return this.payments.checkout(id, user.id);
  }
  @Post(':id/payment-claims') submit(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: SubmitTransferDto,
  ) {
    return this.payments.submit(id, user.id, dto);
  }
}
@ApiBearerAuth()
@ApiTags('Xác minh thanh toán')
@Roles('ADMIN')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Get() list(@Query() dto: PaymentQueryDto) {
    return this.payments.list(dto);
  }
  @Post(':id/review') review(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: SessionUser,
    @Body() dto: ReviewTransferDto,
  ) {
    return this.payments.review(id, user.id, dto);
  }
}
@Module({
  imports: [InventoryModule],
  controllers: [CustomerPaymentsController, AdminPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
