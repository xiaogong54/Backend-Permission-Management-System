import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('系统 · 健康检查')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: '健康检查',
    description: '返回服务与数据库的连通状态，无需登录',
  })
  async check(): Promise<{
    status: 'up' | 'degraded';
    uptime: number;
    timestamp: string;
    database: 'up' | 'down';
  }> {
    const dbOk = await this.prisma.ping();
    return {
      status: dbOk ? 'up' : 'degraded',
      // 进程已运行秒数，部署后可用它判断实例是否被重启过
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: dbOk ? 'up' : 'down',
    };
  }
}
