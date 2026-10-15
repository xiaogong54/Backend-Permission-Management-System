import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService, type CaptchaVo, type LoginVo } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 获取图形验证码
   *
   * @Public() 是必须的：全局守卫默认「要求登录」，
   * 而"获取验证码"恰恰是登录之前要做的事。
   */
  @Get('captcha')
  @Public()
  @ApiOperation({
    summary: '获取图形验证码',
    description:
      '返回 captchaId 与 SVG 图片，有效期 120 秒，校验一次后立即失效需重新获取',
  })
  captcha(): CaptchaVo {
    return this.authService.createCaptcha();
  }

  /**
   * 账号密码登录
   *
   * @HttpCode(200) 不是多余的：POST 的默认成功状态码是 201 Created，
   * 但登录并不"创建资源"，返回 200 才符合语义。
   * 这也是很多接口文档里登录标 200、其它 POST 标 201 的原因。
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '账号密码登录',
    description:
      '校验图形验证码与密码，成功后返回 JWT 与用户信息。' +
      '账号不存在与密码错误统一返回 20001，不做区分，避免账号枚举。',
  })
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginVo> {
    return this.authService.login(dto, {
      // 注意：如果部署在 Nginx 后面，必须给 Express 打开 trust proxy，
      // 否则这里拿到的是代理的 IP 而不是真实客户端 IP
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
