import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

/** Optional guard: allows unauthenticated access but attaches user if token present */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // Don't throw if no user — just return null
    return user || null;
  }

  canActivate(context: ExecutionContext) {
    // Always allow, but try to authenticate
    return super.canActivate(context);
  }
}
