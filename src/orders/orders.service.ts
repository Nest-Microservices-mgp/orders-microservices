import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { PrismaClient } from 'generated/prisma';
import { firstValueFrom } from 'rxjs';
import { NATS_SERVICE } from 'src/config';
import { ChangeOrderStatusDto, PaidOrderDto } from './dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { OrderWithProducts } from './order-with-products.interface';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma Client connected successfully');
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      // 1. Confirmar los ids de los productos para ver si existen
      const productIds = createOrderDto.items.map((item) => item.productId);
      const products = await firstValueFrom(
        this.client.send({ cmd: 'validate_products' }, productIds),
      );

      // 2. Cálculos de los valores
      const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
        const item = products.find(
          (product) => product.id === orderItem.productId,
        ).price;
        return acc + item * orderItem.quantity;
      }, 0);

      const totalItems = createOrderDto.items.reduce(
        (acc, orderItem) => acc + orderItem.quantity,
        0,
      );

      // 3. Crear transacción
      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItems: {
            createMany: {
              data: createOrderDto.items.map((orderItem) => ({
                price: products.find(
                  (product) => product.id === orderItem.productId,
                ).price,
                productId: orderItem.productId,
                quantity: orderItem.quantity,
              })),
            },
          },
        },
        include: {
          OrderItems: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            },
          },
        },
      });

      return {
        ...order,
        OrderItems: order.OrderItems.map((orderItem) => ({
          ...orderItem,
          name: products.find((product) => product.id === orderItem.productId)
            .name,
        })),
      };
    } catch (error) {
      this.logger.error(error);
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: `Check logs`,
      });
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const { page = 1, limit = 10 } = orderPaginationDto;

    const totalPage = await this.order.count({
      where: { status: orderPaginationDto.status },
    });
    const lastPage = Math.ceil(totalPage / limit);

    return {
      data: await this.order.findMany({
        where: { status: orderPaginationDto.status },
        skip: (page - 1) * limit,
        take: limit,
      }),
      meta: {
        page,
        total: totalPage,
        lastPage,
      },
    };
  }

  async findOne(id: string) {
    const order = await this.order.findFirst({
      where: { id },
      include: {
        OrderItems: {
          select: {
            productId: true,
            quantity: true,
            price: true,
          },
        },
      },
    });
    if (!order)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with ID ${id} not found`,
      });

    const productIds = order.OrderItems.map((orderItem) => orderItem.productId);
    const products = await firstValueFrom(
      this.client.send({ cmd: 'validate_products' }, productIds),
    );

    return {
      ...order,
      OrderItems: order.OrderItems.map((orderItem) => ({
        ...orderItem,
        name: products.find((product) => product.id === orderItem.productId)
          .name,
      })),
    };
  }

  async changeOrderStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;

    const order = await this.findOne(id);

    if (!order) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with ID ${id} not found`,
      });
    }

    if (order.status === status) return order;

    return this.order.update({
      where: { id },
      data: { status },
    });
  }

  async createPaymentSession(order: OrderWithProducts) {
    const paymentSession = await firstValueFrom(
      this.client.send('create.payment.session', {
        orderId: order.id,
        currency: 'usd',
        items: order.OrderItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      }),
    );
    return paymentSession;
  }

  async paidOrder(paidOrderDto: PaidOrderDto) {
    this.logger.log(`Processing payment for order ${paidOrderDto}`);

    const order = await this.order.update({
      where: { id: paidOrderDto.orderId },
      data: {
        paid: true,
        paidAt: new Date(),
        stripeChargeId: paidOrderDto.stripePaymentId,
        OrderReceipt: {
          // Relación 1 a 1 Order con OrderReceipt (transacción)
          create: {
            receiptUrl: paidOrderDto.receiptUrl,
          },
        },
      },
    });

    return order;
  }
}
