import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

@Catch(RpcException)
export class RcpCustomExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const rcpError = exception.getError();
    console.error('hola');

    if (
      typeof rcpError === 'object' &&
      'status' in rcpError &&
      'message' in rcpError
    ) {
      const status = isNaN(Number(rcpError.status))
        ? 400
        : Number(rcpError.status);
      response.status(status).json(rcpError);
    }

    response.status(400).json({
      statusCode: 400,
      message: rcpError,
    });
  }
}
