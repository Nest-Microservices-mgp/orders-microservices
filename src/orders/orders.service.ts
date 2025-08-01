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
import { PRODUCT_SERVICE } from 'src/config';
import { ChangeOrderStatusDto } from './dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderPaginationDto } from './dto/order-pagination.dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(PRODUCT_SERVICE) private readonly productsClient: ClientProxy,
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma Client connected successfully');
  }

  async create(createOrderDto: CreateOrderDto) {
    const ids = [5, 6];
    const products = await firstValueFrom(
      this.productsClient.send({ cmd: 'validate_products' }, ids),
    );
    return products;
    // return {
    //   service: 'ordersMicroservice',
    //   createOrderDto: createOrderDto,
    // };
    // return this.order.create({
    //   data: createOrderDto,
    // });
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
    });
    if (!order)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with ID ${id} not found`,
      });
    return order;
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
}
