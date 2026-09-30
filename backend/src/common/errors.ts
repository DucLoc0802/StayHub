import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('API');
  catch(error: unknown, host: ArgumentsHost) {
    let status = 500;
    let message: string | string[] = 'Hệ thống đang bận. Vui lòng thử lại sau.';
    if (error instanceof HttpException) {
      status = error.getStatus();
      const response = error.getResponse();
      message =
        typeof response === 'string'
          ? response
          : (response as { message: string | string[] }).message;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        status = 409;
        message = 'Dữ liệu đã tồn tại hoặc thao tác đã được thực hiện.';
      }
      if (error.code === 'P2025') {
        status = 404;
        message = 'Không tìm thấy dữ liệu.';
      }
      if (error.code === 'P2034') {
        status = 409;
        message = 'Dữ liệu vừa thay đổi. Vui lòng thử lại.';
      }
    }
    if (typeof message === 'string' && !/[À-ỹ]/.test(message)) {
      message =
        status === 404
          ? 'Không tìm thấy dữ liệu hoặc đường dẫn.'
          : status === 400
            ? 'Thông tin yêu cầu không hợp lệ.'
            : 'Không thể thực hiện yêu cầu.';
    }
    if (status === 500)
      this.logger.error(
        error instanceof Error ? error.message : 'Unknown error',
      );
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message });
  }
}
