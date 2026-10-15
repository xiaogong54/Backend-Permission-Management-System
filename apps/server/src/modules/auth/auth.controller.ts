import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  AuthService,
  type CaptchaVo,
  type JwtPayload,
  type LoginVo,
  type ProfileVo,
} from './auth.service';
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

  /**
   * 当前登录人信息
   *
   * ★ 这里刻意不写 @Public()
   *   全局守卫会自动要求请求带合法 token，并把载荷挂到 request.user 上，
   *   再由 @CurrentUser() 注入进来。
   *   前端拿到 permissions 后用于 v-permission 指令做按钮显隐。
   */
  @Get('profile')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '当前登录人信息',
    description:
      '返回用户信息、角色码与权限码。会回源查库，因此账号被禁用/删除后立刻失效',
  })
  profile(@CurrentUser() user: JwtPayload): Promise<ProfileVo> {
    return this.authService.getProfile(BigInt(user.sub));
  }

  /**
   * 退出登录
   *
   * 把当前 token 的 jti 加入黑名单。JWT 本身无状态、无法收回，
   * 黑名单是让"登出"真正生效的必要代价。
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '退出登录',
    description:
      '把当前 token 加入黑名单，该 token 立即失效（TTL 为其剩余有效期）',
  })
  logout(@CurrentUser() user: JwtPayload): Promise<{ message: string }> {
    return this.authService.logout(user);
  }
}
