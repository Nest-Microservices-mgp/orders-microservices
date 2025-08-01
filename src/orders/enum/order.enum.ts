import { OrderStatus } from 'generated/prisma';

export const OrderStatusList = [
  OrderStatus.PENDING,
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
];
