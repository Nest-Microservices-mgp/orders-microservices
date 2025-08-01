import { IsEnum, IsUUID } from 'class-validator';
import { OrderStatus } from 'generated/prisma';
export class ChangeOrderStatusDto {
  @IsUUID(4)
  id: string;

  @IsEnum(OrderStatus, {
    message: `Possible status values are ${Object.values(OrderStatus).join(', ')}`,
  })
  status: OrderStatus;
}
