import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from 'generated/prisma';
import { PaginationDto } from 'src/common';

export class OrderPaginationDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OrderStatus, {
    message: `Status must be one of the following: ${Object.values(OrderStatus).join(', ')}`,
  })
  status: OrderStatus;
}
