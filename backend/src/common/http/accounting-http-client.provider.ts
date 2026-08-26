import { Provider, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export const ACCOUNTING_HTTP_CLIENT = 'ACCOUNTING_HTTP_CLIENT';

export const AccountingHttpClientProvider: Provider = {
  provide: ACCOUNTING_HTTP_CLIENT,
  useFactory: (configService: ConfigService): AxiosInstance => {
    const logger = new Logger('AccountingHttpClient');
    const baseURL =
      configService.get<string>('MOCK_API_URL') || 'http://localhost:8080';
    const apiKey =
      configService.get<string>('MOCK_API_KEY') || 'demo-key-1234';

    const instance = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      timeout: 10000,
    });

    // Request interceptor for logging
    instance.interceptors.request.use((config) => {
      logger.debug(`[OUTBOUND] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
      return config;
    });

    return instance;
  },
  inject: [ConfigService],
};
