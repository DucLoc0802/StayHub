import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { AmenitiesModule } from './amenities/amenities.module';
import { PropertiesModule } from './properties/properties.module';
import { BookingsModule } from './bookings/bookings.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthGuard } from './common/security';
import { FeedbackModule } from './feedback/feedback.module';
@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '8h' },
      }),
    }),
    AuthModule,
    AdminModule,
    AmenitiesModule,
    PropertiesModule,
    BookingsModule,
    FeedbackModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
