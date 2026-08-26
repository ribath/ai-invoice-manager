import { Module } from '@nestjs/common';
import {
  ACCOUNTING_HTTP_CLIENT,
  AccountingHttpClientProvider,
} from './accounting-http-client.provider';

@Module({
  providers: [AccountingHttpClientProvider],
  exports: [ACCOUNTING_HTTP_CLIENT, AccountingHttpClientProvider],
})
export class AccountingHttpModule {}
