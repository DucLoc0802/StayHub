import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { randomUUID } from 'node:crypto';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('API');
  catch(error: unknown, host: ArgumentsHost) {
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message: string | string[] = 'Hệ thống đang bận. Vui lòng thử lại sau.';
    if (error instanceof HttpException) {
      status = error.getStatus();
      code =
        (
          {
            400: 'INVALID_REQUEST',
            401: 'UNAUTHENTICATED',
            403: 'FORBIDDEN',
            404: 'RESOURCE_NOT_FOUND',
            409: 'CONFLICT',
            429: 'RATE_LIMITED',
            503: 'SERVICE_UNAVAILABLE',
          } as Record<number, string>
        )[status] ?? 'REQUEST_FAILED';
      const response = error.getResponse();
      message =
        typeof response === 'string'
          ? response
          : (response as { message: string | string[] }).message;
      if (typeof response === 'object' && response && 'code' in response)
        code = String(response.code);
      if (
        status === 404 &&
        typeof message === 'string' &&
        /^Cannot (GET|POST|PATCH|DELETE|PUT) /.test(message)
      ) {
        code = 'API_ROUTE_NOT_FOUND';
        message =
          'Chức năng này chưa sẵn sàng trên máy chủ. Vui lòng thử lại sau.';
      }
    } else if (error instanceof Prisma.PrismaClientInitializationError) {
      status = 503;
      code = 'DATABASE_UNAVAILABLE';
      message = 'Chưa thể kết nối dữ liệu. Vui lòng thử lại sau.';
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (['P1001', 'P1002', 'P1017'].includes(error.code)) {
        status = 503;
        code = 'DATABASE_UNAVAILABLE';
        message = 'Chưa thể kết nối dữ liệu. Vui lòng thử lại sau.';
      }
      if (['P2021', 'P2022'].includes(error.code)) {
        status = 503;
        code = 'SCHEMA_MISMATCH';
        message = 'Dữ liệu hệ thống đang được cập nhật. Vui lòng thử lại sau.';
      }
      if (error.code === 'P2002') {
        status = 409;
        code = 'DUPLICATE_RECORD';
        message = 'Dữ liệu đã tồn tại hoặc thao tác đã được thực hiện.';
      }
      if (error.code === 'P2025') {
        status = 404;
        code = 'RESOURCE_NOT_FOUND';
        message = 'Không tìm thấy dữ liệu.';
      }
      if (error.code === 'P2034') {
        status = 409;
        code = 'CONCURRENT_CHANGE';
        message = 'Dữ liệu vừa thay đổi. Vui lòng thử lại.';
      }
      if (
        error.code === 'P2028' &&
        /expired|timeout|timed out/i.test(String(error.meta?.error ?? ''))
      ) {
        status = 503;
        code = 'TRANSACTION_TIMEOUT';
        message =
          'Xử lý thanh toán hoặc đặt phòng mất quá lâu. Vui lòng kiểm tra trạng thái đơn và thử lại.';
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
    const requestId = randomUUID();
    if (status >= 500)
      this.logger.error({
        event: 'api_request_failed',
        requestId,
        status,
        code,
        method: host.switchToHttp().getRequest<{ method: string }>().method,
        type: error instanceof Error ? error.constructor.name : 'UnknownError',
        ...(error instanceof Prisma.PrismaClientKnownRequestError
          ? { prismaCode: error.code }
          : {}),
      });
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, code, message, requestId });
  }
}
